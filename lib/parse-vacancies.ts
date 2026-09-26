import * as cheerio from 'cheerio';
import type { Vacancy, AgeGroup } from './types';

export function slugFromUrl(url: string): string {
  const parts = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : url;
}

// Collects every age mention in the text ("under 3", "over 3", "3–6 år",
// "født 2024", "født 2021–2023") and classifies each; several distinct
// groups → 'mixed'.
export function parseAgeGroup(text: string, now: Date = new Date()): AgeGroup {
  const t = text.toLowerCase();
  const groups = new Set<AgeGroup>();
  if (/under\s*3/.test(t)) groups.add('under3');
  if (/over\s*3/.test(t)) groups.add('over3');
  for (const m of t.matchAll(/(?<!\d)(\d)\s*[–-]\s*(\d)\s*år/g)) {
    const lo = Number(m[1]), hi = Number(m[2]);
    groups.add(hi < 3 ? 'under3' : lo >= 3 ? 'over3' : 'mixed');
  }
  // A child counts as small until July of the year they turn 3, so compare
  // against the start year of the current barnehage year (August–July).
  const bhYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  for (const m of t.matchAll(/født\s*(?:i\s*)?(\d{4})(?:\s*[–-]\s*(\d{4}))?/g)) {
    for (const y of [m[1], m[2] ?? m[1]]) {
      groups.add(bhYear - Number(y) < 3 ? 'under3' : 'over3');
    }
  }
  if (groups.size === 0) return 'unknown';
  if (groups.size > 1) return 'mixed';
  return [...groups][0];
}

function parseSpots(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:ledige?\s+)?plass/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseAvailableFrom(text: string): string {
  const m = text.match(/(?:ledig\s+)?fra\s+([a-zæøå]+)/i);
  return m ? m[1].toLowerCase() : '';
}

function buildVacancy(name: string, detailUrl: string, bydel: string, lastUpdated: string, description: string): Vacancy {
  return {
    id: slugFromUrl(detailUrl),
    name,
    bydel,
    detailUrl,
    spots: parseSpots(description),
    ageGroup: parseAgeGroup(description),
    rawAge: description,
    availableFrom: parseAvailableFrom(description),
    lastUpdated,
    description,
  };
}

export function parseVacancies(html: string): Vacancy[] {
  const $ = cheerio.load(html);
  const out: Vacancy[] = [];
  $('h3').each((_, h3) => {
    const heading = $(h3).text().trim();
    const m = heading.match(/^Bydel\s+(.+?)\s*\(oppdatert\s+(.+?)\)\s*$/i);
    if (!m) return;
    const bydel = m[1].trim();
    const lastUpdated = m[2].trim();
    let el = $(h3).next();
    while (el.length && el.prop('tagName') !== 'H3') {
      if (el.prop('tagName') === 'UL') {
        el.find('li').each((__, li) => {
          const a = $(li).find('a').first();
          // Some entries put the ":" separator inside the <a>, e.g.
          // "<a>Waldemars barnehage:</a> 1 ledig plass". Strip a trailing colon.
          const name = a.text().trim().replace(/[:\s]+$/, '');
          const detailUrl = a.attr('href') || '';
          if (!name || !detailUrl) return;
          const full = $(li).text().trim();
          const idx = full.indexOf(':');
          const description = idx >= 0 ? full.slice(idx + 1).trim() : full;
          out.push(buildVacancy(name, detailUrl, bydel, lastUpdated, description));
        });
      }
      el = el.next();
    }
  });
  return out;
}
