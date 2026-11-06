import mongoose from "mongoose";
import slugify from "slugify";
import { computeGst } from "../../common/taxEngine.js";

const subVariantSchema = new mongoose.Schema({
  name: String,
  value: String,
  price: Number,
  mrp: Number,
  priceWithGst: Number,
  stock: Number,

  // Set once a low-stock admin email has been sent for this sub-variant
  // (see notification.worker.js's low-stock cron), cleared again once
  // stock is topped back up above the threshold — so a restock re-arms
  // the alert instead of it staying silenced forever.
  lowStockNotifiedAt: { type: Date, default: null },

  // Same convention as variantSchema.weight/dimensions below.
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
  },
});

const variantSchema = new mongoose.Schema({
  name: String,
  value: String,
  price: Number,
  mrp: Number,
  priceWithGst: Number,
  stock: Number,
  lowStockNotifiedAt: { type: Date, default: null },
  metaTitle: String,
  metaDescription: String,
  downloadableFile: {
    type: String,
    // select: false,
    default: null,
  },

  // Grams, same convention as the product-level `weight` below — a variant
  // like "Large" can weigh meaningfully more than "Small", which the
  // top-level product.weight alone can't express. Falls back to
  // product.weight (see estimatePackage) when not set, e.g. for
  // variants that only differ in color/material, not size/weight.
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
  },

  // Cascading second level — e.g. variant "Color: Red" narrows down to
  // sub-variants "Size: S"/"Size: M". Once a variant has any sub-variants
  // it becomes a pure grouping label; the customer must pick a leaf
  // sub-variant to buy (see product.controller.js/cart/order resolution).
  subVariants: { type: [subVariantSchema], default: [] },
});

const certificateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, default: 0 }, // extra charge if not includedInPrice
  includedInPrice: { type: Boolean, default: false },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    hasVariants: { type: Boolean, default: false },

    shortDescription: String,
    description: String,

    type: {
      type: String,
      enum: ["physical", "digital", "service"],
      default: "physical",
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    images: [String],
    thumbnail: String,
    // Up to 2 preview videos (enforced in product.validatin.js's
    // productSchemaZod and product.controller.js's updateProduct) — plural
    // since a product can now show more than one.
    videos: { type: [String], default: [] },

    // downloadableFile: {
    //   type: String,
    //   select: false,
    // },

    price: Number,

    mrp: { type: Number, default: 0 },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },

    discountValue: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    stock: { type: Number, default: 0 },
    // See subVariantSchema.lowStockNotifiedAt above — same dedupe convention,
    // just for a simple (non-variant) product's own top-level stock.
    lowStockNotifiedAt: { type: Date, default: null },
    sku: String,

    variants: [variantSchema],

    // Optional lab/authenticity certificates a customer can pick one of at
    // add-to-cart time (see cart.modal.js's certificateId/certificatePrice
    // snapshot) — gated site-wide by Setting.product.certificatesEnabled.
    certificates: { type: [certificateSchema], default: [] },

    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },

    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },

    metaTitle: String,
    metaDescription: String,
    keywords: [String],

    isFeatured: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },

    isPublished: { type: Boolean, default: true },

    gst: {
      enabled: { type: Boolean, default: true },
      rate: { type: Number, default: 0, min: 0, max: 100 },
      type: {
        type: String,
        enum: ["inclusive", "exclusive"],
        default: "exclusive",
      },
    },
    priceWithGst: { type: Number, default: 0 },

    source: {
      type: String,
      enum: ["internal"],
      default: "internal",
    },

    // Gemstones are priced per ratti rather than as a flat unit — the
    // customer picks a weight (see src/utils/ratti.js's generateRattiOptions)
    // and the line price scales with it. Mutually exclusive with
    // hasVariants (enforced in product.validatin.js and below): a gemstone
    // product has no variants of its own, ratti IS the selection. mrp/price
    // below double as "per 1 ratti" MRP/discounted-price once soldByRatti is
    // set — see the pre-save hook — so the existing discount/GST math needs
    // no separate code path; callers just multiply by the selected ratti.
    soldByRatti: { type: Boolean, default: false },
    pricePerRatti: { type: Number, default: null },
    minRatti: { type: Number, default: 1 },
    maxRatti: { type: Number, default: null },

    // Specific weights within [minRatti, maxRatti] the admin has marked
    // sold out — everything else in the range stays purchasable. Checked by
    // utils/ratti.js's isValidRatti (cart/order add both gate on it).
    outOfStockRattis: { type: [Number], default: [] },
  },
  { timestamps: true },
);

productSchema.pre("save", function () {
  if (!this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  // Auto-generated rather than admin-entered — a readable prefix from the
  // product name (so it's still recognizable in warehouse/export contexts)
  // plus a timestamp+random suffix, which makes collisions astronomically
  // unlikely without needing a separate atomic counter document. Only fires
  // when no sku is already set, so an existing product's sku is never
  // silently regenerated on a later save.
  if (!this.sku) {
    const prefix =
      (this.name || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4) || "PRD";
    const suffix = (
      Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)
    ).toUpperCase();
    this.sku = `${prefix}-${suffix}`;
  }

  if (this.soldByRatti) {
    this.hasVariants = false;
    this.variants = [];
    this.minRatti = Number(this.minRatti) || 1;
    this.maxRatti = Math.max(Number(this.maxRatti) || this.minRatti, this.minRatti);
    // `mrp` becomes "MRP per 1 ratti" — the block below (already handling
    // the !hasVariants case) computes `price`/`priceWithGst` off it exactly
    // as it would for a plain product, so a per-ratti line price is always
    // just `product.price * selectedRatti` at the call site.
    this.mrp = Number(this.pricePerRatti) || 0;
  }

  this.mrp = Number(this.mrp) || 0;
  this.discountValue = Number(this.discountValue) || 0;

  if (!this.hasVariants) {
    let finalPrice = this.mrp;

    if (this.mrp > 0) {
      if (this.discountType === "percentage") {
        this.discount = this.discountValue;
        finalPrice = Math.round(
          this.mrp - (this.mrp * this.discountValue) / 100,
        );
      }

      if (this.discountType === "fixed") {
        finalPrice = this.mrp - this.discountValue;
        this.discount = Math.round((this.discountValue / this.mrp) * 100);
      }

      if (!this.discountValue) {
        finalPrice = this.mrp;
        this.discount = 0;
      }
    }

    if (finalPrice < 0) finalPrice = 0;

    this.price = finalPrice;
    this.priceWithGst = computeGst(finalPrice, this.gst).total;
  }

  if (this.hasVariants && this.variants.length > 0) {
    this.price = null;
    this.mrp = null;
    this.priceWithGst = null;

    this.variants = this.variants.map((v) => {
      const mrp = Number(v.mrp) || 0;

      let finalPrice = mrp;

      if (this.discountType === "percentage") {
        finalPrice = Math.round(mrp - (mrp * this.discountValue) / 100);
      }

      if (this.discountType === "fixed") {
        finalPrice = mrp - this.discountValue;
      }

      if (!this.discountValue) {
        finalPrice = mrp;
      }

      if (finalPrice < 0) finalPrice = 0;

      const subVariants = (v.subVariants || []).map((sv) => {
        const svMrp = Number(sv.mrp) || 0;

        let svFinalPrice = svMrp;

        if (this.discountType === "percentage") {
          svFinalPrice = Math.round(svMrp - (svMrp * this.discountValue) / 100);
        }

        if (this.discountType === "fixed") {
          svFinalPrice = svMrp - this.discountValue;
        }

        if (!this.discountValue) {
          svFinalPrice = svMrp;
        }

        if (svFinalPrice < 0) svFinalPrice = 0;

        return {
          ...(sv.toObject ? sv.toObject() : sv),
          mrp: svMrp,
          price: svFinalPrice,
          priceWithGst: computeGst(svFinalPrice, this.gst).total,
        };
      });

      return {
        ...v.toObject(),
        mrp,
        price: finalPrice,
        priceWithGst: computeGst(finalPrice, this.gst).total,
        subVariants,
      };
    });
  }
});

export const Product = mongoose.model("Product", productSchema);
