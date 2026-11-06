// A variant (e.g. "Large") can weigh meaningfully more than the product's
// own top-level weight — falls back to the product's weight/dimensions when
// the variant has none set (e.g. it only differs in color, not size).
// Requires `product.variants` to have been populated/selected by the
// caller; silently falls through to the product-level fields otherwise.
function resolveItemWeightAndDims(item) {
  const product = item.product;
  const variant = item.variantId
    ? product?.variants?.find((v) => String(v._id) === String(item.variantId))
    : null;

  // Cascading second level — a sub-variant's own weight/dimensions take
  // priority over its parent variant's, which in turn beats the product's.
  const subVariant = item.subVariantId
    ? variant?.subVariants?.find((sv) => String(sv._id) === String(item.subVariantId))
    : null;

  return {
    weight: subVariant?.weight ?? variant?.weight ?? product?.weight,
    dimensions: subVariant?.dimensions ?? variant?.dimensions ?? product?.dimensions,
  };
}

// Rough packaging estimate from whatever product data exists — there's no
// dedicated packaging/box-config system in this codebase yet, so this sums
// per-item weight (falling back to 0.5kg/unit when a product has none) and
// takes the largest single item's dimensions as a stand-in for the parcel.
// Refine once real packaging data/rules exist.
//
// Split out of fulfillment.service.js so shippingQuote.service.js (a plain
// price calculation, called from cart/checkout code) doesn't have to import
// that file's much heavier graph (Order/Shipment/Return/Razorpay/BullMQ).
export function estimatePackage(items) {
  let weight = 0;
  let dims = { length: 10, width: 10, height: 10 };

  for (const item of items) {
    const { weight: itemWeightG, dimensions: d } = resolveItemWeightAndDims(item);

    // Stored in GRAMS (admin form: "Weight (grams)") — Shiprocket's weight
    // params (serviceability + order create) are KG.
    const unitWeightKg = itemWeightG ? Number(itemWeightG) / 1000 : 0.5;
    weight += unitWeightKg * item.quantity;

    if (d?.length > dims.length) dims.length = d.length;
    if (d?.width > dims.width) dims.width = d.width;
    if (d?.height > dims.height) dims.height = d.height;
  }

  return { weight: weight || 0.5, dims };
}
