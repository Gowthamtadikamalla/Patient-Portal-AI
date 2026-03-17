import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import {
  handleFindDoctor,
  handleGetAvailableSlots,
  handleBookAppointment,
  handleCheckPrescription,
  handleGetOfficeInfo,
} from '@/lib/ai/function-handlers';
import store from '@/lib/store';
import { ChatMessage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing-key' });
  }
  return _openai;
}

// ─── Tool Definitions ───────────────────────────────────────────────

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'find_doctor',
      description: 'Find a doctor/specialist based on the body part or medical concern the patient mentions. Use this when the patient describes their symptoms or what body part they need help with.',
      parameters: {
        type: 'object',
        properties: {
          body_part: {
            type: 'string',
            description: 'The body part or area the patient is concerned about (e.g., "knee", "heart", "skin")',
          },
          concern_description: {
            type: 'string',
            description: 'A more detailed description of the patient\'s concern',
          },
        },
        required: ['body_part'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description: 'Get available appointment time slots for a specific doctor. Use this when you need to show the patient available dates/times.',
      parameters: {
        type: 'object',
        properties: {
          doctor_id: {
            type: 'string',
            description: 'The doctor\'s ID (e.g., "dr-chen", "dr-rivera", "dr-patel", "dr-wilson")',
          },
          preferred_day: {
            type: 'string',
            description: 'Patient\'s preferred day of the week (e.g., "Tuesday", "Monday"). Leave empty for any day.',
          },
          preferred_time_of_day: {
            type: 'string',
            enum: ['morning', 'afternoon', 'any'],
            description: 'Patient\'s preferred time of day. Default to "any".',
          },
        },
        required: ['doctor_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book a specific appointment slot for a patient. Use this when the patient has confirmed a time slot and you have all their information.',
      parameters: {
        type: 'object',
        properties: {
          doctor_id: { type: 'string', description: 'Doctor ID' },
          slot_id: { type: 'string', description: 'The specific time slot ID to book' },
          patient_first_name: { type: 'string', description: 'Patient first name' },
          patient_last_name: { type: 'string', description: 'Patient last name' },
          patient_dob: { type: 'string', description: 'Patient date of birth (YYYY-MM-DD)' },
          patient_phone: { type: 'string', description: 'Patient phone number' },
          patient_email: { type: 'string', description: 'Patient email address' },
          reason: { type: 'string', description: 'Reason for the appointment' },
        },
        required: ['doctor_id', 'slot_id', 'patient_first_name', 'patient_last_name', 'patient_dob', 'patient_phone', 'patient_email', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_prescription_status',
      description: 'Check the status of a prescription refill for a patient.',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string', description: 'Full name of the patient' },
          medication_name: { type: 'string', description: 'Name of the medication' },
        },
        required: ['patient_name', 'medication_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_office_info',
      description: 'Get office address, hours of operation, and contact information.',
      parameters: {
        type: 'object',
        properties: {
          office_name_or_location: {
            type: 'string',
            description: 'Office name or location to look up. Leave empty for all offices.',
          },
        },
        required: [],
      },
    },
  },
];

// ─── Chat Engine ────────────────────────────────────────────────────

export async function processChat(
  userMessage: string,
  sessionId: string
): Promise<{ response: string; sessionId: string; metadata?: { type?: string; data?: unknown } }> {
  // Get or create session
  let session = store.getSession(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      messages: [],
      patientInfo: null,
      currentWorkflow: 'greeting',
      matchedDoctor: null,
      bookedAppointment: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.setSession(session);
  }

  // Add user message
  const userMsg: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(userMsg);

  // Build OpenAI message history
  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...session.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // Call OpenAI with function calling
  let response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: openaiMessages,
    tools,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1024,
  });

  let assistantMessage = response.choices[0].message;
  let metadata: { type?: string; data?: unknown } | undefined;

  // Handle function calls (loop in case of chained calls)
  let iterations = 0;
  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 5) {
    iterations++;

    // Add assistant message with tool calls
    openaiMessages.push(assistantMessage as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      // Type guard for function tool calls
      if (toolCall.type !== 'function') continue;
      const funcCall = toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
      const funcName = funcCall.function.name;
      const funcArgs = JSON.parse(funcCall.function.arguments);
      let result: string;

      switch (funcName) {
        case 'find_doctor':
          result = await handleFindDoctor(funcArgs);
          break;
        case 'get_available_slots':
          result = await handleGetAvailableSlots(funcArgs);
          // Attach slot data as metadata for frontend rendering
          try {
            const parsed = JSON.parse(result);
            if (parsed.slots && parsed.slots.length > 0) {
              metadata = {
                type: 'slot_picker',
                data: { slots: parsed.slots, doctor: parsed.doctor, doctorId: funcArgs.doctor_id },
              };
            }
          } catch { /* ignore */ }
          break;
        case 'book_appointment':
          result = await handleBookAppointment(funcArgs, sessionId);
          try {
            const parsed = JSON.parse(result);
            if (parsed.success) {
              metadata = { type: 'confirmation', data: parsed.appointment };
            }
          } catch { /* ignore */ }
          break;
        case 'check_prescription_status':
          result = await handleCheckPrescription(funcArgs);
          break;
        case 'get_office_info':
          result = await handleGetOfficeInfo(funcArgs);
          break;
        default:
          result = JSON.stringify({ error: `Unknown function: ${funcName}` });
      }

      openaiMessages.push({
        role: 'tool',
        tool_call_id: funcCall.id,
        content: result,
      });
    }

    // Get next AI response
    response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1024,
    });

    assistantMessage = response.choices[0].message;
  }

  const aiResponseText = assistantMessage.content || 'I apologize, I encountered an issue. Could you please try again?';

  // Save assistant message to session
  const aiMsg: ChatMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: aiResponseText,
    timestamp: new Date().toISOString(),
    metadata,
  };
  session.messages.push(aiMsg);
  session.updatedAt = new Date().toISOString();
  store.setSession(session);

  return {
    response: aiResponseText,
    sessionId,
    metadata,
  };
}

export function getSessionContext(sessionId: string): string {
  const session = store.getSession(sessionId);
  if (!session) return '';

  return session.messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
}
