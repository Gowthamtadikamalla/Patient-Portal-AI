import { Office } from '@/lib/types';

export const offices: Office[] = [
  {
    id: 'office-main',
    name: 'Kyron Medical Partners — Main Campus',
    address: '1250 Health Sciences Drive, Suite 200',
    city: 'Boston',
    state: 'MA',
    zip: '02115',
    phone: '(617) 555-0100',
    hours: {
      Monday: '8:00 AM – 6:00 PM',
      Tuesday: '8:00 AM – 6:00 PM',
      Wednesday: '8:00 AM – 6:00 PM',
      Thursday: '8:00 AM – 6:00 PM',
      Friday: '8:00 AM – 5:00 PM',
      Saturday: 'Closed',
      Sunday: 'Closed',
    },
  },
  {
    id: 'office-east',
    name: 'Kyron Medical Partners — East Side',
    address: '88 Commonwealth Avenue, Floor 3',
    city: 'Boston',
    state: 'MA',
    zip: '02116',
    phone: '(617) 555-0200',
    hours: {
      Monday: '9:00 AM – 5:00 PM',
      Tuesday: '9:00 AM – 5:00 PM',
      Wednesday: '9:00 AM – 5:00 PM',
      Thursday: '9:00 AM – 5:00 PM',
      Friday: '9:00 AM – 4:00 PM',
      Saturday: 'Closed',
      Sunday: 'Closed',
    },
  },
];

export function getOfficeById(id: string): Office | undefined {
  return offices.find(o => o.id === id);
}

export function getAllOffices(): Office[] {
  return offices;
}
