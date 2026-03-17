// ─── Doctor & Availability Types ────────────────────────────────────

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  bodyParts: string[];      // semantic keywords for matching
  bio: string;
  photoUrl: string;
  officeId: string;
}

export interface TimeSlot {
  id: string;
  doctorId: string;
  date: string;             // YYYY-MM-DD
  startTime: string;        // HH:MM (24h)
  endTime: string;           // HH:MM (24h)
  dayOfWeek: string;        // "Monday", "Tuesday", etc.
  isBooked: boolean;
}

export interface Office {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  hours: { [day: string]: string };
}

// ─── Patient & Appointment Types ────────────────────────────────────

export interface PatientInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;      // YYYY-MM-DD
  phone: string;
  email: string;
  reason: string;
}

export interface Appointment {
  id: string;
  sessionId: string;
  patient: PatientInfo;
  doctor: Doctor;
  slot: TimeSlot;
  office: Office;
  bookedAt: string;          // ISO timestamp
  status: 'confirmed' | 'cancelled';
}

// ─── Chat Types ─────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    type?: string;
    data?: unknown;
  };
}

export type WorkflowType = 'greeting' | 'scheduling' | 'prescription' | 'office_info' | 'general';

export interface ConversationSession {
  id: string;
  messages: ChatMessage[];
  patientInfo: PatientInfo | null;
  currentWorkflow: WorkflowType;
  matchedDoctor: Doctor | null;
  bookedAppointment: Appointment | null;
  createdAt: string;
  updatedAt: string;
}

// ─── API Types ──────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  sessionId: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  metadata?: {
    type?: string;
    data?: unknown;
  };
}

export interface VoiceHandoffRequest {
  sessionId: string;
  phoneNumber: string;
}

export interface BookingRequest {
  sessionId: string;
  slotId: string;
  doctorId: string;
  patient: PatientInfo;
}
