import * as cheerio from 'cheerio';
import type { Vacancy, AgeGroup } from './types';

export function slugFromUrl(url: string): string {
  const parts = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : url;
}

export function parseAgeGroup(text: string): AgeGroup {
  const t = text.toLowerCase();
  if (/under\s*3/.test(t)) return 'under3';
  if (/\d\s*[–-]\s*\d/.test(t) || /født/.test(t)) return 'mixed';
  if (/over\s*3/.test(t)) return 'over3';
  return 'unknown';
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
