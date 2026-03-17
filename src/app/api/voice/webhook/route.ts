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
// Vapi sends "tool-calls" events. We respond with { results: [...] }.

interface ToolCallItem {
  id?: string;
  name?: string;
  parameters?: Record<string, unknown>;
  function?: { name?: string; arguments?: string };
}

interface ToolWithToolCall {
  name?: string;
  type?: string;
  toolCall?: ToolCallItem;
}

function normalizeTime(input: string): string {
  if (!input) return input;
  const t = input.trim().toUpperCase();
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{1}:\d{2}$/.test(t)) return '0' + t;
  const spaced = t.match(/^(\d{1,2})\s+(\d{2})\s*(AM|PM)$/);
  if (spaced) {
    let h = parseInt(spaced[1]);
    const min = spaced[2];
    if (spaced[3] === 'PM' && h < 12) h += 12;
    if (spaced[3] === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  const m = t.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/);
  if (m) {
    let h = parseInt(m[1]);
    const min = m[2] || '00';
    if (m[3] === 'PM' && h < 12) h += 12;
    if (m[3] === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  return input;
}

function normalizeDate(input: string): string {
  if (!input) return input;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return input.trim();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function executeFunction(
  funcName: string,
  funcArgs: Record<string, unknown>,
): Promise<string> {
  switch (funcName) {
    case 'find_doctor':
      return handleFindDoctor(funcArgs as { body_part: string; concern_description?: string });

    case 'get_available_slots':
      return handleGetAvailableSlots(funcArgs as {
        doctor_id: string;
        preferred_day?: string;
        preferred_time_of_day?: string;
      });

    case 'book_appointment': {
      const sessionId = `voice-${Date.now()}`;
      const bookingArgs = { ...funcArgs } as Record<string, string>;
      const normalizedDate = normalizeDate(bookingArgs.appointment_date || '');
      const normalizedTime = normalizeTime(bookingArgs.appointment_time || '');
      if (normalizedDate) bookingArgs.appointment_date = normalizedDate;
      if (normalizedTime) bookingArgs.appointment_time = normalizedTime;

      // Resolve slot: voice AI may pass date/time instead of exact slot_id
      let slotFound = bookingArgs.slot_id ? store.getSlotById(bookingArgs.slot_id) : null;

      if (!slotFound && bookingArgs.doctor_id) {
        const date = bookingArgs.appointment_date || '';
        const time = bookingArgs.appointment_time || '';

        // Construct from doctor_id + date + time
        if (date && time) {
          const constructedId = `${bookingArgs.doctor_id}_${date}_${time}`;
          slotFound = store.getSlotById(constructedId);
          if (slotFound) console.log('[Webhook] Slot resolved via construction:', constructedId);
        }

        // Extract date/time from slot_id string
        if (!slotFound && bookingArgs.slot_id) {
          const dateMatch = bookingArgs.slot_id.match(/(\d{4}-\d{2}-\d{2})/);
          const timeMatch = bookingArgs.slot_id.match(/(\d{1,2}(?::|\s)\d{2}\s*(?:AM|PM)?)/i);
          if (dateMatch && timeMatch) {
            const constructedId = `${bookingArgs.doctor_id}_${dateMatch[1]}_${normalizeTime(timeMatch[1])}`;
            slotFound = store.getSlotById(constructedId);
            if (slotFound) console.log('[Webhook] Slot resolved via extraction:', constructedId);
          }
        }

        // Search all slots
        if (!slotFound) {
          const allSlots = store.getAllSlots();
          slotFound = allSlots.find(s => {
            if (s.doctorId !== bookingArgs.doctor_id || s.isBooked) return false;
            if (date && time) return s.date === date && s.startTime === time;
            if (date) return s.date === date;
            if (time) return s.startTime === time;
            return false;
          }) || null;
          if (slotFound) console.log('[Webhook] Slot resolved via search:', slotFound.id);
        }
      }

      if (slotFound) {
        bookingArgs.slot_id = slotFound.id;
      }

      return handleBookAppointment(bookingArgs as {
        doctor_id: string;
        slot_id: string;
        patient_first_name: string;
        patient_last_name: string;
        patient_dob: string;
        patient_phone: string;
        patient_email: string;
        reason: string;
      }, sessionId);
    }

    case 'check_prescription_status':
      return handleCheckPrescription(funcArgs as {
        patient_name: string;
        medication_name: string;
      });

    case 'get_office_info':
      return handleGetOfficeInfo(funcArgs as {
        office_name_or_location?: string;
      });

    default:
      return JSON.stringify({ error: `Unknown function: ${funcName}` });
  }
}

// Extract function name and args from various Vapi payload formats
function extractToolCalls(message: Record<string, unknown>): { id: string; name: string; args: Record<string, unknown> }[] {
  const calls: { id: string; name: string; args: Record<string, unknown> }[] = [];

  // Format 1: toolWithToolCallList (preferred — name is on wrapper)
  const toolWithList = message.toolWithToolCallList as ToolWithToolCall[] | undefined;
  if (toolWithList && Array.isArray(toolWithList)) {
    for (const item of toolWithList) {
      const name = item.name || item.toolCall?.name || item.toolCall?.function?.name || '';
      const id = item.toolCall?.id || '';
      const args = item.toolCall?.parameters || {};
      if (name) {
        calls.push({ id, name, args: args as Record<string, unknown> });
      }
    }
    if (calls.length > 0) return calls;
  }

  // Format 2: toolCallList (name on each item or in .function.name)
  const toolCallList = message.toolCallList as ToolCallItem[] | undefined;
  if (toolCallList && Array.isArray(toolCallList)) {
    for (const item of toolCallList) {
      const name = item.name || item.function?.name || '';
      const id = item.id || '';
      let args: Record<string, unknown> = {};
      if (item.parameters) {
        args = item.parameters as Record<string, unknown>;
      } else if (item.function?.arguments) {
        try { args = JSON.parse(item.function.arguments); } catch { /* ignore */ }
      }
      if (name) {
        calls.push({ id, name, args });
      }
    }
    if (calls.length > 0) return calls;
  }

  // Format 3: single functionCall object
  const fc = message.functionCall as { name?: string; parameters?: Record<string, unknown> } | undefined;
  if (fc && fc.name) {
    calls.push({ id: '', name: fc.name, args: fc.parameters || {} });
  }

  return calls;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    const eventType = message?.type;

    console.log('[Webhook] Event:', eventType);

    // Handle tool/function calls (covers all Vapi event types)
    if (eventType === 'tool-calls' || eventType === 'function-call') {
      // Log raw structure keys for debugging
      const messageKeys = Object.keys(message || {}).filter(k => k !== 'call' && k !== 'artifact');
      console.log('[Webhook] Message keys:', JSON.stringify(messageKeys));

      const toolCalls = extractToolCalls(message);

      if (toolCalls.length === 0) {
        console.error('[Webhook] No tool calls extracted from message');
        // Return an error result so the AI knows something went wrong
        return NextResponse.json({
          results: [{ name: 'unknown', toolCallId: '', result: JSON.stringify({ error: 'No function calls found in webhook payload' }) }],
        });
      }

      console.log('[Webhook] Extracted calls:', JSON.stringify(toolCalls.map(t => ({ name: t.name, id: t.id }))));

      const results = [];
      for (const tc of toolCalls) {
        let result: string;
        try {
          result = await executeFunction(tc.name, tc.args);
        } catch (error) {
          console.error('[Webhook] Error executing', tc.name, ':', error);
          result = JSON.stringify({ error: `Failed to execute ${tc.name}` });
        }

        results.push({
          name: tc.name,
          toolCallId: tc.id,
          result,
        });
      }

      console.log('[Webhook] Returning', results.length, 'results');
      return NextResponse.json({ results });
    }

    // Non-function events
    switch (eventType) {
      case 'end-of-call-report':
        console.log('[Webhook] Call ended:', message.endedReason);
        return NextResponse.json({ received: true });

      case 'status-update':
      case 'hang':
      case 'speech-update':
      case 'transcript':
        return NextResponse.json({ received: true });

      default:
        console.log('[Webhook] Unhandled event:', eventType);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error('[Webhook] Fatal error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
