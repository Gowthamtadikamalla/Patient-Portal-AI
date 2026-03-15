import { Doctor } from '@/lib/types';

export const doctors: Doctor[] = [
  {
    id: 'dr-chen',
    name: 'Dr. Sarah Chen',
    specialty: 'Orthopedics',
    bodyParts: [
      'bones', 'joints', 'muscles', 'back', 'spine', 'knee', 'hip', 'shoulder',
      'elbow', 'wrist', 'ankle', 'foot', 'neck', 'fracture', 'sprain', 'arthritis',
      'tendon', 'ligament', 'cartilage', 'posture', 'scoliosis', 'osteoporosis',
      'pain in joints', 'broken bone', 'torn muscle', 'sports injury'
    ],
    bio: 'Board-certified orthopedic surgeon with 15 years of experience specializing in joint reconstruction and sports medicine.',
    photoUrl: '/doctors/dr-chen.jpg',
    officeId: 'office-main',
  },
  {
    id: 'dr-rivera',
    name: 'Dr. Michael Rivera',
    specialty: 'Cardiology',
    bodyParts: [
      'heart', 'chest', 'blood pressure', 'cardiovascular', 'palpitations',
      'heartbeat', 'arrhythmia', 'cholesterol', 'circulation', 'veins',
      'arteries', 'pulse', 'chest pain', 'shortness of breath', 'cardiac',
      'heart murmur', 'hypertension', 'coronary', 'angina', 'stroke risk'
    ],
    bio: 'Fellowship-trained cardiologist with expertise in preventive cardiology and cardiac imaging. Over 12 years of clinical practice.',
    photoUrl: '/doctors/dr-rivera.jpg',
    officeId: 'office-main',
  },
  {
    id: 'dr-patel',
    name: 'Dr. Priya Patel',
    specialty: 'Dermatology',
    bodyParts: [
      'skin', 'rash', 'acne', 'moles', 'eczema', 'psoriasis', 'dermatitis',
      'hives', 'itching', 'warts', 'fungal', 'hair loss', 'nails', 'sunburn',
      'pigmentation', 'dry skin', 'oily skin', 'blisters', 'scars', 'melanoma',
      'skin cancer screening', 'breakout', 'complexion', 'rosacea'
    ],
    bio: 'Dermatologist specializing in medical and cosmetic dermatology with a focus on early skin cancer detection. 10 years of experience.',
    photoUrl: '/doctors/dr-patel.jpg',
    officeId: 'office-east',
  },
  {
    id: 'dr-wilson',
    name: 'Dr. James Wilson',
    specialty: 'Gastroenterology',
    bodyParts: [
      'stomach', 'digestion', 'abdomen', 'nausea', 'bowel', 'intestine',
      'colon', 'liver', 'gallbladder', 'acid reflux', 'heartburn', 'bloating',
      'constipation', 'diarrhea', 'crohn', 'colitis', 'ibs', 'gastritis',
      'ulcer', 'vomiting', 'appetite', 'weight loss unexplained', 'gut',
      'digestive', 'abdominal pain', 'food intolerance'
    ],
    bio: 'Gastroenterologist with specialized training in endoscopy and inflammatory bowel disease. Practicing for over 18 years.',
    photoUrl: '/doctors/dr-wilson.jpg',
    officeId: 'office-east',
  },
];

export function findDoctorByBodyPart(concern: string): Doctor | null {
  const lowerConcern = concern.toLowerCase();
  
  let bestMatch: Doctor | null = null;
  let bestScore = 0;

  for (const doctor of doctors) {
    let score = 0;
    for (const part of doctor.bodyParts) {
      if (lowerConcern.includes(part) || part.includes(lowerConcern)) {
        // Exact or substring match
        score += 3;
      } else {
        // Word-level overlap
        const partWords = part.split(/\s+/);
        const concernWords = lowerConcern.split(/\s+/);
        for (const pw of partWords) {
          for (const cw of concernWords) {
            if (pw === cw && pw.length > 2) {
              score += 2;
            }
          }
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = doctor;
    }
  }

  return bestScore >= 2 ? bestMatch : null;
}
