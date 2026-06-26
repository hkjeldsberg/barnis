// app/page.tsx
'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import type { EnrichedVacancy, RouteResult } from '@/lib/types';
import { matchesAge } from '@/lib/age';
import { HOME } from '@/lib/config';
import Controls from '@/components/Controls';
import VacancyList from '@/components/VacancyList';
import RoutePanel from '@/components/RoutePanel';
import MapView from '@/components/MapView';

interface HomeCoord { lat: number; lon: number; label: string; }

export default function Page() {
  const [all, setAll] = useState<EnrichedVacancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [age, setAge] = useState(2);
  const [count, setCount] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [home, setHome] = useState<HomeCoord>(HOME);
  const [tab, setTab] = useState<'list' | 'map'>('list');

  const fetchVacancies = useCallback(async (refresh: boolean) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/vacancies${refresh ? '?refresh=1' : ''}`);
      if (!res.ok) throw new Error('Henting feilet');
      const data = await res.json();
      setAll(data.vacancies); setFetchedAt(data.fetchedAt);
    } catch (e) {
      setError('Kunne ikke hente ledige barnehager. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVacancies(false); }, [fetchVacancies]);

  // Show all kindergartens (distance-sorted by the API); ones that don't match
  // the selected age are dimmed in the list/map rather than hidden.
  const shown = useMemo(() => all.slice(0, count), [all, count]);
  const matchCount = useMemo(() => shown.filter(v => matchesAge(v.ageGroup, age)).length, [shown, age]);
  const selected = useMemo(() => all.find(v => v.id === selectedId) ?? null, [all, selectedId]);

  // keep count within bounds when the data set changes
  useEffect(() => {
    if (all.length && count > all.length) setCount(all.length);
  }, [all.length, count]);

  const onSelect = useCallback(async (id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 640) setTab('list');
    const v = all.find(x => x.id === id);
    if (!v || v.lat == null || v.lon == null) { setRoute(null); return; }
    setRouteLoading(true); setRoute(null);
    try {
      const res = await fetch(`/api/route?lat=${v.lat}&lon=${v.lon}&homeLat=${home.lat}&homeLon=${home.lon}`);
      setRoute(res.ok ? await res.json() : null);
    } finally {
      setRouteLoading(false);
    }
  }, [all, home]);

  return (
    <main className="bh-main">
      <header className="bh-header">
        <h1>Barnis</h1>
        <div className="bh-shapes" aria-hidden="true">
          <span className="bh-shape bh-shape--sq" />
          <span className="bh-shape bh-shape--circle" />
          <span className="bh-shape bh-shape--tri" />
        </div>
      </header>
      <Controls
        age={age} onAgeChange={setAge}
        count={count} maxCount={all.length} onCountChange={setCount}
        onRefresh={() => fetchVacancies(true)} loading={loading} fetchedAt={fetchedAt}
        home={home} onHomeChange={h => { setHome(h); setRoute(null); }}
      />
      {error && <div className="bh-error">{error}</div>}
      <div className="bh-tabs" role="tablist">
        <button role="tab" className={`bh-tab${tab === 'list' ? ' bh-tab--active' : ''}`} onClick={() => setTab('list')}>Liste</button>
        <button role="tab" className={`bh-tab${tab === 'map' ? ' bh-tab--active' : ''}`} onClick={() => setTab('map')}>Kart</button>
      </div>
      <div className="bh-body">
        <section className={`bh-sidebar${tab === 'map' ? ' bh-panel--hidden' : ''}`}>
          <div className="bh-summary">
            Viser {shown.length} · {matchCount} passer {age} år
          </div>
          <div className="bh-scroll">
            <VacancyList vacancies={shown} selectedId={selectedId} age={age} onSelect={onSelect} />
          </div>
          <RoutePanel route={route} loading={routeLoading} vacancy={selected} />
        </section>
        <section className={`bh-map${tab === 'list' ? ' bh-panel--hidden' : ''}`}>
          <MapView vacancies={shown} selectedId={selectedId} age={age} route={route} onSelect={onSelect} />
        </section>
      </div>
    </main>
  );
}
