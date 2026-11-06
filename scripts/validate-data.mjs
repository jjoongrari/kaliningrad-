import fs from 'node:fs/promises';
import path from 'node:path';
import { isPlayable } from '../src/lib/game.ts';
import { localImagePath } from '../src/lib/csv.ts';
const root = path.resolve(import.meta.dirname, '..');
const data = JSON.parse(await fs.readFile(path.join(root, 'public/data/listings.json'), 'utf8'));
if (!Array.isArray(data) || data.length < 10) throw new Error('At least 10 eligible Kaliningrad nightly rentals required');
const ids = new Set(); let images = 0;
const context = data[0];
for (const item of data) {
  if (item.checkIn !== context.checkIn || item.checkOut !== context.checkOut || item.guests !== context.guests) throw new Error('All listings must use the same dates and guest count');
  if (!item.id || ids.has(item.id)) throw new Error('Missing or duplicate ID'); ids.add(item.id);
  if (!isPlayable(item) || !item.title || !item.location || !Number.isFinite(item.area) || item.area <= 0) throw new Error(`Ineligible listing: ${item.id}`);
  for (const image of item.images) {
    const local = localImagePath(image);
    if (!local.startsWith('/images/')) throw new Error('Photos must be in public/images');
    await fs.access(path.join(root, 'public', local)); images++;
  }
}
console.log(`Data OK: ${data.length} Kaliningrad nightly rentals, ${images} local images`);
