import { sendOtpService, verifyOtpService } from "../../service/otp.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Admin } from "./admin.modal.js";
import { loginAdminSchema } from "./admin.validation.js";
import { buildAdminAuthPayload } from "../role/role.service.js";

export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, username, password } = loginAdminSchema.parse(req.body);

  const admin = await Admin.findOne({
    $or: [{ email }, { username }],
  }).select("+password");

  if (!admin) {
    throw new ApiError(404, "Admin does not exist");
  }

  if (admin.isDeleted) {
    throw new ApiError(403, "This account has been removed");
  }

  if (admin.status === "SUSPENDED") {
    throw new ApiError(403, "Your account is suspended. Contact a Super Admin.");
  }

  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const generateTokens = async (userId) => {
    try {
      const user = await Admin.findById(userId);

      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      user.refreshToken = refreshToken;
      user.loginTime = new Date();
      user.loginHistory.push(user.loginTime);

      await user.save({ validateBeforeSave: false });

      return { accessToken, refreshToken };
    } catch (error) {
      throw new ApiError(500, "Token generation failed");
    }
  };

  const { accessToken, refreshToken } = await generateTokens(admin._id);

  const loggedInUser = await buildAdminAuthPayload(
    await Admin.findById(admin._id).select("-password -refreshToken"),
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };

  return res
    .status(200)
    .cookie("adminAccessToken", accessToken, options)
    .cookie("adminRefreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "Admin logged in successfully",
      ),
    );
});
export const logoutAdmin = async (req, res) => {
  try {
    const adminId = req.user?._id; // ✅ secure way

    if (!adminId) {
      throw new ApiError(401, "Unauthorized");
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw new ApiError(404, "Admin not found");
    }

    admin.loginstatus = false;
    admin.refreshToken = null;

    await admin.save({ validateBeforeSave: false });

    res.clearCookie("adminAccessToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    res.clearCookie("adminRefreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    console.error("Error during logout:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAdminDetails = async (req, res) => {
  try {
    const adminId = req.user?._id;

    if (!adminId) {
      throw new ApiError(401, "Unauthorized");
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      throw new ApiError(404, "Admin not found");
    }

    res.json(
      new ApiResponse(
        200,
        await buildAdminAuthPayload(admin),
        "Admin details retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Error fetching admin details:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateAdmin = asyncHandler(async (req, res) => {
  const adminId = req.user?._id;

  const admin = await Admin.findById(adminId);
  if (!admin) throw new ApiError(404, "Admin not found");

  if (!Object.keys(req.validatedData).length) {
    throw new ApiError(400, "No data provided for update");
  }

  const updates = Object.fromEntries(
    Object.entries(req.validatedData).filter(([_, v]) => v !== undefined),
  );

  Object.assign(admin, updates);

  await admin.save();

  res
    .status(200)
    .json(new ApiResponse(200, await buildAdminAuthPayload(admin), "Admin updated successfully"));
});
export const changePassword = asyncHandler(async (req, res) => {
  const adminId = req.user?._id;
  const { oldPassword, newPassword } = req.validatedData;

  const admin = await Admin.findById(adminId).select("+password"); // ✅ FIX

  if (!admin) throw new ApiError(404, "Admin not found");

  const isMatch = await admin.isPasswordCorrect(oldPassword);

  if (!isMatch) throw new ApiError(400, "Old password is incorrect");

  admin.password = newPassword;
  await admin.save();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Password changed successfully"));
});
export const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier, channel } = req.validatedData;

  const admin = await Admin.findOne({ email: identifier });
  if (!admin) throw new ApiError(404, "Admin not found");

  await sendOtpService({
    identifier,
    type: "RESET",
    channel,
  });

  res.status(200).json(new ApiResponse(200, null, "OTP sent successfully"));
});
export const resetPassword = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.validatedData;
  const { newPassword } = req.body;

  if (!newPassword) {
    throw new ApiError(400, "New password required");
  }

  const admin = await Admin.findOne({ email: identifier });
  if (!admin) throw new ApiError(404, "Admin not found");

  await verifyOtpService({
    identifier,
    otp,
    type: "RESET",
  });

  admin.password = newPassword;
  admin.refreshToken = null;

  await admin.save();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Password reset successfully"));
});
