import { describe, it, expect } from 'vitest';
import { weekBounds } from '../src/feed/week';

describe('weekBounds', () => {
  it('runs Monday 00:00 to Monday 00:00 in America/Chicago', () => {
    const { from, to } = weekBounds(new Date('2026-10-24T15:00:00Z'));
    expect(from.toISOString()).toBe('2026-10-19T05:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-26T05:00:00.000Z');
  });

  it('ends on the CST Monday across the DST change', () => {
    const { from, to } = weekBounds(new Date('2026-10-28T12:00:00Z'));
    expect(from.toISOString()).toBe('2026-10-26T05:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-02T06:00:00.000Z');
  });

  it('treats Monday just after local midnight as the start of a new week', () => {
    const { from } = weekBounds(new Date('2026-10-26T05:30:00Z'));
    expect(from.toISOString()).toBe('2026-10-26T05:00:00.000Z');
  });

  it('treats Sunday late evening local time as the end of the week', () => {
    // 2026-10-26T04:30Z is Sunday 23:30 in Chicago.
    const { from, to } = weekBounds(new Date('2026-10-26T04:30:00Z'));
    expect(from.toISOString()).toBe('2026-10-19T05:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-26T05:00:00.000Z');
  });

  it('accepts another time zone', () => {
    const { from, to } = weekBounds(new Date('2026-10-24T15:00:00Z'), 'UTC');
    expect(from.toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });
});
