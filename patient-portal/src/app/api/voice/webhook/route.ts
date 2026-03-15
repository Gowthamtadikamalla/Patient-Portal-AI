import { NextRequest, NextResponse } from 'next/server';
import {
  handleFindDoctor,
  handleGetAvailableSlots,
  handleBookAppointment,
  handleCheckPrescription,
  handleGetOfficeInfo,
} from '@/lib/ai/function-handlers';

// Vapi.ai webhook receiver — handles events from voice calls
// This enables the voice AI to call the same backend functions as chat,
// so appointments booked during phone calls are fully saved and confirmed.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    console.log('[Voice Webhook] Received event type:', message?.type);

    switch (message?.type) {
      case 'function-call': {
        // Vapi sends function calls when the voice AI needs to execute a tool
        const { functionCall } = message;
        const funcName = functionCall?.name;
        const funcArgs = functionCall?.parameters || {};

        console.log('[Voice Webhook] Function call:', funcName, JSON.stringify(funcArgs));

        let result: string;

        try {
          switch (funcName) {
            case 'find_doctor':
              result = await handleFindDoctor(funcArgs);
              break;
            case 'get_available_slots':
              result = await handleGetAvailableSlots(funcArgs);
              break;
            case 'book_appointment':
              // Use a voice-specific session ID for tracking
              const sessionId = `voice-${Date.now()}`;
              result = await handleBookAppointment(funcArgs, sessionId);
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
        } catch (error) {
          console.error('[Voice Webhook] Function execution error:', error);
          result = JSON.stringify({ error: 'Function execution failed. Please try again.' });
        }

        // Vapi expects the result in this format
        return NextResponse.json({ result });
      }

      case 'end-of-call-report': {
        // Call has ended — log the summary for analytics
        console.log('[Voice Webhook] Call ended:', {
          duration: message.endedReason,
          summary: message.summary,
          transcript: message.transcript,
          recordingUrl: message.recordingUrl,
        });
        return NextResponse.json({ received: true });
      }

      case 'status-update': {
        console.log('[Voice Webhook] Status:', message.status);
        return NextResponse.json({ received: true });
      }

      case 'hang': {
        console.log('[Voice Webhook] Call hanging/in-progress');
        return NextResponse.json({ received: true });
      }

      case 'speech-update': {
        // Voice AI speech activity — useful for debugging
        return NextResponse.json({ received: true });
      }

      case 'transcript': {
        // Real-time transcript — can be stored for conversation continuity
        console.log('[Voice Webhook] Transcript:', message.transcript);
        return NextResponse.json({ received: true });
      }

      default:
        console.log('[Voice Webhook] Unhandled event type:', message?.type);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error('[Voice Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
