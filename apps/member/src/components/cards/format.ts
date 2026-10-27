import { DAO_TIME_ZONE } from '../../feed/week';

const dayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: DAO_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: DAO_TIME_ZONE, hour: 'numeric', minute: '2-digit' });
const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: DAO_TIME_ZONE, weekday: 'short' });
const dayOfMonthFormat = new Intl.DateTimeFormat('en-US', { timeZone: DAO_TIME_ZONE, day: 'numeric' });

/** "Mon, Oct 26" in the DAO's time zone. */
export const formatDay = (iso: string) => dayFormat.format(new Date(iso));

/** "7:00 PM" in the DAO's time zone. */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** The two halves of a calendar tile: "Mon" and "26". */
export function dateTile(iso: string): { weekday: string; day: string } {
  const at = new Date(iso);
  return { weekday: weekdayFormat.format(at), day: dayOfMonthFormat.format(at) };
}

/** A short age like the agent's mono context lines: "just now", "4h ago", "2d ago". */
export function ago(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return minutes < 1 ? 'just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** People are credited by first name. */
export const firstName = (displayName: string) => displayName.trim().split(/\s+/)[0];

export function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
