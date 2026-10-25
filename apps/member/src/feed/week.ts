/** The DAO's home time zone: week boundaries and dates in the app use it. */
export const DAO_TIME_ZONE = 'America/Chicago';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

function localParts(at: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;

  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekday: WEEKDAYS.indexOf(value('weekday')),
  };
}

/** Milliseconds the zone's wall clock is ahead of UTC at the given instant. */
function zoneOffset(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant of local midnight at the start of the given calendar day in the zone. */
function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day);
  const guess = new Date(wallAsUtc - zoneOffset(new Date(wallAsUtc), timeZone));
  // Re-read the offset at the guess so a DST change between the two instants is honoured.
  return new Date(wallAsUtc - zoneOffset(guess, timeZone));
}

/** The week containing `now`: Monday 00:00 to the next Monday 00:00 in `timeZone`. */
export function weekBounds(now: Date, timeZone: string = DAO_TIME_ZONE): { from: Date; to: Date } {
  const today = localParts(now, timeZone);
  // Walk back to Monday on the calendar; Date.UTC normalises day underflow across months.
  const monday = new Date(Date.UTC(today.year, today.month - 1, today.day) - today.weekday * DAY_MS);
  const y = monday.getUTCFullYear();
  const m = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();

  return {
    from: localMidnight(y, m, d, timeZone),
    to: localMidnight(y, m, d + 7, timeZone),
  };
}
