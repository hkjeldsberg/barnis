// app/api/vacancies/route.ts
import { NextResponse } from 'next/server';
import { getVacancies } from '@/lib/vacancies-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get('refresh') === '1';
  try {
    const vacancies = await getVacancies({ refresh });
    return NextResponse.json({ vacancies, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: 'Kunne ikke hente ledige plasser', detail: String(err) }, { status: 502 });
  }
}
