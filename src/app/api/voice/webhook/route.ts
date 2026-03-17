import { NextRequest, NextResponse } from 'next/server';
import {
  handleFindDoctor,
  handleGetAvailableSlots,
  handleBookAppointment,
  handleCheckPrescription,
  handleGetOfficeInfo,
} from '@/lib/ai/function-handlers';
import store from '@/lib/store';

// Vapi.ai webhook receiver — handles events from voice calls.
// This enables the voice AI to call the same backend functions as chat,
// so appointments booked during phone calls are fully saved and confirmed.
//
// Vapi sends "tool-calls" events with toolCallList array.
// We must respond with { results: [{ name, toolCallId, result }] }.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    const eventType = message?.type;

    console.log('[Voice Webhook] Event type:', eventType);

    switch (eventType) {
      // ─── Tool Calls (primary event for function execution) ─────────
      case 'tool-calls': {
        const toolCallList: { id: string; name: string; parameters: Record<string, unknown> }[] =
          message.toolCallList || [];

        console.log('[Voice Webhook] Tool calls:', JSON.stringify(toolCallList.map(t => ({ name: t.name, id: t.id }))));

        const results = [];

        for (const toolCall of toolCallList) {
          const funcName = toolCall.name;
          const funcArgs = toolCall.parameters || {};
          let result: string;

          try {
            switch (funcName) {
              case 'find_doctor':
                result = await handleFindDoctor(funcArgs as { body_part: string; concern_description?: string });
                break;

              case 'get_available_slots':
                result = await handleGetAvailableSlots(funcArgs as {
                  doctor_id: string;
                  preferred_day?: string;
                  preferred_time_of_day?: string;
                });
                break;

              case 'book_appointment': {
                const sessionId = `voice-${Date.now()}`;
                const bookingArgs = { ...funcArgs } as Record<string, string>;

                // Resolve slot_id: voice AI may pass date/time instead of exact ID
                let slotFound = bookingArgs.slot_id
                  ? store.getSlotById(bookingArgs.slot_id)
                  : null;

                if (!slotFound && bookingArgs.doctor_id) {
                  // Try constructing from doctor_id + date + time
                  const date = bookingArgs.appointment_date || '';
                  const time = bookingArgs.appointment_time || '';

                  if (date && time) {
                    const constructedId = `${bookingArgs.doctor_id}_${date}_${time}`;
                    console.log('[Voice Webhook] Trying constructed slot ID:', constructedId);
                    slotFound = store.getSlotById(constructedId);
                  }

                  // Try extracting date/time from slot_id string
                  if (!slotFound && bookingArgs.slot_id) {
                    const dateMatch = bookingArgs.slot_id.match(/(\d{4}-\d{2}-\d{2})/);
                    const timeMatch = bookingArgs.slot_id.match(/(\d{2}:\d{2})/);
                    if (dateMatch && timeMatch) {
                      const constructedId = `${bookingArgs.doctor_id}_${dateMatch[1]}_${timeMatch[1]}`;
                      console.log('[Voice Webhook] Trying extracted slot ID:', constructedId);
                      slotFound = store.getSlotById(constructedId);
                    }
                  }

                  // Search all slots by doctor + date + time
                  if (!slotFound) {
                    const allSlots = store.getAllSlots();
                    const searchDate = bookingArgs.appointment_date || '';
                    const searchTime = bookingArgs.appointment_time || '';

                    slotFound = allSlots.find(s => {
                      if (s.doctorId !== bookingArgs.doctor_id || s.isBooked) return false;
                      if (searchDate && searchTime) return s.date === searchDate && s.startTime === searchTime;
                      if (searchDate) return s.date === searchDate;
                      if (searchTime) return s.startTime === searchTime;
                      return false;
                    }) || null;
                  }
                }

                if (slotFound) {
                  bookingArgs.slot_id = slotFound.id;
                  console.log('[Voice Webhook] Resolved slot:', slotFound.id);
                } else {
                  console.log('[Voice Webhook] Could not resolve slot from args:', JSON.stringify(funcArgs));
                }

                result = await handleBookAppointment(bookingArgs as {
                  doctor_id: string;
                  slot_id: string;
                  patient_first_name: string;
                  patient_last_name: string;
                  patient_dob: string;
                  patient_phone: string;
                  patient_email: string;
                  reason: string;
                }, sessionId);
                break;
              }

              case 'check_prescription_status':
                result = await handleCheckPrescription(funcArgs as {
                  patient_name: string;
                  medication_name: string;
                });
                break;

              case 'get_office_info':
                result = await handleGetOfficeInfo(funcArgs as {
                  office_name_or_location?: string;
                });
                break;

              default:
                result = JSON.stringify({ error: `Unknown function: ${funcName}` });
            }
          } catch (error) {
            console.error('[Voice Webhook] Function error:', funcName, error);
            result = JSON.stringify({ error: `Failed to execute ${funcName}. Please try again.` });
          }

          results.push({
            name: funcName,
            toolCallId: toolCall.id,
            result,
          });
        }

        console.log('[Voice Webhook] Returning results for', results.length, 'tool calls');

        // Vapi expects { results: [{ name, toolCallId, result }] }
        return NextResponse.json({ results });
      }

      // ─── Legacy function-call format (backward compatibility) ──────
      case 'function-call': {
        const { functionCall } = message;
        const funcName = functionCall?.name;
        const funcArgs = functionCall?.parameters || {};
        let result: string;

        console.log('[Voice Webhook] Legacy function-call:', funcName);

        try {
          switch (funcName) {
            case 'find_doctor':
              result = await handleFindDoctor(funcArgs);
              break;
            case 'get_available_slots':
              result = await handleGetAvailableSlots(funcArgs);
              break;
            case 'book_appointment':
              result = await handleBookAppointment(funcArgs, `voice-${Date.now()}`);
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
          console.error('[Voice Webhook] Legacy function error:', error);
          result = JSON.stringify({ error: 'Function execution failed.' });
        }

        return NextResponse.json({ result });
      }

      // ─── Other events ──────────────────────────────────────────────
      case 'end-of-call-report': {
        console.log('[Voice Webhook] Call ended:', {
          reason: message.endedReason,
          summary: message.summary,
        });
        return NextResponse.json({ received: true });
      }

      case 'status-update':
        console.log('[Voice Webhook] Status:', message.status);
        return NextResponse.json({ received: true });

      case 'hang':
      case 'speech-update':
      case 'transcript':
        return NextResponse.json({ received: true });

      default:
        console.log('[Voice Webhook] Unhandled event:', eventType);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error('[Voice Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
