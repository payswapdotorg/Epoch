/**
 * EXACT decimal-string arithmetic for supervision measures (the W036
 * decimal discipline, extended with comparison, subtraction and
 * multiplication — all bigint-scaled, trailing-zero-trimming, canonical
 * output). Deterministic: identical inputs produce identical strings;
 * fold order never leaks.
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

/** Render a scaled bigint at a fraction scale, trimming trailing zeros. */
function render(scaled: bigint, scale: number): string {
  if (scale === 0) {
    return scaled.toString();
  }
  const text = scaled.toString().padStart(scale + 1, '0');
  const integerPart = text.slice(0, -scale);
  let fractionPart = text.slice(-scale);
  fractionPart = fractionPart.replace(/0+$/, '');
  return fractionPart === '' ? integerPart : `${integerPart}.${fractionPart}`;
}

/** EXACT non-negative decimal addition (the W036 helper, mirrored locally). */
export function addNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  return render(aAligned + bAligned, scale);
}

/** EXACT non-negative decimal comparison (-1 | 0 | 1). */
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

/** EXACT non-negative decimal subtraction; negative results clamp to '0'. */
export function subtractNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  if (aAligned <= bAligned) {
    return '0';
  }
  return render(aAligned - bAligned, scale);
}

/** EXACT non-negative decimal multiplication. */
export function multiplyNonNegativeDecimals(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  return render(aScaled * bScaled, aFraction + bFraction);
}

/**
 * EXACT signed decimal subtraction `a - b` over canonical non-negative
 * operands, rendered with a leading '-' when negative (used for anomaly
 * variance magnitudes; canonical signed output, trailing-zero-trimmed).
 */
export function signedDecimalSubtraction(a: string, b: string): string {
  const [aScaled, aFraction] = splitDecimal(a);
  const [bScaled, bFraction] = splitDecimal(b);
  const scale = Math.max(aFraction, bFraction);
  const aAligned = aScaled * 10n ** BigInt(scale - aFraction);
  const bAligned = bScaled * 10n ** BigInt(scale - bFraction);
  if (aAligned < bAligned) {
    return `-${render(bAligned - aAligned, scale)}`;
  }
  return render(aAligned - bAligned, scale);
}
