import { ConversationSession, TimeSlot, Appointment } from '@/lib/types';
import { generateAvailabilities } from '@/data/availabilities';

// ─── In-Memory Data Store ───────────────────────────────────────────
// This is intentionally simple for MVP. Production would use a database.

class Store {
  private sessions: Map<string, ConversationSession> = new Map();
  private appointments: Map<string, Appointment> = new Map();
  private voiceCalls: Map<string, {
    callId: string;
    sessionId?: string;
    phoneNumber?: string;
    lastDoctorId?: string;
    lastSlots?: Array<{ id: string; doctorId: string; date: string; startTime: string }>;
    updatedAt: string;
  }> = new Map();
  private allSlots: TimeSlot[];

  constructor() {
    this.allSlots = generateAvailabilities();
  }

  // ─── Sessions ───

  getSession(id: string): ConversationSession | undefined {
    return this.sessions.get(id);
  }

  setSession(session: ConversationSession): void {
    this.sessions.set(session.id, session);
  }

  // ─── Slots ───

  getAllSlots(): TimeSlot[] {
    return this.allSlots;
  }

  getSlotById(slotId: string): TimeSlot | undefined {
    return this.allSlots.find(s => s.id === slotId);
  }

  bookSlot(slotId: string): boolean {
    const slot = this.allSlots.find(s => s.id === slotId);
    if (!slot || slot.isBooked) return false;
    slot.isBooked = true;
    return true;
  }

  // ─── Appointments ───

  getAppointment(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  getAppointmentsBySession(sessionId: string): Appointment[] {
    return Array.from(this.appointments.values()).filter(a => a.sessionId === sessionId);
  }

  addAppointment(appointment: Appointment): void {
    this.appointments.set(appointment.id, appointment);
  }

  getAllAppointments(): Appointment[] {
    return Array.from(this.appointments.values());
  }

  // ─── Voice Calls ───

  upsertVoiceCall(callId: string, patch: {
    sessionId?: string;
    phoneNumber?: string;
    lastDoctorId?: string;
    lastSlots?: Array<{ id: string; doctorId: string; date: string; startTime: string }>;
  }): void {
    const existing = this.voiceCalls.get(callId);
    this.voiceCalls.set(callId, {
      callId,
      sessionId: patch.sessionId ?? existing?.sessionId,
      phoneNumber: patch.phoneNumber ?? existing?.phoneNumber,
      lastDoctorId: patch.lastDoctorId ?? existing?.lastDoctorId,
      lastSlots: patch.lastSlots ?? existing?.lastSlots,
      updatedAt: new Date().toISOString(),
    });
  }

  getVoiceCall(callId: string): {
    callId: string;
    sessionId?: string;
    phoneNumber?: string;
    lastDoctorId?: string;
    lastSlots?: Array<{ id: string; doctorId: string; date: string; startTime: string }>;
    updatedAt: string;
  } | undefined {
    return this.voiceCalls.get(callId);
  }

  deleteVoiceCall(callId: string): void {
    this.voiceCalls.delete(callId);
  }
}

// Singleton
const store = new Store();
export default store;
