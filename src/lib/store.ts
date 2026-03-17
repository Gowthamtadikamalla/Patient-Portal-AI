import { ConversationSession, TimeSlot, Appointment } from '@/lib/types';
import { generateAvailabilities } from '@/data/availabilities';

// ─── In-Memory Data Store ───────────────────────────────────────────
// This is intentionally simple for MVP. Production would use a database.

class Store {
  private sessions: Map<string, ConversationSession> = new Map();
  private appointments: Map<string, Appointment> = new Map();
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
}

// Singleton
const store = new Store();
export default store;
