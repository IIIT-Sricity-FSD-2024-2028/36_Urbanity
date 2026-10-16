import { extensionFeeMinor } from './amenities.pricing';

describe('proportional extension pricing (integer paise, half up)', () => {
  it.each([
    [0, 120, 60, 0],
    [50000, 120, 60, 25000],
    [50000, 120, 30, 12500],
    [1, 2, 1, 1],
    [1, 3, 1, 0],
    [2, 3, 1, 1],
    [100000000, 3, 2, 66666667],
  ])(
    'prices %i paise over %i minutes with %i extra minutes as %i paise',
    (fee, original, added, expected) => {
      expect(extensionFeeMinor(fee, original, added)).toBe(expected);
    },
  );
  it.each([
    [-1, 120, 60],
    [1.5, 120, 60],
    [50000, 0, 60],
    [50000, 120, -1],
    [50000, 120, 0.5],
    [Number.NaN, 120, 60],
    [Number.MAX_SAFE_INTEGER, 1, 2],
  ])(
    'rejects invalid or unsafe currency/duration input',
    (fee, original, added) => {
      expect(() => extensionFeeMinor(fee, original, added)).toThrow(RangeError);
    },
  );
});
