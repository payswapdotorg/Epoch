/**
 * Deterministic instant arithmetic over the W036 timestamp grammar
 * (`YYYY-MM-DDTHH:mm:ss.SSSZ`, fixed-width UTC — lexicographic order
 * equals chronological order). Pure integer math on the parsed fields;
 * NO Date object, NO clock reads, NO randomness (the kernel discipline).
 */

const DAY_MS = 86_400_000;

/** Parsed instant fields (all validated by the timestamp grammar upstream). */
interface InstantFields {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

/** Parse a grammar-valid timestamp into its integer fields. */
function parseInstant(value: string): InstantFields {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/.exec(value);
  if (match === null) {
    // Unreachable for schema-validated inputs; kept total anyway.
    return { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 };
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    millisecond: Number(match[7]),
  };
}

/** Days-from-civil algorithm (Howard Hinnant's, integer-exact). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** Convert a grammar-valid timestamp to epoch milliseconds (integer-exact). */
export function instantToEpochMs(value: string): number {
  const fields = parseInstant(value);
  const days = daysFromCivil(fields.year, fields.month, fields.day);
  return (
    days * DAY_MS +
    fields.hour * 3_600_000 +
    fields.minute * 60_000 +
    fields.second * 1_000 +
    fields.millisecond
  );
}

/**
 * The signed difference `a - b` in whole days (truncated toward zero) as
 * a canonical decimal string. Deterministic and exact: no floating point.
 */
export function dayDifference(a: string, b: string): string {
  const difference = instantToEpochMs(a) - instantToEpochMs(b);
  const days = Math.trunc(difference / DAY_MS);
  return days.toString();
}

/**
 * The signed difference `a - b` in whole seconds (truncated toward zero)
 * as a canonical decimal string (escalation-delay arithmetic for hosts).
 */
export function secondDifference(a: string, b: string): string {
  const difference = instantToEpochMs(a) - instantToEpochMs(b);
  return Math.trunc(difference / 1_000).toString();
}

/** Whether `a` is strictly after `b` (chronological comparison). */
export function isAfter(a: string, b: string): boolean {
  return instantToEpochMs(a) > instantToEpochMs(b);
}
