// components/VacancyList.tsx
'use client';
import type { EnrichedVacancy } from '@/lib/types';
import { matchesAge } from '@/lib/age';

interface Props { vacancies: EnrichedVacancy[]; selectedId: string | null; age: number; onSelect: (id: string) => void; }

// Rotating Bauhaus primary palette for the left accent bar.
const ACCENTS = ['var(--blue)', 'var(--red)', 'var(--yellow)', 'var(--teal)'];

export default function VacancyList({ vacancies, selectedId, age, onSelect }: Props) {
  if (!vacancies.length) return <p className="bh-empty">Ingen treff. Trykk «Hent ledige barnehager».</p>;
  return (
    <ul className="bh-list">
      {vacancies.map((v, i) => {
        const matches = matchesAge(v.ageGroup, age);
        const cls = ['bh-item',
          v.id === selectedId ? 'bh-item--selected' : '',
          matches ? '' : 'bh-item--dim'].filter(Boolean).join(' ');
        return (
          <li key={v.id} className={cls} onClick={() => onSelect(v.id)}
            title={matches ? undefined : `Plass for annen aldersgruppe enn ${age} år`}
            style={{ ['--accent' as string]: ACCENTS[i % ACCENTS.length] }}>
            <div className="bh-item-name">{v.name}</div>
            <div className="bh-item-meta">
              {v.bydel} · {v.spots ?? '?'} plasser · {v.rawAge}
            </div>
            <div className="bh-item-meta">
              {v.distanceKm != null ? `${v.distanceKm.toFixed(1)} km i luftlinje` : 'Ukjent posisjon'}
              {v.availableFrom ? ` · ledig fra ${v.availableFrom}` : ''}
            </div>
            {!matches && <span className="bh-tag">Annen alder</span>}
          </li>
        );
      })}
    </ul>
  );
}
