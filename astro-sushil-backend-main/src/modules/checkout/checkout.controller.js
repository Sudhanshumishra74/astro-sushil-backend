import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import Cart from "../cart/cart.modal.js";
import Address from "../Address/address.model.js";
import { Product } from "../products/product.modal.js";
import Setting from "../Setting/Setting.model.js";
import { calculateCart } from "../../common/priceengine.js";
import { resolveSelfShippingCost } from "../Fulfillment/shippingQuote.service.js";

const BLOCKED_MESSAGE =
  "We can't ship physical items to this address yet — please choose a different delivery address.";

/**
 * Single read endpoint for the checkout page — cart totals, addresses,
 * which one is selected, whether COD is available, and the live
 * Shiprocket-quoted shipping charge for that address, all in one call
 * instead of the frontend orchestrating /cart + /settings + /address +
 * a shipping-quote call itself (and re-implementing "which address is the
 * default" along the way). Never mutates anything — `resolveSelfShippingCost`
 * and `calculateCart` are the exact same functions createOrder uses to
 * actually charge the order, just run here against a `.toObject()` clone,
 * so what this shows is guaranteed to match what placing the order charges.
 */
export const getCheckoutInfo = asyncHandler(async (req, res) => {
  const { addressId } = req.query;
  const paymentMethod = req.query.paymentMethod === "cod" ? "cod" : "razorpay";

  const [cartDoc, addresses, settings] = await Promise.all([
    Cart.findOne({ user: req.user._id }),
    // Already sorted default-first, then most recent — addresses[0] alone
    // is "the default, or the most recent if none is set", same rule the
    // frontend used to re-implement itself.
    Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 }),
    Setting.findOne().select("payment.codEnabled shipping.displayMode").lean(),
  ]);

  const shippingDisplayMode = settings?.shipping?.displayMode || "merged";

  if (!cartDoc || !cartDoc.items.length) {
    const codEnabled = settings?.payment?.codEnabled ?? true;
    return res.json(
      new ApiResponse(200, {
        cart: {
          items: [],
          subTotal: 0,
          discount: 0,
          tax: 0,
          shipping: 0,
          selfShippingAmount: 0,
          totalAmount: 0,
          couponCode: null,
        },
        hasPhysicalProduct: false,
        hasSelfItem: false,
        addresses,
        selectedAddressId: null,
        codEnabled,
        shippingDisplayMode,
        shippingQuote: null,
        blocked: false,
        blockedMessage: null,
      }, "Checkout info fetched"),
    );
  }

  const selectedAddressId =
    (addressId && addresses.some((a) => String(a._id) === String(addressId)))
      ? String(addressId)
      : addresses[0]?._id
        ? String(addresses[0]._id)
        : null;

  const selectedAddress = selectedAddressId
    ? addresses.find((a) => String(a._id) === selectedAddressId)
    : null;

  // Same enrichment getCart (cart.controler.js) already does — needed here
  // independently since this response builds its own cart summary rather
  // than delegating to that handler.
  const products = await Product.find(
    { _id: { $in: cartDoc.items.map((item) => item.product) } },
    { _id: 1, type: 1 },
  );
  const productTypeMap = new Map(products.map((p) => [String(p._id), p.type]));
  const hasPhysicalProduct = cartDoc.items.some(
    (item) => (productTypeMap.get(String(item.product)) || "physical") === "physical",
  );
  // Every physical item is self-fulfilled now — lets the frontend decide
  // whether to show a self-fulfilled shipping line at all when
  // shippingDisplayMode is "separate", without re-deriving it from per-item
  // product type itself.
  const hasSelfItem = hasPhysicalProduct;

  // COD only makes sense when there's an actual delivery event to collect
  // cash at — a digital item has none, and createOrder marks a COD order
  // "confirmed" (downloads unlocked) immediately, so allowing COD here
  // would hand over the digital item with no payment ever collected.
  // Mirrors the same guard createOrder enforces server-side.
  const hasDigitalProduct = cartDoc.items.some(
    (item) => productTypeMap.get(String(item.product)) === "digital",
  );
  const codEnabled = (settings?.payment?.codEnabled ?? true) && !hasDigitalProduct;

  let quote = null;
  if (hasPhysicalProduct && selectedAddress) {
    quote = await resolveSelfShippingCost({
      items: cartDoc.items,
      deliveryPincode: selectedAddress.pincode,
      cod: paymentMethod === "cod" ? 1 : 0,
    });
  }

  const blocked = quote?.source === "unserviceable";

  const preview = cartDoc.toObject();
  await calculateCart(preview, req.user._id, { selfShippingCost: blocked ? null : quote?.amount });

  res.json(
    new ApiResponse(200, {
      cart: {
        items: preview.items,
        subTotal: preview.subTotal,
        discount: preview.discount,
        tax: preview.tax,
        shipping: preview.shipping,
        selfShippingAmount: preview.selfShippingAmount,
        totalAmount: preview.totalAmount,
        couponCode: preview.couponCode || null,
      },
      hasPhysicalProduct,
      hasSelfItem,
      addresses,
      selectedAddressId,
      codEnabled,
      shippingDisplayMode,
      shippingQuote:
        quote && !blocked ? { source: quote.source, courierName: quote.courierName || null, etd: quote.etd || null } : null,
      blocked,
      blockedMessage: blocked ? BLOCKED_MESSAGE : null,
    }, "Checkout info fetched"),
  );
});
