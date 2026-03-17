import { NextRequest, NextResponse } from 'next/server';
import store from '@/lib/store';
import { doctors } from '@/data/doctors';
import { getAvailableSlots } from '@/data/availabilities';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');
  const doctorId = searchParams.get('doctorId');

  // Get appointments for a session
  if (sessionId) {
    const appointments = store.getAppointmentsBySession(sessionId);
    return NextResponse.json({ appointments });
  }

  // Get available slots for a doctor
  if (doctorId) {
    const day = searchParams.get('day') || undefined;
    const timeOfDay = (searchParams.get('timeOfDay') as 'morning' | 'afternoon' | 'any') || 'any';
    const slots = getAvailableSlots(store.getAllSlots(), doctorId, day, timeOfDay);
    const doctor = doctors.find(d => d.id === doctorId);
    return NextResponse.json({ slots, doctor });
  }

  // Get all appointments (for metrics)
  const allAppointments = store.getAllAppointments();
  return NextResponse.json({ appointments: allAppointments });
}
