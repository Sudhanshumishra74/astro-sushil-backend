import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Order } from "../Order/order.model.js";
import { Product } from "../products/product.modal.js";
import { Download } from "./download.model.js";

export const createDownloadsFromOrder = async (orderId) => {
  console.log("📦 download job started:", orderId);

  const order = await Order.findById(orderId).lean();

  if (!order) {
    console.log("❌ Order not found");
    return;
  }

  for (const item of order.items || []) {
    const product = await Product.findById(item.product)
      .select(
        "name type thumbnail images variants.downloadableFile variants.name variants.value variants._id",
      )
      .lean();

    if (!product || product.type !== "digital") continue;

    const variant = product.variants?.find(
      (v) => String(v._id) === String(item.variantId),
    );

    if (!variant?.downloadableFile) continue;

    await Download.findOneAndUpdate(
      {
        user: order.user,
        order: order._id,
        product: product._id,
        variantId: variant._id,
      },
      {
        user: order.user,
        order: order._id,
        product: product._id,
        variantId: variant._id,
        productName: product.name,
        variantName: variant.value || variant.name,
        file: variant.downloadableFile,
        thumbnail: product.thumbnail || product.images?.[0] || null,
      },
      { upsert: true, new: true },
    );
  }
};

export const getMyDownloads = asyncHandler(async (req, res) => {
  const downloads = await Download.find({
    user: req.user._id,
  })
    .populate("product", "name slug")
    .sort({ createdAt: -1 });

  return res.json(
    new ApiResponse(200, downloads, "Downloads fetched successfully"),
  );
});

export const downloadFile = asyncHandler(async (req, res) => {
  const download = await Download.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!download) {
    throw new ApiError(404, "Download not found");
  }

  download.totalDownloads += 1;

  await download.save();

  return res.json(
    new ApiResponse(
      200,
      {
        file: download.file,
      },
      "File fetched successfully",
    ),
  );
});
