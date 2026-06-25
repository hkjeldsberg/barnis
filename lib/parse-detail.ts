import * as cheerio from 'cheerio';

export function parseDetail(html: string): { lat: number | null; lon: number | null; address: string | null } {
  const decoded = html.replace(/&quot;/g, '"');
  const latM = decoded.match(/"latitude":\s*"?(-?\d+(?:\.\d+)?)"?/);
  const lonM = decoded.match(/"longitude":\s*"?(-?\d+(?:\.\d+)?)"?/);

  const $ = cheerio.load(html);
  let address: string | null = null;
  $('dt').each((_, dt) => {
    if (address) return;
    if (/adresse/i.test($(dt).text())) {
      const dd = $(dt).next('dd');
      if (dd.length) address = dd.text().trim().replace(/\s+/g, ' ');
    }
  });

  return {
    lat: latM ? parseFloat(latM[1]) : null,
    lon: lonM ? parseFloat(lonM[1]) : null,
    address,
  };
}
