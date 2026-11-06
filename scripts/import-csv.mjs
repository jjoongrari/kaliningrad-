import fs from 'node:fs/promises';
import path from 'node:path';
import { parseListingsCsv } from '../src/lib/csv.ts';
const filename = process.argv[2];
if (!filename) { console.error('Usage: npm run import:csv -- /path/table.csv'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const text = await fs.readFile(filename, 'utf8');
const { listings, skipped } = parseListingsCsv(text);
if (listings.length < 10) throw new Error('Нужно минимум 10 квартир Калининградской области с ценой за ночь и двумя фотографиями.');
for (const item of listings) for (const image of item.images) await fs.access(path.join(root, 'public', image));
const first = listings[0];
if (!listings.every(l => l.checkIn === first.checkIn && l.checkOut === first.checkOut && l.guests === first.guests)) throw new Error('Укажите одинаковые даты и число гостей.');
await fs.writeFile(path.join(root, 'public/data/listings.json'), JSON.stringify(listings));
await fs.writeFile(path.join(root, 'public/data/source.csv'), text);
await fs.writeFile(path.join(root, 'public/data/catalog-meta.json'), JSON.stringify({ label:'Квартиры на Балтике',region:'Калининградская область',description:`${listings.length} квартир из импортированной таблицы. Цена за ночь ${first.checkIn} — ${first.checkOut}, гостей: ${first.guests}. Актуальность объявлений онлайн не проверяется.`,photoInfo:'Фотографии сохранены локально. Внешние фотосерверы не используются.' }, null, 2));
console.log(`Imported ${listings.length} listings; excluded ${skipped} unsuitable rows. Rebuild with npm run build.`);
