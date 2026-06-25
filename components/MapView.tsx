'use client';
import dynamic from 'next/dynamic';
import type { EnrichedVacancy, RouteResult } from '@/lib/types';

const MapViewClient = dynamic(() => import('./MapView.client'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>Laster kart…</div>,
});

interface Props {
  vacancies: EnrichedVacancy[];
  selectedId: string | null;
  age: number;
  route: RouteResult | null;
  onSelect: (id: string) => void;
}
export default function MapView(props: Props) { return <MapViewClient {...props} />; }
