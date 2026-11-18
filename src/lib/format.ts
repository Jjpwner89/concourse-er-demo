/**
 * Date helpers. Everything is evaluated on the County's calendar (America/Los_Angeles), not the
 * server's. Vercel runs in UTC, so "today", day counts and display all pin the time zone explicitly.
 */
export const TZ = "America/Los_Angeles";
const DAY = 86_400_000;

export type DateLike = Date | string | null | undefined;

const isDateOnly = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

const toDate = (d: DateLike) => (d == null ? null : d instanceof Date ? d : isDateOnly(d) ? new Date(d + "T12:00:00Z") : new Date(d));

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar date (YYYY-MM-DD) in County time. Date-only strings pass through unchanged. */
export function isoDay(d: DateLike = new Date()): string {
  if (isDateOnly(d)) return d;
  const x = toDate(d);
  if (!x || isNaN(x.getTime())) return "";
  return dayFmt.format(x);
}

/** Today's date in County time. */
export const todayISO = () => isoDay(new Date());

const dayNumber = (d: DateLike) => {
  const s = isoDay(d);
  if (!s) return NaN;
  const [y, m, dd] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, dd) / DAY;
};

export function fmtDate(d: DateLike) {
  const x = toDate(d);
  if (!x || isNaN(x.getTime())) return "—";
  return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: isDateOnly(d) ? "UTC" : TZ });
}

export function fmtDateTime(d: DateLike) {
  const x = toDate(d);
  if (!x || isNaN(x.getTime())) return "—";
  return x.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
}

/** Whole calendar days from a to b (County time). Same day = 0, tomorrow = 1. */
export function daysBetween(a: DateLike, b: DateLike) {
  const x = dayNumber(a);
  const y = dayNumber(b);
  if (isNaN(x) || isNaN(y)) return 0;
  return Math.round(y - x);
}

export function relDays(d: DateLike) {
  const n = daysBetween(new Date(), d);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function addDays(d: DateLike, n: number) {
  const x = toDate(d) ?? new Date();
  return new Date(x.getTime() + n * DAY);
}

/** Calendar date n days from today (County time), as YYYY-MM-DD. */
export const dayFromToday = (n: number) => isoDay(addDays(new Date(), n));
