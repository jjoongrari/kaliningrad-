import { isPlayable, safeSourceUrl, type Listing } from './game.ts';
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = (first.match(/;/g)?.length || 0) > (first.match(/,/g)?.length || 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && c === delimiter) { row.push(value); value = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(value); if (row.some(v => v.trim())) rows.push(row); row = []; value = '';
    } else value += c;
  }
  if (quoted) throw new Error('В CSV не закрыты кавычки.');
  row.push(value); if (row.some(v => v.trim())) rows.push(row); return rows;
}
export function localImagePath(value: string): string {
  if (value.trim().startsWith('//')) throw new Error('Нужны локальные фотографии.');
  const p = '/' + value.trim().replace(/^\/+/, '');
  if (!/^\/[a-zA-Z0-9_./-]+\.(jpe?g|png|webp|avif)$/i.test(p) || p.includes('..') || p.includes('//')) throw new Error('Нужен локальный путь к JPG, PNG, WebP или AVIF.');
  return p;
}
export function parseListingsCsv(text: string): { listings: Listing[]; skipped: number } {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error('В таблице нет объявлений.');
  const headers = rows[0].map(v => v.trim().toLowerCase());
  const required = ['id', 'title', 'price', 'area', 'location', 'images', 'region', 'availability', 'checkin', 'checkout', 'guests', 'priceunit', 'sourceurl'];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) throw new Error(`Не хватает столбцов: ${missing.join(', ')}. Используйте шаблон.`);
  const listings: Listing[] = [], ids = new Set<string>(); let skipped = 0;
  for (const row of rows.slice(1)) {
    const get = (h: string) => (row[headers.indexOf(h.toLowerCase())] || '').trim();
    if (/^(false|0|нет|неактивно)$/i.test(get('active'))) { skipped++; continue; }
    try {
      const id = get('id'), title = get('title'), location = get('location');
      const price = Number(get('price').replace(/\s/g, '').replace(',', '.')), area = Number(get('area').replace(',', '.'));
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id) || !title || title.length > 300 || !location || location.length > 300 || !Number.isSafeInteger(price) || price <= 0 || price > 1e12 || !Number.isFinite(area) || area <= 0 || !safeSourceUrl(get('sourceUrl'))) { skipped++; continue; }
      const images = [...new Set(get('images').split(';').filter(Boolean).map(localImagePath))].slice(0, 5);
      const item: Listing = { id, title, location, price, area, city: get('city') || 'Калининград', region: get('region'), propertyType: (get('propertyType') || 'apartment') as Listing['propertyType'], dealType: (get('dealType') || 'nightly_rent') as Listing['dealType'], priceUnit: get('priceUnit') as Listing['priceUnit'], images, sourceUrl: get('sourceUrl'), active: /^(true|1|да)$/i.test(get('active')) ? true : null, availability: get('availability') as Listing['availability'], checkIn: get('checkIn'), checkOut: get('checkOut'), guests: Number(get('guests')), rooms: Number(get('rooms')) || 0, beds: Number(get('beds')) || undefined };
      if (!isPlayable(item)) { skipped++; continue; }
      ids.add(id); listings.push(item);
    } catch { skipped++; }
  }
  return { listings, skipped };
}
