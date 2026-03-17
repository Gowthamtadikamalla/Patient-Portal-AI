import { Doctor } from '@/lib/types';
import { doctors } from './doctors';

// Hard-coded prescription data for sample patients
// This simulates a pharmacy/prescription database for the MVP

export interface PrescriptionRecord {
  patientName: string;
  medication: string;
  dosage: string;
  prescribedBy: string;  // doctor name
  status: 'ready_for_pickup' | 'processing' | 'requires_authorization' | 'approved_in_transit' | 'denied';
  statusMessage: string;
  lastUpdated: string;
  pharmacy: string;
  refillsRemaining: number;
}

export const prescriptions: PrescriptionRecord[] = [
  {
    patientName: 'John Smith',
    medication: 'Lisinopril',
    dosage: '10mg daily',
    prescribedBy: 'Dr. Michael Rivera',
    status: 'ready_for_pickup',
    statusMessage: 'Your refill is ready for pickup at CVS Pharmacy on Boylston Street.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'CVS Pharmacy — 123 Boylston St, Boston, MA',
    refillsRemaining: 3,
  },
  {
    patientName: 'John Smith',
    medication: 'Atorvastatin',
    dosage: '20mg daily',
    prescribedBy: 'Dr. Michael Rivera',
    status: 'processing',
    statusMessage: 'Your refill is being processed and is expected to be ready within 24-48 hours.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'CVS Pharmacy — 123 Boylston St, Boston, MA',
    refillsRemaining: 5,
  },
  {
    patientName: 'Sarah Johnson',
    medication: 'Metformin',
    dosage: '500mg twice daily',
    prescribedBy: 'Dr. James Wilson',
    status: 'approved_in_transit',
    statusMessage: 'Your refill has been approved and is being sent to your pharmacy. It should be available within 1-2 business days.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'Walgreens — 456 Tremont St, Boston, MA',
    refillsRemaining: 2,
  },
  {
    patientName: 'Sarah Johnson',
    medication: 'Omeprazole',
    dosage: '20mg daily',
    prescribedBy: 'Dr. James Wilson',
    status: 'ready_for_pickup',
    statusMessage: 'Your refill is ready for pickup at Walgreens on Tremont Street.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'Walgreens — 456 Tremont St, Boston, MA',
    refillsRemaining: 4,
  },
  {
    patientName: 'Michael Brown',
    medication: 'Ibuprofen',
    dosage: '600mg as needed',
    prescribedBy: 'Dr. Sarah Chen',
    status: 'requires_authorization',
    statusMessage: 'This refill requires authorization from Dr. Chen. We have sent a request to the doctor and will update you once approved.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'Rite Aid — 789 Washington St, Boston, MA',
    refillsRemaining: 0,
  },
  {
    patientName: 'Michael Brown',
    medication: 'Cyclobenzaprine',
    dosage: '5mg at bedtime',
    prescribedBy: 'Dr. Sarah Chen',
    status: 'processing',
    statusMessage: 'Your refill is being processed and should be ready within 24-48 hours.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'Rite Aid — 789 Washington St, Boston, MA',
    refillsRemaining: 1,
  },
  {
    patientName: 'Emily Davis',
    medication: 'Tretinoin Cream',
    dosage: '0.025% nightly',
    prescribedBy: 'Dr. Priya Patel',
    status: 'ready_for_pickup',
    statusMessage: 'Your prescription is ready for pickup at your pharmacy.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'CVS Pharmacy — 321 Newbury St, Boston, MA',
    refillsRemaining: 6,
  },
  {
    patientName: 'Emily Davis',
    medication: 'Hydrocortisone',
    dosage: '1% cream, apply twice daily',
    prescribedBy: 'Dr. Priya Patel',
    status: 'denied',
    statusMessage: 'This refill request was denied. It has been more than 12 months since your last visit. Please schedule an appointment with Dr. Patel before we can authorize a refill.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'CVS Pharmacy — 321 Newbury St, Boston, MA',
    refillsRemaining: 0,
  },
  {
    patientName: 'Robert Wilson',
    medication: 'Pantoprazole',
    dosage: '40mg daily',
    prescribedBy: 'Dr. James Wilson',
    status: 'approved_in_transit',
    statusMessage: 'Your refill has been approved and sent to your pharmacy. Expected to be available within 1-2 business days.',
    lastUpdated: new Date().toISOString().split('T')[0],
    pharmacy: 'Walgreens — 456 Tremont St, Boston, MA',
    refillsRemaining: 3,
  },
];

// Look up a prescription by patient name and optional medication name
export function lookupPrescription(
  patientName: string,
  medicationName?: string
): PrescriptionRecord[] {
  const normalizedName = patientName.toLowerCase().trim();

  let results = prescriptions.filter(p =>
    p.patientName.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(p.patientName.toLowerCase())
  );

  if (medicationName) {
    const normalizedMed = medicationName.toLowerCase().trim();
    const filtered = results.filter(p =>
      p.medication.toLowerCase().includes(normalizedMed) ||
      normalizedMed.includes(p.medication.toLowerCase())
    );
    // If medication match found, use it; otherwise return all for that patient
    if (filtered.length > 0) {
      results = filtered;
    }
  }

  return results;
}

// Get all prescriptions for a patient
export function getPatientPrescriptions(patientName: string): PrescriptionRecord[] {
  const normalizedName = patientName.toLowerCase().trim();
  return prescriptions.filter(p =>
    p.patientName.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(p.patientName.toLowerCase())
  );
}
