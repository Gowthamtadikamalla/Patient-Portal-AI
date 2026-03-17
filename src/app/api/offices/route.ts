import { NextResponse } from 'next/server';
import { getAllOffices } from '@/data/offices';

export async function GET() {
  const offices = getAllOffices();
  return NextResponse.json({ offices });
}
