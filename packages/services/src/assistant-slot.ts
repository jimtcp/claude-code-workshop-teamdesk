// Deterministic date resolution for the booking assistant. The model only
// extracts literal fields; this turns them into a slot. UTC only, no env.

export interface SlotFields {
  attendees?: number | null;
  day?: string | null;
  end?: string | null;
  start?: string | null;
}

export interface ResolvedSlot {
  attendees: number;
  endsAt: string;
  startsAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^(\d{1,2}):(\d{2})$/;
const LEADING_WORD = /^(next|on)\s+/;

const midnightUtc = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** Midnight UTC (ms) of the described day, or null if unresolvable. */
const resolveDay = (day: string, now: Date): number | null => {
  const text = day.trim().toLowerCase();
  const today = midnightUtc(now);
  if (text === "today") {
    return today;
  }
  if (text === "tomorrow") {
    return today + DAY_MS;
  }
  const weekday = WEEKDAYS.indexOf(text.replace(LEADING_WORD, ""));
  if (weekday >= 0) {
    // Next occurrence strictly after today.
    const ahead = ((weekday - now.getUTCDay() + 6) % 7) + 1;
    return today + ahead * DAY_MS;
  }
  const iso = ISO_DATE.exec(text);
  if (iso) {
    const ms = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const parsed = new Date(ms);
    // Reject overflow such as 2026-02-31.
    if (parsed.toISOString().slice(0, 10) === text) {
      return ms;
    }
  }
  return null;
};

/** Minutes after midnight for "HH:MM", or null. */
const resolveClock = (value: string): number | null => {
  const match = CLOCK.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
};

/** Slot for the literal fields, or null when day, start or end is missing. */
export const resolveSlot = (
  fields: SlotFields,
  now: Date
): ResolvedSlot | null => {
  if (!(fields.day && fields.start && fields.end)) {
    return null;
  }
  const dayMs = resolveDay(fields.day, now);
  const start = resolveClock(fields.start);
  const end = resolveClock(fields.end);
  if (dayMs === null || start === null || end === null) {
    return null;
  }
  const attendees =
    Number.isInteger(fields.attendees) && (fields.attendees as number) >= 1
      ? (fields.attendees as number)
      : 1;
  return {
    attendees,
    endsAt: new Date(dayMs + end * 60_000).toISOString(),
    startsAt: new Date(dayMs + start * 60_000).toISOString(),
  };
};
