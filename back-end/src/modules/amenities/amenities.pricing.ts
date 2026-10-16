/** Proportional extension fee in integer INR paise. Round half up, per extension.
 * Always use the reservation's original fee/duration, never an extended total.
 */
export function extensionFeeMinor(
  originalFeeMinor: number,
  originalDurationMinutes: number,
  extensionMinutes: number,
): number {
  if (
    !Number.isSafeInteger(originalFeeMinor) ||
    originalFeeMinor < 0 ||
    !Number.isSafeInteger(originalDurationMinutes) ||
    originalDurationMinutes <= 0 ||
    !Number.isSafeInteger(extensionMinutes) ||
    extensionMinutes < 0
  ) {
    throw new RangeError(
      'Extension pricing requires nonnegative integer paise and whole-minute durations with a positive original duration',
    );
  }
  const numerator = BigInt(originalFeeMinor) * BigInt(extensionMinutes);
  const denominator = BigInt(originalDurationMinutes);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('Extension fee exceeds the safe integer range');
  return Number(rounded);
}
