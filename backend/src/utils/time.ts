export function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function startOfUtcHour(date: Date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    0,
    0,
    0,
  ));
}

export function addMilliseconds(date: Date, amount: number) {
  return new Date(date.getTime() + amount);
}

export function addHours(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 60 * 60 * 1000);
}

export function formatIso(date: Date) {
  return date.toISOString();
}
