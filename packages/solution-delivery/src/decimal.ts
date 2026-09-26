/**
 * EXACT decimal-string arithmetic (non-negative canonical decimals only):
 * bigint-scaled, trailing-zero-trimming, canonical output. Deterministic
 * and commutative — fold totals never depend on input order (the W023
 * decimal-fold discipline).
 */

/** Split a canonical non-negative decimal into (scaled value, fraction digits). */
function splitDecimal(value: string): [bigint, number] {
  const separator = value.indexOf('.');
  if (separator === -1) {
    return [BigInt(value), 0];
  }
  const fraction = value.slice(separator + 1);
  return [BigInt(value.slice(0, separator) + fraction), fraction.length];
}

/**
 * EXACT decimal-string addition: bigint-scaled, trailing-zero-trimming,
 * canonical output.
 */
export function addNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  const sum = aAligned + bAligned;
  if (scale === 0) {
    return sum.toString();
  }
  const text = sum.toString().padStart(scale + 1, '0');
  const integerPart = text.slice(0, -scale);
  let fractionPart = text.slice(-scale);
  fractionPart = fractionPart.replace(/0+$/, '');
  return fractionPart === '' ? integerPart : `${integerPart}.${fractionPart}`;
}
