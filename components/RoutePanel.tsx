// components/RoutePanel.tsx
'use client';
import type { RouteResult, EnrichedVacancy } from '@/lib/types';
interface Props { route: RouteResult | null; loading: boolean; vacancy: EnrichedVacancy | null; }
export default function RoutePanel({ route, loading, vacancy }: Props) {
  if (!vacancy) return null;
  return (
    <div className="bh-route">
      <h4>{vacancy.name}</h4>
      {vacancy.address && <div className="bh-route-addr">{vacancy.address}</div>}
      {loading && <p>Beregner ruter…</p>}
      {route && (
        <>
          <div className="bh-route-row">
            <span className="bh-chip bh-chip--transit" />
            <span className="bh-route-mode">Kollektiv</span>{' · '}
            {route.transit ? `${route.transit.durationMin} min` : 'ingen rute'}
            {route.transit && (
              <div className="bh-route-legs">
                {route.transit.legs.map(l =>
                  `${l.mode === 'foot' ? 'gå' : l.mode} ${l.line ? l.line + ' ' : ''}${l.durationMin}min`
                ).join(' → ')}
                {` (gange ${route.transit.walkDistanceM} m)`}
              </div>
            )}
            <div><a href={route.enturUrl} target="_blank" rel="noreferrer">Åpne i Entur ↗</a></div>
          </div>
          <div className="bh-route-row">
            <span className="bh-chip bh-chip--car" />
            <span className="bh-route-mode">Bil</span>{' · '}
            {route.car ? `${route.car.durationMin} min · ${route.car.distanceKm.toFixed(1)} km` : 'ingen rute'}
            <div><a href={route.googleMapsUrl} target="_blank" rel="noreferrer">Åpne i Google Maps ↗</a></div>
          </div>
        </>
      )}
    </div>
  );
}
