import { doctors, findDoctorByBodyPart } from '@/data/doctors';
import { getAvailableSlots } from '@/data/availabilities';
import { offices, getOfficeById, getAllOffices } from '@/data/offices';
import store from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';
import { Appointment, PatientInfo, Doctor } from '@/lib/types';

// ─── Function Handlers ──────────────────────────────────────────────
// These are called when the AI uses function calling (tool_calls)

export async function handleFindDoctor(args: { body_part: string; concern_description?: string }): Promise<string> {
  const searchTerm = args.concern_description || args.body_part;
  const doctor = findDoctorByBodyPart(searchTerm);

  if (!doctor) {
    return JSON.stringify({
      found: false,
      message: `No specialist found for "${searchTerm}". The practice does not currently have a specialist for this area.`,
    });
  }

  const office = getOfficeById(doctor.officeId);
  return JSON.stringify({
    found: true,
    doctor: {
      id: doctor.id,
      name: doctor.name,
      specialty: doctor.specialty,
      bio: doctor.bio,
      office: office ? `${office.name} — ${office.address}, ${office.city}, ${office.state} ${office.zip}` : 'Main Campus',
    },
  });
}

export async function handleGetAvailableSlots(args: {
  doctor_id: string;
  preferred_day?: string;
  preferred_time_of_day?: string;
}): Promise<string> {
  const allSlots = store.getAllSlots();
  const timeOfDay = (args.preferred_time_of_day as 'morning' | 'afternoon' | 'any') || 'any';
  const available = getAvailableSlots(allSlots, args.doctor_id, args.preferred_day, timeOfDay);

  if (available.length === 0) {
    return JSON.stringify({
      slots: [],
      message: `No available slots found${args.preferred_day ? ` on ${args.preferred_day}s` : ''}${args.preferred_time_of_day && args.preferred_time_of_day !== 'any' ? ` in the ${args.preferred_time_of_day}` : ''}. Try a different day or time preference.`,
    });
  }

  const doctor = doctors.find(d => d.id === args.doctor_id);

  return JSON.stringify({
    slots: available.map(s => ({
      id: s.id,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      dayOfWeek: s.dayOfWeek,
      display: `${s.dayOfWeek}, ${formatDateFriendly(s.date)} at ${formatTime12h(s.startTime)}`,
    })),
    doctor: doctor ? { name: doctor.name, specialty: doctor.specialty } : null,
  });
}

export async function handleBookAppointment(args: {
  doctor_id: string;
  slot_id: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: string;
  patient_phone: string;
  patient_email: string;
  reason: string;
}, sessionId: string): Promise<string> {
  const slot = store.getSlotById(args.slot_id);
  if (!slot) {
    return JSON.stringify({ success: false, error: 'Slot not found.' });
  }
  if (slot.isBooked) {
    return JSON.stringify({ success: false, error: 'This slot has already been booked. Please choose another time.' });
  }

  const doctor = doctors.find(d => d.id === args.doctor_id);
  if (!doctor) {
    return JSON.stringify({ success: false, error: 'Doctor not found.' });
  }

  const office = getOfficeById(doctor.officeId);
  if (!office) {
    return JSON.stringify({ success: false, error: 'Office not found.' });
  }

  // Book the slot
  store.bookSlot(args.slot_id);

  const patient: PatientInfo = {
    firstName: args.patient_first_name,
    lastName: args.patient_last_name,
    dateOfBirth: args.patient_dob,
    phone: args.patient_phone,
    email: args.patient_email,
    reason: args.reason,
  };

  const appointment: Appointment = {
    id: uuidv4(),
    sessionId,
    patient,
    doctor,
    slot,
    office,
    bookedAt: new Date().toISOString(),
    status: 'confirmed',
  };

  store.addAppointment(appointment);

  // Trigger notifications asynchronously (don't await to keep response fast)
  triggerNotifications(appointment).catch(console.error);

  return JSON.stringify({
    success: true,
    appointment: {
      id: appointment.id,
      doctor: doctor.name,
      specialty: doctor.specialty,
      date: formatDateFriendly(slot.date),
      time: formatTime12h(slot.startTime),
      dayOfWeek: slot.dayOfWeek,
      office: `${office.name}\n${office.address}, ${office.city}, ${office.state} ${office.zip}`,
      officePhone: office.phone,
    },
  });
}

export async function handleCheckPrescription(args: {
  patient_name: string;
  medication_name: string;
}): Promise<string> {
  const { lookupPrescription } = await import('@/data/prescriptions');

  const results = lookupPrescription(args.patient_name, args.medication_name);

  if (results.length === 0) {
    return JSON.stringify({
      found: false,
      patient: args.patient_name,
      medication: args.medication_name,
      message: `No prescription refill records found for "${args.patient_name}"${args.medication_name ? ` with medication "${args.medication_name}"` : ''}. This could mean the refill has not been requested yet, or the name may not match our records. Please call our office for assistance.`,
    });
  }

  return JSON.stringify({
    found: true,
    patient: args.patient_name,
    prescriptions: results.map(r => ({
      medication: r.medication,
      dosage: r.dosage,
      prescribedBy: r.prescribedBy,
      status: r.statusMessage,
      pharmacy: r.pharmacy,
      refillsRemaining: r.refillsRemaining,
      lastUpdated: r.lastUpdated,
    })),
  });
}

export async function handleGetOfficeInfo(args: {
  office_name_or_location?: string;
}): Promise<string> {
  if (args.office_name_or_location) {
    const search = args.office_name_or_location.toLowerCase();
    const match = offices.find(o =>
      o.name.toLowerCase().includes(search) ||
      o.address.toLowerCase().includes(search) ||
      o.id.toLowerCase().includes(search)
    );
    if (match) {
      return JSON.stringify({ offices: [match] });
    }
  }
  return JSON.stringify({ offices: getAllOffices() });
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDateFriendly(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

async function triggerNotifications(appointment: Appointment): Promise<void> {
  try {
    // Send email notification via SendGrid
    const { sendAppointmentEmail } = await import('@/lib/notifications/email');
    await sendAppointmentEmail(appointment);
  } catch (e) {
    console.log('Email notification skipped:', (e as Error).message);
  }
}

