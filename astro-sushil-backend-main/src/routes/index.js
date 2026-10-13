import express from "express";
import adminRoutes from "../modules/admin/admin.routes.js";
import authRoutes from "../modules/auth/user.routes.js";
import bannerRoutes from "../modules/Banner/banner.routes.js";
import courseRoutes from "../modules/Course/course.routes.js";
import categoryRoutes from "../modules/category/category.routes.js";
import productRoutes from "../modules/products/product.routes.js";
import blogRoutes from "../modules/blog/blog.routes.js";
import cartRoutes from "../modules/cart/cart.routes.js";
import wishlistRoutes from "../modules/wishlist/wishlist.routes.js";
import addressRoutes from "../modules/Address/address.routes.js";
import contactRoutes from "../modules/Contact/contact.routes.js";
import testimonialRoutes from "../modules/Testimonial/testimonial.routes.js";
import couponRoutes from "../modules/coupon/coupon.routes.js";
import seoRoutes from "../modules/seo/seo.route.js";
import consultation from "../modules/consultation/consultation.routes.js";
import settings from "../modules/Setting/settings.routes.js";
import faq from "../modules/FAQ/faq.routes.js";
import mediaRoutes from "../modules/Media/Media.routes.js";
import availabilityRoutes from "../modules/availability/availability.routes.js";
import bookingRoutes from "../modules/booking/booking.routes.js";
import orderRoutes from "../modules/Order/order.routes.js";
import downloadRoutes from "../modules/Download/download.routes.js";
import transactionRoutes from "../modules/Transaction/Transaction.routes.js";
import astrologyRoutes from "../modules/Astrology/astrology.routes.js";
import reportRoutes from "../modules/Reports/report.routes.js";
import utilsRoutes from "../modules/Utils/utils.routes.js";
import roleRoutes from "../modules/role/role.routes.js";
import permissionRoutes from "../modules/permission/permission.routes.js";
import { razorpayWebhook } from "../webhooks/razorpay.js";

const router = express.Router();

router.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

router.use(express.json({ limit: "10mb" }));
router.use(express.urlencoded({ extended: true, limit: "10mb" }));

router.use("/admin", adminRoutes);
router.use("/auth", authRoutes);
router.use("/address", addressRoutes);
router.use("/banners", bannerRoutes);
router.use("/blogs", blogRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/courses", courseRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/coupons", couponRoutes);
router.use("/inquiry", contactRoutes);
router.use("/testimonial", testimonialRoutes);
router.use("/seo", seoRoutes);
router.use("/consultation", consultation);
router.use("/availability", availabilityRoutes);
router.use("/booking", bookingRoutes);
router.use("/orders", orderRoutes);
router.use("/downloads", downloadRoutes);
router.use("/transactions", transactionRoutes);
router.use("/settings", settings);
router.use("/faqs", faq);
router.use("/media", mediaRoutes);
router.use("/astrology", astrologyRoutes);
router.use("/report", reportRoutes);
router.use("/utils", utilsRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);

export default router;
