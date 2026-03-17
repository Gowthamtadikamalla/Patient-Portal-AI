import { Appointment } from '@/lib/types';

export async function sendAppointmentEmail(appointment: Appointment): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@kyronmedical.com';

  if (!apiKey) {
    console.log('[Email] SendGrid not configured. Would have sent to:', appointment.patient.email);
    console.log('[Email] Appointment:', appointment.doctor.name, appointment.slot.date, appointment.slot.startTime);
    return false;
  }

  const sgMail = (await import('@sendgrid/mail')).default;
  sgMail.setApiKey(apiKey);

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const formatDate = (d: string) => {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0A2540 0%, #1a3a5c 100%); padding: 32px; text-align: center; }
        .header h1 { color: #00D4AA; margin: 0; font-size: 24px; }
        .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; }
        .body { padding: 32px; }
        .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-label { color: #6b7280; min-width: 120px; font-size: 14px; }
        .detail-value { color: #111827; font-weight: 500; }
        .cta { text-align: center; margin-top: 24px; }
        .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Appointment Confirmed</h1>
          <p>Kyron Medical Partners</p>
        </div>
        <div class="body">
          <p>Hi ${appointment.patient.firstName},</p>
          <p>Your appointment has been confirmed. Here are the details:</p>
          
          <div class="detail-row">
            <span class="detail-label">Doctor</span>
            <span class="detail-value">${appointment.doctor.name} — ${appointment.doctor.specialty}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${formatDate(appointment.slot.date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time</span>
            <span class="detail-value">${formatTime(appointment.slot.startTime)} – ${formatTime(appointment.slot.endTime)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Location</span>
            <span class="detail-value">${appointment.office.name}<br>${appointment.office.address}<br>${appointment.office.city}, ${appointment.office.state} ${appointment.office.zip}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Phone</span>
            <span class="detail-value">${appointment.office.phone}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reason</span>
            <span class="detail-value">${appointment.patient.reason}</span>
          </div>
          
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            Please arrive 15 minutes early to complete any necessary paperwork. 
            If you need to cancel or reschedule, please call us at ${appointment.office.phone} at least 24 hours in advance.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Kyron Medical Partners. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await sgMail.send({
      to: appointment.patient.email,
      from: fromEmail,
      subject: `Appointment Confirmed — ${appointment.doctor.name} on ${formatDate(appointment.slot.date)}`,
      html: htmlContent,
    });
    console.log('[Email] Sent confirmation to:', appointment.patient.email);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}
