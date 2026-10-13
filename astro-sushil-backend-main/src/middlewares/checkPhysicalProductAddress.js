import Cart from "../modules/cart/cart.modal.js";
import {Product} from "../modules/products/product.modal.js";
import { ApiError } from "../utils/ApiError.js";

export const checkPhysicalProductAddress = async (req, res, next) => {
  const { addressId } = req.body;

  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart || !cart.items.length) {
    throw new ApiError(400, "Cart is empty");
  }

  let hasPhysicalProduct = false;

  for (const item of cart.items) {
    const product = await Product.findById(item.product).select("type");

    if (product?.type === "physical") {
      hasPhysicalProduct = true;
      break;
    }
  }

  if (hasPhysicalProduct && !addressId) {
    throw new ApiError(
      400,
      "Address is required for physical products"
    );
  }

  next();
};