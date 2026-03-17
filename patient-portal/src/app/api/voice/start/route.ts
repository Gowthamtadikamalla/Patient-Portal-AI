import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/ai/chat-engine';
import { doctors } from '@/data/doctors';
import { offices } from '@/data/offices';

// Build voice system prompt dynamically from data files — not hardcoded
function buildVoiceDoctorList(): string {
  return doctors.map(d => `- ${d.name} (ID: ${d.id}) — ${d.specialty} (${d.bodyParts.slice(0, 5).join(', ')})`).join('\n');
}

function buildVoiceOfficeList(): string {
  return offices.map(o => {
    const weekdays = Object.entries(o.hours)
      .filter(([, h]) => h !== 'Closed')
      .map(([day, h]) => `${day}: ${h}`)
      .join(', ');
    return `- ${o.name}: ${o.address}, ${o.city}, ${o.state} ${o.zip} | ${o.phone} | ${weekdays}`;
  }).join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, phoneNumber } = body;

    if (!sessionId || !phoneNumber) {
      return NextResponse.json(
        { error: 'sessionId and phoneNumber are required' },
        { status: 400 }
      );
    }

    const vapiKey = process.env.VAPI_API_KEY;
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    const vapiPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;

    // Get conversation context to pass to voice AI
    const context = getSessionContext(sessionId);

    if (!vapiKey || !assistantId) {
      console.log('[Voice] Vapi.ai not configured. Would initiate call to:', phoneNumber);
      console.log('[Voice] Context length:', context.length, 'chars');
      return NextResponse.json({
        success: false,
        demo: true,
        message: 'Voice AI is not configured. In production, this would initiate a phone call to your number with full conversation context.',
        callId: `demo-${Date.now()}`,
      });
    }

    // Normalize phone number to E.164 format
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    const e164Phone = normalizedPhone.startsWith('+') ? normalizedPhone : `+1${normalizedPhone}`;

    // Build the system prompt dynamically from data files
    const voiceSystemPrompt = `You are Kyra, the AI medical receptionist for Kyron Medical Partners.

You are warm, professional, and empathetic. You help patients with:
1. Scheduling appointments — collect patient info, match them to the right specialist, and book available time slots
2. Checking prescription refill status — look up by patient name and medication
3. Providing office information — addresses, hours, phone numbers

IMPORTANT: You are continuing a conversation that started in web chat. Here is the previous conversation context:

${context}

Continue the conversation naturally from where it left off. Remember everything discussed. Be warm and helpful.
Collect patient info ONE FIELD AT A TIME conversationally — never ask for all info at once.

SAFETY RULES:
- NEVER provide medical advice, diagnoses, or treatment recommendations.
- NEVER interpret symptoms or suggest what a condition might be.
- If someone describes an emergency, immediately say: "Please call 911 or go to your nearest emergency room immediately."
- If asked for medical advice, say: "I'm not able to provide medical advice. I'd recommend discussing that directly with your doctor. Would you like to schedule an appointment?"

AVAILABLE DOCTORS:
${buildVoiceDoctorList()}

OFFICE LOCATIONS:
${buildVoiceOfficeList()}

PRESCRIPTION REFILL:
- Sample patients with prescriptions on file: John Smith, Sarah Johnson, Michael Brown, Emily Davis, Robert Wilson
- Ask for patient name and medication name, then use check_prescription_status tool

USE THE TOOLS PROVIDED to find doctors, check available appointment slots, book appointments, and look up prescriptions. Always use the real data from tools — never make up appointment times or information.`;

    // Create Vapi outbound call with conversation context
    // NOTE: serverUrl for webhook is configured on the Vapi assistant in the dashboard
    const vapiResponse = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId,
        phoneNumberId: vapiPhoneNumberId,
        customer: {
          number: e164Phone,
        },
        assistantOverrides: {
          firstMessage: `Hi! I'm Kyra from Kyron Medical Partners. I'm continuing our chat conversation. I have all the context from our previous discussion. How can I help you?`,
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: voiceSystemPrompt,
              },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'find_doctor',
                  description: 'Find the best doctor based on body part or medical concern. Returns doctor name, specialty, and ID.',
                  parameters: {
                    type: 'object',
                    properties: {
                      body_part: { type: 'string', description: 'Body part or area of concern (e.g. knee, heart, skin, stomach)' },
                    },
                    required: ['body_part'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'get_available_slots',
                  description: 'Get available appointment time slots for a specific doctor. Returns dates and times the doctor is free.',
                  parameters: {
                    type: 'object',
                    properties: {
                      doctor_id: { type: 'string', description: 'Doctor ID (e.g. dr-chen, dr-rivera, dr-patel, dr-wilson)' },
                      preferred_day: { type: 'string', description: 'Preferred day of week (e.g. Monday, Tuesday)' },
                      preferred_time_of_day: { type: 'string', enum: ['morning', 'afternoon', 'any'], description: 'Preferred time of day' },
                    },
                    required: ['doctor_id'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'book_appointment',
                  description: 'Book a specific appointment slot for a patient. Triggers email and SMS confirmation.',
                  parameters: {
                    type: 'object',
                    properties: {
                      doctor_id: { type: 'string', description: 'Doctor ID' },
                      slot_id: { type: 'string', description: 'Time slot ID from get_available_slots result' },
                      patient_first_name: { type: 'string', description: 'Patient first name' },
                      patient_last_name: { type: 'string', description: 'Patient last name' },
                      patient_dob: { type: 'string', description: 'Patient date of birth' },
                      patient_phone: { type: 'string', description: 'Patient phone number' },
                      patient_email: { type: 'string', description: 'Patient email address' },
                      reason: { type: 'string', description: 'Reason for visit' },
                      sms_opt_in: { type: 'boolean', description: 'Whether patient opts into SMS reminders' },
                    },
                    required: ['doctor_id', 'slot_id', 'patient_first_name', 'patient_last_name', 'patient_dob', 'patient_phone', 'patient_email', 'reason'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'check_prescription_status',
                  description: 'Check the status of a prescription refill request by patient name and medication',
                  parameters: {
                    type: 'object',
                    properties: {
                      patient_name: { type: 'string', description: 'Patient full name' },
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
                  description: 'Get office address, hours, and contact information',
                  parameters: {
                    type: 'object',
                    properties: {
                      office_name_or_location: { type: 'string', description: 'Office name or location to look up' },
                    },
                  },
                },
              },
            ],
          },
        },
      }),
    });

    if (!vapiResponse.ok) {
      const errorData = await vapiResponse.text();
      console.error('[Voice] Vapi error:', errorData);
      // Fall back to demo mode instead of hard error
      return NextResponse.json({
        success: false,
        demo: true,
        message: `Voice AI connection could not be established. In production with valid Vapi credentials, this would initiate a phone call to ${phoneNumber} with full conversation context from our chat.`,
        callId: `demo-${Date.now()}`,
      });
    }

    const callData = await vapiResponse.json();

    return NextResponse.json({
      success: true,
      callId: callData.id,
      status: callData.status,
      message: 'Phone call initiated! You should receive a call shortly.',
    });
  } catch (error) {
    console.error('[Voice] Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate voice call' },
      { status: 500 }
    );
  }
}
