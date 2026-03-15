import { TimeSlot } from '@/lib/types';

// Generate realistic availabilities for the next 30-60 days
// Each doctor has different schedule patterns

interface SchedulePattern {
  doctorId: string;
  workDays: number[];         // 0=Sun, 1=Mon, ..., 6=Sat
  morningSlots: string[];     // Start times for morning
  afternoonSlots: string[];   // Start times for afternoon
  slotDurationMin: number;
}

const schedulePatterns: SchedulePattern[] = [
  {
    doctorId: 'dr-chen',
    workDays: [1, 2, 3, 4, 5],  // Mon-Fri
    morningSlots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
    afternoonSlots: ['14:00', '14:30', '15:00', '15:30', '16:00'],
    slotDurationMin: 30,
  },
  {
    doctorId: 'dr-rivera',
    workDays: [1, 2, 4, 5],    // Mon, Tue, Thu, Fri (Wed off)
    morningSlots: ['08:00', '08:30', '09:00', '09:30', '10:00'],
    afternoonSlots: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
    slotDurationMin: 30,
  },
  {
    doctorId: 'dr-patel',
    workDays: [1, 3, 4, 5],    // Mon, Wed, Thu, Fri (Tue off)
    morningSlots: ['10:00', '10:30', '11:00', '11:30'],
    afternoonSlots: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'],
    slotDurationMin: 30,
  },
  {
    doctorId: 'dr-wilson',
    workDays: [1, 2, 3, 4],    // Mon-Thu (Fri off)
    morningSlots: ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00'],
    afternoonSlots: ['14:00', '14:30', '15:00', '15:30'],
    slotDurationMin: 30,
  },
];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Seeded pseudo-random to make "some slots already booked" deterministic
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateAvailabilities(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const today = new Date();
  // Start from tomorrow
  const start = new Date(today);
  start.setDate(start.getDate() + 1);

  for (const pattern of schedulePatterns) {
    for (let dayOffset = 0; dayOffset < 55; dayOffset++) {
      const date = new Date(start);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();

      if (!pattern.workDays.includes(dayOfWeek)) continue;

      const dateStr = formatDate(date);
      const dayName = getDayOfWeek(dateStr);
      const allTimes = [...pattern.morningSlots, ...pattern.afternoonSlots];

      for (const startTime of allTimes) {
        const endTime = addMinutes(startTime, pattern.slotDurationMin);
        const slotId = `${pattern.doctorId}_${dateStr}_${startTime}`;

        // ~20% of slots are already "booked" for realism
        const seed = slotId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const isBooked = seededRandom(seed) < 0.2;

        slots.push({
          id: slotId,
          doctorId: pattern.doctorId,
          date: dateStr,
          startTime,
          endTime,
          dayOfWeek: dayName,
          isBooked,
        });
      }
    }
  }

  return slots;
}

export function getAvailableSlots(
  allSlots: TimeSlot[],
  doctorId: string,
  preferredDay?: string,
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'any'
): TimeSlot[] {
  let filtered = allSlots.filter(s => s.doctorId === doctorId && !s.isBooked);

  if (preferredDay) {
    const dayLower = preferredDay.toLowerCase();
    filtered = filtered.filter(s => s.dayOfWeek.toLowerCase() === dayLower);
  }

  if (preferredTimeOfDay && preferredTimeOfDay !== 'any') {
    if (preferredTimeOfDay === 'morning') {
      filtered = filtered.filter(s => {
        const hour = parseInt(s.startTime.split(':')[0]);
        return hour < 12;
      });
    } else if (preferredTimeOfDay === 'afternoon') {
      filtered = filtered.filter(s => {
        const hour = parseInt(s.startTime.split(':')[0]);
        return hour >= 12;
      });
    }
  }

  // Return first 10 available slots (sorted by date/time)
  return filtered
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    })
    .slice(0, 10);
}
