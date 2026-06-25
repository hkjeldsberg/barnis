'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EnrichedVacancy, RouteResult } from '@/lib/types';
import { HOME } from '@/lib/config';
import { matchesAge } from '@/lib/age';

// Frames the map to home + all given points; re-fits when the set changes.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map(p => p.join(',')).join('|');
  useEffect(() => {
    if (points.length <= 1) {
      map.setView(points[0] ?? [HOME.lat, HOME.lon], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface Props {
  vacancies: EnrichedVacancy[];
  selectedId: string | null;
  age: number;
  route: RouteResult | null;
  onSelect: (id: string) => void;
}

export default function MapViewClient({ vacancies, selectedId, age, route, onSelect }: Props) {
  const points: [number, number][] = [
    [HOME.lat, HOME.lon],
    ...vacancies.filter(v => v.lat != null && v.lon != null).map(v => [v.lat!, v.lon!] as [number, number]),
  ];
  return (
    <MapContainer center={[HOME.lat, HOME.lon]} zoom={12} style={{ height: '100%', width: '100%' }}>
      <FitBounds points={points} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <CircleMarker center={[HOME.lat, HOME.lon]} radius={11}
        pathOptions={{ color: '#111', weight: 3, fillColor: '#ffcc00', fillOpacity: 1 }}>
        <Popup>Hjem: {HOME.label}</Popup>
      </CircleMarker>
      {vacancies.filter(v => v.lat != null && v.lon != null).map(v => {
        const matches = matchesAge(v.ageGroup, age);
        return (
          <Marker key={v.id} position={[v.lat!, v.lon!]} icon={icon}
            opacity={matches ? 1 : 0.4}
            eventHandlers={{ click: () => onSelect(v.id) }}>
            <Popup>
              <strong>{v.name}</strong><br />
              {v.spots ?? '?'} plasser · {v.rawAge}<br />
              {v.distanceKm != null ? `${v.distanceKm.toFixed(1)} km i luftlinje` : ''}
              {!matches ? <><br /><em>Annen aldersgruppe enn {age} år</em></> : null}
            </Popup>
          </Marker>
        );
      })}
      {route?.transit?.polyline?.length ? (
        <Polyline positions={route.transit.polyline} pathOptions={{ color: '#1f3df0', weight: 6, opacity: 0.9 }} />
      ) : null}
      {route?.car?.polyline?.length ? (
        <Polyline positions={route.car.polyline} pathOptions={{ color: '#ff5a3c', weight: 5, opacity: 0.85, dashArray: '8 8' }} />
      ) : null}
    </MapContainer>
  );
}
