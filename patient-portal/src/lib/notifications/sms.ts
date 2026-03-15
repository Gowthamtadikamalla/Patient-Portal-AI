import { Appointment } from '@/lib/types';

export async function sendAppointmentSMS(appointment: Appointment): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('[SMS] Twilio not configured. Would have sent to:', appointment.patient.phone);
    return false;
  }

  if (!appointment.patient.smsOptIn) {
    console.log('[SMS] Patient did not opt in for SMS notifications');
    return false;
  }

  const twilio = (await import('twilio')).default;
  const client = twilio(accountSid, authToken);

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const formatDate = (d: string) => {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  const body = [
    `✓ Kyron Medical — Appointment Confirmed`,
    ``,
    `Dr. ${appointment.doctor.name.replace('Dr. ', '')} (${appointment.doctor.specialty})`,
    `${formatDate(appointment.slot.date)} at ${formatTime(appointment.slot.startTime)}`,
    `${appointment.office.address}, ${appointment.office.city}`,
    ``,
    `Please arrive 15 min early. Call ${appointment.office.phone} to reschedule.`,
  ].join('\n');

  try {
    await client.messages.create({
      body,
      from: fromNumber,
      to: appointment.patient.phone,
    });
    console.log('[SMS] Sent confirmation to:', appointment.patient.phone);
    return true;
  } catch (error) {
    console.error('[SMS] Failed to send:', error);
    return false;
  }
}
