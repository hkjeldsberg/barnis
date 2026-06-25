// app/api/route/route.ts
import { NextResponse } from 'next/server';
import { getRoute } from '@/lib/route-service';
import { HOME } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: 'lat og lon kreves' }, { status: 400 });
  }
  const homeLat = parseFloat(params.get('homeLat') ?? '');
  const homeLon = parseFloat(params.get('homeLon') ?? '');
  const from = (!Number.isNaN(homeLat) && !Number.isNaN(homeLon))
    ? { lat: homeLat, lon: homeLon }
    : HOME;
  try {
    const route = await getRoute({ lat, lon }, from);
    return NextResponse.json(route);
  } catch (err) {
    return NextResponse.json({ error: 'Kunne ikke hente rute', detail: String(err) }, { status: 502 });
  }
}
