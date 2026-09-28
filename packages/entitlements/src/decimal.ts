/**
 * EXACT decimal-string arithmetic for billing money and quantities
 * (non-negative canonical decimals only, the W023/W036 convention:
 * /^(0|[1-9][0-9]*)(\.[0-9]+)?$/ — no exponent, no sign).
 *
 * bigint-scaled, trailing-zero-trimming, canonical output. Deterministic
 * and commutative — line amounts and invoice totals never depend on
 * operation order. Addition is RE-EXPORTED from @epoch/marketplace (the
 * one authority for the shared decimal fold discipline); multiplication
 * and clamped subtraction are billing-specific and live here.
 */
import { addNonNegativeDecimals } from '@epoch/marketplace';

export { addNonNegativeDecimals };

/** Split one canonical decimal into (scaled integer value, fraction scale). */
function splitDecimal(value: string): [bigint, number] {
  const dot = value.indexOf('.');
  if (dot === -1) {
    return [BigInt(value), 0];
  }
  const fractionPart = value.slice(dot + 1);
  return [BigInt(`${value.slice(0, dot)}${fractionPart}`), fractionPart.length];
}

/** Render one scaled integer at the given fraction scale, canonically. */
function renderScaled(scaled: bigint, scale: number): string {
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
 * EXACT decimal-string multiplication (non-negative canonical decimals
 * only): quantity x unit amount -> canonical product. Deterministic;
 * trailing zeros trimmed so identical inputs always produce the identical
 * canonical string (digest-stable).
 */
export function multiplyNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aScale] = splitDecimal(a);
  const [bScaled, bScale] = splitDecimal(b);
  return renderScaled(aScaled * bScaled, aScale + bScale);
}

/**
 * EXACT decimal-string subtraction clamped at zero (non-negative
 * canonical decimals only): max(0, a - b). Used for metered-usage
 * billing (billable units = total units minus the included allowance,
 * never below zero).
 */
export function subtractNonNegativeDecimalsClamped(a: string, b: string): string {
  const [aScaled, aScale] = splitDecimal(a);
  const [bScaled, bScale] = splitDecimal(b);
  const scale = Math.max(aScale, bScale);
  const aAligned = aScaled * 10n ** BigInt(scale - aScale);
  const bAligned = bScaled * 10n ** BigInt(scale - bScale);
  const difference = aAligned - bAligned;
  if (difference <= 0n) {
    return '0';
  }
  return renderScaled(difference, scale);
}

/**
 * Canonicalize one non-negative decimal string (trailing-zero trimming,
 * bare-integer normalization). The canonical form is what every arithmetic
 * helper emits; admission comparisons use it so semantically-equal amounts
 * ('2400.00' vs '2400') never masquerade as arithmetic violations.
 */
export function canonicalDecimalString(value: string): string {
  const [scaled, scale] = splitDecimal(value);
  return renderScaled(scaled, scale);
}

/** Exact decimal comparison: -1 if a < b, 0 if equal, 1 if a > b. */
export function compareNonNegativeDecimals(a: string, b: string): -1 | 0 | 1 {
  const [aScaled, aScale] = splitDecimal(a);
  const [bScaled, bScale] = splitDecimal(b);
  const scale = Math.max(aScale, bScale);
  const aAligned = aScaled * 10n ** BigInt(scale - aScale);
  const bAligned = bScaled * 10n ** BigInt(scale - bScale);
  if (aAligned < bAligned) return -1;
  if (aAligned > bAligned) return 1;
  return 0;
}
