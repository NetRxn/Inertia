import Link from 'next/link';
import { getAdapters } from '../../../../adapters';
import { getDb } from '../../../../db/client';
import { requireMember } from '../../../../identity/session';
import { datedItems, loadDatedInput, type DatedItem, type DatedTag } from '../../../../calendar/dated-items';
import { DAO_TIME_ZONE } from '../../../../feed/week';
import { formatDay } from '../../../../components/cards/format';
import cardStyles from '../../../../components/cards/cards.module.css';
import styles from '../../sections.module.css';
import calendar from './calendar.module.css';

const TAG_CHIP: Record<DatedTag, string> = {
  Meeting: 'in-chip--tide',
  Event: 'in-chip--tide',
  Deadline: 'in-chip--signal',
  Vote: 'in-chip--pollen',
  Funding: 'in-chip--moss',
  'Task due': 'in-chip--ion',
  'From your data': '',
};
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOTS = 3;

const pad = (n: number) => String(n).padStart(2, '0');
const todayKey = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: DAO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const monthLabel = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 15)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortMonth = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 15)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
// Noon UTC keeps a bare date on its own day in the DAO's time zone.
const dayHeading = (date: string) => formatDay(`${date}T12:00:00Z`);

function shift(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function href(year: number, month: number, day?: number): string {
  return `/org?tab=calendar&month=${year}-${pad(month)}${day ? `&day=${pad(day)}` : ''}`;
}

function Agenda({ items }: { items: DatedItem[] }) {
  const days: { date: string; items: DatedItem[] }[] = [];
  for (const item of items) {
    const last = days.at(-1);
    if (last?.date === item.date) last.items.push(item);
    else days.push({ date: item.date, items: [item] });
  }
  return (
    <>
      {days.map((day) => (
        <section key={day.date} className={`in-glass ${cardStyles.card}`} aria-labelledby={`day-${day.date}`}>
          <h2 id={`day-${day.date}`} className={`in-label ${cardStyles.eyebrowTide}`}>{dayHeading(day.date)}</h2>
          <ul className={cardStyles.rows}>
            {day.items.map((item) => (
              <li key={item.id} className={cardStyles.stack}>
                <h3 className={cardStyles.itemTitle}>
                  {item.href ? (
                    item.href.startsWith('http') ? <a className={cardStyles.textLink} href={item.href} target="_blank" rel="noopener noreferrer">{item.title}</a> : <Link className={cardStyles.textLink} href={item.href}>{item.title}</Link>
                  ) : item.title}
                </h3>
                <div className={cardStyles.chips}><span className={`in-chip ${TAG_CHIP[item.tag]}`}>{item.tag}</span></div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** A month of the organization's dates: events, meetings, votes, deadlines, task due dates and dates found in what members shared. */
export async function CalendarContent({ month: monthParam, day: dayParam }: { month?: string; day?: string } = {}) {
  await requireMember();
  // After the dynamic access above, so the page keeps a static shell.
  const now = new Date();
  const today = todayKey(now);
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? '');
  const year = match ? Number(match[1]) : Number(today.slice(0, 4));
  const month = match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? Number(match[2]) : Number(today.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const selected = dayParam && Number(dayParam) >= 1 && Number(dayParam) <= daysInMonth ? Number(dayParam) : null;

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const items = datedItems(await loadDatedInput(getAdapters(), getDb(), monthStart), { year, month });
  const byDate = new Map<string, DatedItem[]>();
  for (const item of items) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);

  const firstWeekday = monthStart.getUTCDay();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const prev = shift(year, month, -1);
  const next = shift(year, month, 1);
  const prefix = `${year}-${pad(month)}-`;
  const shown = selected ? byDate.get(`${prefix}${pad(selected)}`) ?? [] : items.filter((i) => i.date >= today || !today.startsWith(prefix));
  const tags = Array.from(new Set(items.map((i) => i.tag)));

  return (
    <div className={styles.sections}>
      <div className={`in-glass ${cardStyles.card}`}>
        <div className={calendar.head}>
          <Link className="in-btn in-btn--quiet" href={href(prev.year, prev.month)} scroll={false} aria-label={`Previous month, ${monthLabel(prev.year, prev.month)}`}>‹ {shortMonth(prev.year, prev.month)}</Link>
          <p className={calendar.month}>{monthLabel(year, month)}</p>
          <Link className="in-btn in-btn--quiet" href={href(next.year, next.month)} scroll={false} aria-label={`Next month, ${monthLabel(next.year, next.month)}`}>{shortMonth(next.year, next.month)} ›</Link>
        </div>
        <table className={calendar.grid}>
          <caption className="visually-hidden">{monthLabel(year, month)}</caption>
          <thead>
            <tr>{WEEKDAYS.map((d) => <th key={d} scope="col">{d}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.map((week, w) => (
              <tr key={w}>
                {week.map((day, d) => {
                  if (!day) return <td key={d} />;
                  const date = `${prefix}${pad(day)}`;
                  const dayItems = byDate.get(date) ?? [];
                  return (
                    <td key={d}>
                      <Link
                        className={calendar.cell}
                        href={selected === day ? href(year, month) : href(year, month, day)}
                        scroll={false}
                        aria-current={selected === day ? 'date' : undefined}
                        data-today={date === today ? '' : undefined}
                        aria-label={`${dayHeading(date)}${dayItems.length ? `, ${dayItems.length} item${dayItems.length === 1 ? '' : 's'}` : ''}`}
                      >
                        <span className={calendar.number}>{day}</span>
                        {dayItems.length ? (
                          <span className={calendar.dots} aria-hidden="true">
                            {dayItems.slice(0, DOTS).map((item) => <span key={item.id} className={calendar.dot} data-tag={item.tag} />)}
                            {dayItems.length > DOTS ? <span className={calendar.more}>+{dayItems.length - DOTS}</span> : null}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {tags.length ? (
          <p className={calendar.legend}>
            {tags.map((tag) => <span key={tag}><span className={calendar.dot} data-tag={tag} />{tag}</span>)}
          </p>
        ) : null}
      </div>
      {shown.length ? (
        <Agenda items={shown} />
      ) : (
        <p className={cardStyles.meta}>
          {selected ? `Nothing on ${dayHeading(`${prefix}${pad(selected)}`)}.` : items.length ? 'Nothing else this month.' : 'Nothing on the calendar this month. Dates from meetings, votes, funding and anything members share show up here.'}
        </p>
      )}
    </div>
  );
}
