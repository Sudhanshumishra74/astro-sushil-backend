export const RATTI_STEP = 0.25;

function toQuarterUnits(value) {
  return Math.round(value / RATTI_STEP);
}

export function generateRattiOptions(minRatti, maxRatti) {
  const min = Number(minRatti);
  const max = Number(maxRatti);

  if (!Number.isFinite(min) || min <= 0) return [];

  const safeMax = Number.isFinite(max) && max >= min ? max : min;

  const minUnits = toQuarterUnits(min);
  const maxUnits = toQuarterUnits(safeMax);

  const options = [];
  for (let units = minUnits; units <= maxUnits; units += 1) {
    options.push(Math.round(units * RATTI_STEP * 100) / 100);
  }

  return options;
}

// `outOfStockRattis` lets the admin mark specific values within the range as
// unavailable (e.g. that exact weight sold out) without shrinking
// min/maxRatti for everyone else — same quarter-unit comparison as the range
// check below, so a value that's numerically equal but float-imprecise
// still matches (same reasoning as the rest of this file).
export function isValidRatti(ratti, minRatti, maxRatti, outOfStockRattis = []) {
  const value = Number(ratti);
  const min = Number(minRatti);
  const max = Number(maxRatti);

  if (!Number.isFinite(value) || !Number.isFinite(min)) return false;

  const safeMax = Number.isFinite(max) && max >= min ? max : min;

  if (value < min - 1e-9 || value > safeMax + 1e-9) return false;

  const minUnits = toQuarterUnits(min);
  const valueUnits = toQuarterUnits(value);

  if (Math.abs(value - valueUnits * RATTI_STEP) >= 1e-9 || valueUnits < minUnits) {
    return false;
  }

  const isOutOfStock = (outOfStockRattis || []).some(
    (r) => toQuarterUnits(Number(r)) === valueUnits,
  );

  return !isOutOfStock;
}
