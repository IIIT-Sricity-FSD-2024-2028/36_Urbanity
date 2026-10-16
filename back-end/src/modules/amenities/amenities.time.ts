import { BadRequestException } from '@nestjs/common';

export const clockMinutes = (s: string) =>
  Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
export function instant(text: string) {
  const match =
    /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      text,
    );
  const value = Date.parse(text);
  if (
    !match ||
    !validDate(match[1]) ||
    !Number.isFinite(value) ||
    value % 60000
  ) {
    throw new BadRequestException(
      'Use real dates and whole-minute ISO timestamps with an explicit time zone',
    );
  }
  return value;
}
const formatters = new Map<string, Intl.DateTimeFormat>();
export function localParts(value: number, timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
      timeZoneName: 'shortOffset',
    });
    formatters.set(timeZone, formatter);
  }
  const p = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minute: Number(p.hour) * 60 + Number(p.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      p.weekday,
    ),
    label: `${p.hour}:${p.minute} ${p.timeZoneName}`,
  };
}
// Enumerate real instants rather than guessing a UTC offset. This skips DST gaps
// and preserves both occurrences of a repeated local time with distinct offsets.
export function dayInstants(
  date: string,
  timeZone: string,
  opensAt: string,
  closesAt: string,
  interval: number,
) {
  if (!validDate(date))
    throw new BadRequestException('Use a valid calendar date');
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const open = clockMinutes(opensAt),
    close = clockMinutes(closesAt);
  const result: number[] = [];
  for (
    let t = midnight - 14 * 3600000;
    t <= midnight + 38 * 3600000;
    t += 60000
  ) {
    const p = localParts(t, timeZone);
    if (
      p.date === date &&
      p.minute >= open &&
      p.minute <= close &&
      (p.minute - open) % interval === 0
    )
      result.push(t);
  }
  return result;
}
