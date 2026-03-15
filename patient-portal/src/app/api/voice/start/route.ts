import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/ai/chat-engine';

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

    // Create Vapi outbound call with conversation context
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
                content: `You are Kyra, the AI medical receptionist for Kyron Medical Partners. 
                
IMPORTANT: You are continuing a conversation that started in web chat. Here is the previous conversation context:

${context}

Continue the conversation naturally from where it left off. Remember everything discussed. Be warm and helpful.
Collect patient info ONE FIELD AT A TIME conversationally.

SAFETY: Never provide medical advice, diagnoses, or treatment recommendations. If asked, redirect to scheduling a doctor appointment.`,
              },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'find_doctor',
                  description: 'Find a doctor based on body part or medical concern',
                  parameters: {
                    type: 'object',
                    properties: {
                      body_part: { type: 'string', description: 'Body part or area of concern' },
                      concern_description: { type: 'string', description: 'Description of concern' },
                    },
                    required: ['body_part'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'get_available_slots',
                  description: 'Get available appointment slots for a doctor',
                  parameters: {
                    type: 'object',
                    properties: {
                      doctor_id: { type: 'string', description: 'Doctor ID' },
                      preferred_day: { type: 'string', description: 'Preferred day of week' },
                      preferred_time_of_day: { type: 'string', enum: ['morning', 'afternoon', 'any'] },
                    },
                    required: ['doctor_id'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'book_appointment',
                  description: 'Book a specific appointment slot',
                  parameters: {
                    type: 'object',
                    properties: {
                      doctor_id: { type: 'string' },
                      slot_id: { type: 'string' },
                      patient_first_name: { type: 'string' },
                      patient_last_name: { type: 'string' },
                      patient_dob: { type: 'string' },
                      patient_phone: { type: 'string' },
                      patient_email: { type: 'string' },
                      reason: { type: 'string' },
                      sms_opt_in: { type: 'boolean' },
                    },
                    required: ['doctor_id', 'slot_id', 'patient_first_name', 'patient_last_name', 'patient_dob', 'patient_phone', 'patient_email', 'reason'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'check_prescription_status',
                  description: 'Check prescription refill status',
                  parameters: {
                    type: 'object',
                    properties: {
                      patient_name: { type: 'string' },
                      medication_name: { type: 'string' },
                    },
                    required: ['patient_name', 'medication_name'],
                  },
                },
              },
              {
                type: 'function',
                function: {
                  name: 'get_office_info',
                  description: 'Get office address, hours, and contact info',
                  parameters: {
                    type: 'object',
                    properties: {
                      office_name_or_location: { type: 'string' },
                    },
                    required: [],
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
