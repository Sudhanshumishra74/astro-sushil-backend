import express from "express";
import Cart from "./cart.modal.js";
import { addToCart, applyCoupon, clearCart, getCart, removeItem, updateCart } from "./cart.controler.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { adminVerifyJWT } from "../../middlewares/adminVerifyJWT.js";

const router = express.Router();



router.get("/",verifyToken, getCart);
router.post("/add",verifyToken, addToCart);
router.put("/update",verifyToken, updateCart);
router.delete("/remove",verifyToken, removeItem);
router.post("/coupon",verifyToken, applyCoupon);
router.delete("/clear", verifyToken,clearCart);

router.use(adminVerifyJWT);

router.get(
  "/admin/all",
  adminVerifyJWT, 
  asyncHandler(async (req, res) => {
    const carts = await Cart.find().populate("user");
    res.json(new ApiResponse(200, carts));
  })
);
export default router;
