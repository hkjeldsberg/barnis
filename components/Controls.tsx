// components/Controls.tsx
'use client';
import { useState } from 'react';

interface HomeCoord { lat: number; lon: number; label: string; }

interface Props {
  age: number; onAgeChange: (n: number) => void;
  count: number; maxCount: number; onCountChange: (n: number) => void;
  onRefresh: () => void; loading: boolean; fetchedAt: string | null;
  home: HomeCoord; onHomeChange: (h: HomeCoord) => void;
}

export default function Controls({ age, onAgeChange, count, maxCount, onCountChange, onRefresh, loading, fetchedAt, home, onHomeChange }: Props) {
  const [addressInput, setAddressInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleSetHome() {
    const q = addressInput.trim();
    if (!q) return;
    setGeocoding(true); setGeocodeError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=no`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'no' } });
      const data = await res.json();
      if (!data.length) { setGeocodeError('Fant ikke adressen'); return; }
      const { lat, lon, display_name } = data[0];
      onHomeChange({ lat: parseFloat(lat), lon: parseFloat(lon), label: display_name });
      setAddressInput('');
      setSettingsOpen(false);
    } catch {
      setGeocodeError('Kunne ikke søke opp adressen');
    } finally {
      setGeocoding(false);
    }
  }

  const secondary = (
    <>
      <div className="bh-field">
        <span className="bh-label">Alder · <span className="bh-value">{age} år</span></span>
        <input type="range" min={0} max={6} value={age} onChange={e => onAgeChange(Number(e.target.value))} />
      </div>
      <div className="bh-field">
        <span className="bh-label">Vis · <span className="bh-value">{count}</span> / {maxCount}</span>
        <input type="range" min={1} max={Math.max(1, maxCount)} value={count} onChange={e => onCountChange(Number(e.target.value))} />
      </div>
      <div className="bh-field bh-field--home">
        <span className="bh-label">Hjemadresse · <span className="bh-value bh-home-label">{home.label}</span></span>
        <div className="bh-home-row">
          <input
            className="bh-input"
            type="text"
            placeholder="Skriv inn ny adresse…"
            value={addressInput}
            onChange={e => setAddressInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSetHome()}
          />
          <button className="bh-btn bh-btn--sm" onClick={handleSetHome} disabled={geocoding || !addressInput.trim()}>
            {geocoding ? '…' : 'Sett'}
          </button>
        </div>
        {geocodeError && <span className="bh-error bh-error--inline">{geocodeError}</span>}
      </div>
      {fetchedAt && <span className="bh-updated bh-label">
        Oppdatert: {new Date(fetchedAt).toLocaleString('no-NO')}
      </span>}
    </>
  );

  return (
    <div className="bh-controls">
      {/* Primary row — always visible */}
      <div className="bh-controls-primary">
        <button className="bh-btn bh-btn--refresh" onClick={onRefresh} disabled={loading}>
          {loading ? 'Henter…' : 'Hent ledige barnehager'}
        </button>
        {/* Toggle button — only rendered/used on mobile via CSS */}
        <button
          className="bh-controls-toggle"
          onClick={() => setSettingsOpen(o => !o)}
          aria-expanded={settingsOpen}
        >
          Innstillinger {settingsOpen ? '↑' : '↓'}
        </button>
      </div>

      {/* Secondary controls — always shown on desktop, toggled on mobile */}
      <div className={`bh-controls-secondary${settingsOpen ? ' bh-controls-secondary--open' : ''}`}>
        {secondary}
      </div>
    </div>
  );
}
