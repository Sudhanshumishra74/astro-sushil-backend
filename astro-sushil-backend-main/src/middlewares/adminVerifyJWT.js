
import { Admin } from "../modules/admin/admin.modal.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
export const adminVerifyJWT = asyncHandler(async (req, res, next) => {
  const token =
  req.header("Authorization")?.replace("Bearer ", "") ||
  req.cookies?.adminAccessToken;
  
  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
   
    
  } catch (error) {
    throw new ApiError(401, "Invalid or expired token");
  }

  const admin = await Admin.findById(decoded?._id).select(
    "-password -refreshToken",
  );

  if (!admin) {
    throw new ApiError(401, "Invalid access token");
  }

  if (!admin.isAdmin) {
    throw new ApiError(403, "Admin access only");
  }

  if (admin.isDeleted) {
    throw new ApiError(403, "This account has been removed");
  }

  if (admin.status === "SUSPENDED") {
    throw new ApiError(403, "Your account is suspended");
  }

  req.user = admin;
  next();
});
