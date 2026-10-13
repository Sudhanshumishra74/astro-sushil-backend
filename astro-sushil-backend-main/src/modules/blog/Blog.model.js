import mongoose from "mongoose";
import slugify from "slugify";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },

    shortDescription: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    tags: [{ type: String }],

   author: {
  name: String,
  avatar: {
    url: String,
    key: String,
  },
},

    thumbnail: {
      url: String,
      key: String,
    },

    images: [
      {
        url: String,
        key: String,
      },
    ],

    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    views: {
      type: Number,
      default: 0,
    },

    publishedAt: Date,
  },
  { timestamps: true }
);


// ✅ FUNCTION: generate unique slug
async function generateUniqueSlug(model, title, currentId = null) {
  let slug = slugify(title, { lower: true, strict: true });

  let existing = await model.findOne({ slug });

  let counter = 1;

  while (existing && existing._id.toString() !== currentId?.toString()) {
    slug = `${slug}-${counter++}`;
    existing = await model.findOne({ slug });
  }

  return slug;
}


// ✅ PRE SAVE (CREATE + UPDATE)
blogSchema.pre("save", async function (next) {
  // slug generate only if title changed OR slug missing
  if (!this.isModified("title") && this.slug) return;

  this.slug = await generateUniqueSlug(
    this.constructor,
    this.title,
    this._id
  );


});



export const Blog = mongoose.model("Blog", blogSchema);