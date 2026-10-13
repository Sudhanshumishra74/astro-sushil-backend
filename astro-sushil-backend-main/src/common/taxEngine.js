const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * totalInclusive already contains the tax. Backs out the base.
 */
export const computeInclusiveTax = (totalInclusive, ratePercent) => {
  const rate = Number(ratePercent) || 0;
  const total = round2(totalInclusive);

  if (!rate) {
    return { rate: 0, base: total, taxAmount: 0, total, type: "inclusive" };
  }

  const base = totalInclusive / (1 + rate / 100);
  const taxAmount = totalInclusive - base;

  return {
    rate,
    base: round2(base),
    taxAmount: round2(taxAmount),
    total,
    type: "inclusive",
  };
};

/**
 * baseAmount excludes tax. Tax is added on top.
 */
export const computeExclusiveTax = (baseAmount, ratePercent) => {
  const rate = Number(ratePercent) || 0;
  const base = round2(baseAmount);

  if (!rate) {
    return { rate: 0, base, taxAmount: 0, total: base, type: "exclusive" };
  }

  const taxAmount = (baseAmount * rate) / 100;
  const total = baseAmount + taxAmount;

  return {
    rate,
    base,
    taxAmount: round2(taxAmount),
    total: round2(total),
    type: "exclusive",
  };
};

/**
 * Dispatches to the inclusive/exclusive calculation based on a gst config
 * object living directly on the item (product/consultation mode/report):
 * { enabled, rate, type }. No global fallback — an item with no gst config
 * (or gst.enabled === false) is treated as untaxed.
 */
export const computeGst = (amount, gst) => {
  const rate = gst?.enabled ? Number(gst.rate) || 0 : 0;
  const type = gst?.type === "inclusive" ? "inclusive" : "exclusive";

  return type === "inclusive"
    ? computeInclusiveTax(amount, rate)
    : computeExclusiveTax(amount, rate);
};
