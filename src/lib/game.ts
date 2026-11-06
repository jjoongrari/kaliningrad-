export type Listing = {
  id: string; title: string; location: string; price: number; area: number;
  city: string; region: string; rooms?: number; beds?: number;
  propertyType: 'apartment'; dealType: 'nightly_rent'; priceUnit: 'night';
  images: string[]; sourceUrl: string; active: boolean | null;
  availability: 'source_snapshot' | 'confirmed'; checkIn: string; checkOut: string; guests: number;
};
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export type Answer = { listing: Listing; guess: number; points: number; difference: number; error: number };
export const ROUND_SIZE = 10;
export const MAX_SCORE = ROUND_SIZE * 100;
export function safeSourceUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && ['avito.ru', 'cian.ru', 'realty.yandex.ru'].some(h => u.hostname === h || u.hostname.endsWith('.' + h)); } catch { return false; }
}
export function isPlayable(item: Listing): boolean {
  return item.active !== false && item.propertyType === 'apartment' && item.dealType === 'nightly_rent'
    && item.priceUnit === 'night' && item.region === 'Калининградская область'
    && ['source_snapshot', 'confirmed'].includes(item.availability)
    && validDate(item.checkIn) && validDate(item.checkOut)
    && (Date.parse(item.checkOut) - Date.parse(item.checkIn)) === 86400000
    && Number.isSafeInteger(item.guests) && item.guests > 0
    && Number.isSafeInteger(item.price) && item.price > 0 && Array.isArray(item.images) && item.images.length >= 2 && safeSourceUrl(item.sourceUrl);
}
export function pickRound(pool: Listing[], random: () => number = Math.random): Listing[] {
  const eligible = pool.filter(isPlayable);
  const context = eligible[0];
  const comparable = context ? eligible.filter(item => item.checkIn === context.checkIn && item.checkOut === context.checkOut && item.guests === context.guests) : [];
  const unique = [...new Map(comparable.map(item => [item.id, item])).values()];
  if (unique.length < ROUND_SIZE) throw new Error('Нужно минимум 10 квартир Калининградской области с ценой за ночь и двумя фотографиями.');
  for (let i = unique.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [unique[i], unique[j]] = [unique[j], unique[i]]; }
  return unique.slice(0, ROUND_SIZE);
}
export function evaluate(listing: Listing, guess: number): Answer {
  if (!Number.isSafeInteger(guess) || guess < 0 || !Number.isSafeInteger(listing.price) || listing.price <= 0) throw new Error('Укажите целую неотрицательную цену.');
  const difference = guess - listing.price, error = Math.abs(difference) / listing.price;
  return { listing, guess, difference, error, points: Math.round(Math.max(0, (listing.price - Math.abs(difference)) * 100 / listing.price)) };
}
export function summarize(answers: Answer[]) {
  const points = answers.reduce((s, a) => s + a.points, 0);
  const overpayment = answers.reduce((s, a) => s + Math.max(0, a.difference), 0);
  const underpayment = answers.reduce((s, a) => s + Math.max(0, -a.difference), 0);
  const overCount = answers.filter(a => a.difference > 0).length, underCount = answers.filter(a => a.difference < 0).length;
  const averageError = answers.length ? answers.reduce((s, a) => s + a.error, 0) / answers.length : 0;
  const experienced = answers.length > 0 && points / answers.length >= 85;
  let direction = Math.sign(overCount - underCount);
  if (!direction) direction = Math.sign(answers.reduce((s, a) => s + a.difference / a.listing.price, 0));
  if (!direction) direction = Math.sign([...answers].sort((a, b) => b.error - a.error)[0]?.difference || 0);
  const profile = experienced ? 'Балтийский локал' : direction < 0 ? 'Охотник за халявой' : 'Янтарный спонсор';
  return { points, overpayment, underpayment, net: overpayment - underpayment, overCount, underCount, averageError, profile, experienced, tied: overCount === underCount };
}
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
export function money(value: number) { return `${number.format(Math.round(value))} ₽`; }
export function compactMoney(value: number) {
  if (value < 1000) return money(value);
  const amount = value >= 1_000_000 ? value / 1_000_000 : value / 1_000;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(amount)} ${value >= 1_000_000 ? 'млн' : 'тыс.'} ₽`;
}
export function answerText(answer: Answer): string {
  return answer.difference === 0 ? 'Точное попадание в цену объявления.' : `Твоя оценка на ${money(Math.abs(answer.difference))} ${answer.difference > 0 ? 'больше' : 'меньше'} цены объявления.`;
}
export function sliderBounds(pool: Listing[]) {
  const prices = pool.map(x => x.price);
  return { min: Math.max(0, Math.floor(Math.min(...prices) / 2 / 100) * 100), max: Math.ceil(Math.max(...prices) * 1.2 / 500) * 500 };
}
export function defaultGuess(pool: Listing[]) {
  const sorted = pool.map(x => x.price).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
