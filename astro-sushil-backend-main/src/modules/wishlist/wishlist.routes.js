import express from "express";


import { toggleWishlist,  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist, } from "./wishlist.controller.js";
import { verifyToken } from "../../middlewares/verifyToken.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", getWishlist);
router.post("/add", addToWishlist);
router.post("/toggle", toggleWishlist);
router.post("/remove", removeFromWishlist);
router.delete("/clear", clearWishlist);

export default router;
