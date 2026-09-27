/**
 * EXACT decimal-string arithmetic for the actualization folds (the W036
 * `decimal.ts` precedent extended): bigint-scaled, trailing-zero-
 * trimming, canonical output, NEVER float math. Addition is REUSED from
 * @epoch/solution-delivery (the W023 decimal-fold discipline —
 * commutative, so fold totals never depend on input order); the
 * comparison, subtraction, clamped subtraction and multiplication
 * helpers below extend the same discipline for reconciliation deviations
 * and rolling forecasts.
 */
import { addNonNegativeDecimals } from '@epoch/solution-delivery';

export { addNonNegativeDecimals };

/** Split a canonical non-negative decimal into (scaled value, fraction digits). */
function splitDecimal(value: string): [bigint, number] {
  const separator = value.indexOf('.');
  if (separator === -1) {
    return [BigInt(value), 0];
  }
  const fraction = value.slice(separator + 1);
  return [BigInt(value.slice(0, separator) + fraction), fraction.length];
}

/** Join a scaled value and fraction digits back into canonical decimal text. */
function joinDecimal(scaled: bigint, scale: number): string {
  if (scale === 0) {
    return scaled.toString();
  }
  const text = scaled.toString().padStart(scale + 1, '0');
  const integerPart = text.slice(0, -scale);
  let fractionPart = text.slice(-scale);
  fractionPart = fractionPart.replace(/0+$/, '');
  return fractionPart === '' ? integerPart : `${integerPart}.${fractionPart}`;
}

/**
 * EXACT comparison of two canonical non-negative decimals:
 * -1 (a < b), 0 (a === b), 1 (a > b).
 */
export function compareNonNegativeDecimals(a: string, b: string): -1 | 0 | 1 {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  if (aAligned < bAligned) return -1;
  if (aAligned > bAligned) return 1;
  return 0;
}

/** The signed difference of two canonical non-negative decimals. */
export interface SignedDifference {
  /** Whether the difference is negative (b exceeds a). */
  readonly negative: boolean;
  /** The canonical non-negative magnitude of the difference. */
  readonly magnitude: string;
}

/** EXACT signed subtraction: a - b, as sign + canonical magnitude. */
export function subtractNonNegativeDecimals(a: string, b: string): SignedDifference {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  if (aAligned >= bAligned) {
    return { negative: false, magnitude: joinDecimal(aAligned - bAligned, scale) };
  }
  return { negative: true, magnitude: joinDecimal(bAligned - aAligned, scale) };
}

/**
 * EXACT clamped subtraction: max(0, a - b) — the REMAINING quantity of a
 * rolling forecast never goes negative.
 */
export function clampSubtractNonNegativeDecimals(a: string, b: string): string {
  const difference = subtractNonNegativeDecimals(a, b);
  return difference.negative ? '0' : difference.magnitude;
}

/** EXACT multiplication of two canonical non-negative decimals. */
export function multiplyNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  return joinDecimal(aScaled * bScaled, aFraction + bFraction);
}

/**
 * The canonical non-negative decimal rendering of one 0..1 progress
 * fraction (fixed 9-digit scale, trailing zeros trimmed) — the exact
 * bridge from the W036 number-typed progress measure into decimal-string
 * arithmetic WITHOUT float subtraction.
 */
export function decimalFromFraction(fraction: number): string {
  const fixed = fraction.toFixed(9);
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}
