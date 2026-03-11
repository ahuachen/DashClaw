export const BASE_NOW = Date.now();

export function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pick(rnd, items) {
  return items[Math.floor(rnd() * items.length)];
}

export function int(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

export function isoFromNow(msAgo) {
  return new Date(BASE_NOW - msAgo).toISOString();
}

export function isoInFuture(msAhead) {
  return new Date(BASE_NOW + msAhead).toISOString();
}

export function stableId(prefix, n) {
  return `${prefix}_${String(n).padStart(3, '0')}`;
}

export const DEMO_ORG = 'org_demo';

const MS_MINUTE = 60 * 1000;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

export { MS_MINUTE, MS_HOUR, MS_DAY };
