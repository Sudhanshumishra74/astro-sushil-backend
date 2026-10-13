import mongoose from "mongoose";
import slugify from "slugify";
import { computeGst } from "../../common/taxEngine.js";

const variantSchema = new mongoose.Schema({
  name: String,
  value: String,
  price: Number,
  mrp: Number,
  priceWithGst: Number,
  stock: Number,
  metaTitle: String,
  metaDescription: String,
  downloadableFile: {
    type: String,
    // select: false,
    default: null,
  }
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
    sku: String,

    variants: [variantSchema],

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
  },
  { timestamps: true },
);

productSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
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

      return {
        ...v.toObject(),
        mrp,
        price: finalPrice,
        priceWithGst: computeGst(finalPrice, this.gst).total,
      };
    });
  }
});

export const Product = mongoose.model("Product", productSchema);
