import { sendOtpService, verifyOtpService } from "../../service/otp.js";
import { uploadFile } from "../../service/UploadAws.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { User } from "./user.modal.js";

const generateUsername = (firstName) => {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${firstName.toLowerCase()}_${random}`;
};

// Builds phone number variants to match both legacy (no country code) and new (E.164) formats.
// e.g. "+919876543210" → ["+919876543210", "919876543210", "9876543210"]
const buildPhoneVariants = (identifier) => {
  const variants = [identifier];
  const digitsOnly = identifier.replace(/\D/g, "");
  if (digitsOnly !== identifier) variants.push(digitsOnly);
  if (digitsOnly.length > 10) variants.push(digitsOnly.slice(-10));
  return [...new Set(variants)];
};

export const register = asyncHandler(async (req, res) => {
  const { email, phoneNumber, firstName } = req.validatedData;

  const existingUser = await User.findOne({
    $or: [{ email }, { phoneNumber: { $in: buildPhoneVariants(phoneNumber) } }],
  });

  if (existingUser && existingUser.isVerified) {
    throw new ApiError(400, "User already exists");
  }

  if (existingUser) {
    // unverified user retrying/resending signup — keep details in sync and resend OTP
    existingUser.firstName = firstName;
    existingUser.email = email;
    existingUser.phoneNumber = phoneNumber;
    await existingUser.save();
  } else {
    const username = generateUsername(firstName);

    await User.create({
      email,
      phoneNumber,
      firstName,
      username,
      isVerified: false,
    });
  }

  await sendOtpService({
    identifier:  phoneNumber || email,
    type: "AUTH",
    channel: phoneNumber ? "PHONE" : "EMAIL",
    purpose: "signup",
    name: firstName,
  });

  res.status(201).json(new ApiResponse(201, null, "OTP sent"));
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, channel } = req.validatedData;

  const phoneVariants = buildPhoneVariants(identifier);
  const user = await User.findOne({
    $or: [{ email: identifier }, { phoneNumber: { $in: phoneVariants } }],
  });

  if (!user) throw new ApiError(404, "User not found");

  await sendOtpService({
    identifier,
    type: "AUTH",
    channel,
    purpose: "login",
    name: user.firstName,
  });

  res.json(new ApiResponse(200, null, "OTP sent for login"));
});

export const verifyAuthOtp = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.validatedData;

  await verifyOtpService({
    identifier,
    otp,
    type: "AUTH",
  });

  const phoneVariants = buildPhoneVariants(identifier);
  const user = await User.findOne({
    $or: [{ email: identifier }, { phoneNumber: { $in: phoneVariants } }],
  });

  if (!user) throw new ApiError(404, "User not found");

  user.isVerified = true;
  await user.save();

  const accessToken = user.generateAccessToken();

  res.json(new ApiResponse(200, { user, accessToken }, "Login successful"));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const updateData = req.validatedData;

  if (updateData.username) {
    const existing = await User.findOne({
      username: updateData.username,
      _id: { $ne: userId },
    });
    if (existing) throw new ApiError(400, "Username already taken");
  }

  if (updateData.phoneNumber) {
    const existing = await User.findOne({
      phoneNumber: updateData.phoneNumber,
      _id: { $ne: userId },
    });
    if (existing) throw new ApiError(400, "Phone already in use");
  }

  if (updateData.email) {
    const existing = await User.findOne({
      email: updateData.email,
      _id: { $ne: userId },
    });
    if (existing) throw new ApiError(400, "Email already in use");
  }

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.json(new ApiResponse(200, user, "Profile updated successfully"));
});

export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { oldPassword, newPassword } = req.validatedData;

  const user = await User.findById(userId).select("+password");

  if (!user) throw new ApiError(404, "User not found");

  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) throw new ApiError(400, "Old password is incorrect");

  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(200, null, "Password changed successfully"));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = req.validatedData;

  const phoneVariants = buildPhoneVariants(identifier);
  const user = await User.findOne({
    $or: [{ email: identifier }, { phoneNumber: { $in: phoneVariants } }],
  });

  if (!user) throw new ApiError(404, "User not found");

  await sendOtpService({
    identifier,
    type: "RESET",
    channel: identifier.includes("@") ? "EMAIL" : "PHONE",
    purpose: "reset",
    name: user.firstName,
  });

  res.json(new ApiResponse(200, null, "OTP sent for password reset"));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { identifier, otp, newPassword } = req.validatedData;

  await verifyOtpService({
    identifier,
    otp,
    type: "RESET",
  });

  const phoneVariants = buildPhoneVariants(identifier);
  const user = await User.findOne({
    $or: [{ email: identifier }, { phoneNumber: { $in: phoneVariants } }],
  }).select("+password");

  if (!user) throw new ApiError(404, "User not found");

  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(200, null, "Password reset successful"));
});

export const updateProfilePhoto = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const updateData = { ...req.validatedData };

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (req.files?.profilePhoto?.[0]) {
    if (user.profilePhotoKey) {
      await deleteFile(user.profilePhotoKey);
    }

    const uploaded = await uploadFile({
      file: req.files.profilePhoto[0],
      staffId: userId,
    });

    updateData.profilePhoto = uploaded.url;
    updateData.profilePhotoKey = uploaded.key;
  }

  if (req.files?.coverPhoto?.[0]) {
    if (user.coverPhotoKey) {
      await deleteFile(user.coverPhotoKey);
    }

    const uploaded = await uploadFile({
      file: req.files.coverPhoto[0],
      staffId: userId,
    });

    updateData.coverPhoto = uploaded.url;
    updateData.coverPhotoKey = uploaded.key;
  }

  if (updateData.username) {
    const existing = await User.findOne({
      username: updateData.username,
      _id: { $ne: userId },
    });
    if (existing) throw new ApiError(400, "Username already taken");
  }

  if (updateData.phoneNumber) {
    const existing = await User.findOne({
      phoneNumber: updateData.phoneNumber,
      _id: { $ne: userId },
    });
    if (existing) throw new ApiError(400, "Phone already in use");
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.json(new ApiResponse(200, updatedUser, "Profile updated successfully"));
});

export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select("-password");

  if (!user) throw new ApiError(404, "User not found");

  res.json(new ApiResponse(200, user, "Profile fetched successfully"));
});
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select("-password");

  if (!user) throw new ApiError(404, "User not found");

  res.json(new ApiResponse(200, user, "User fetched successfully"));
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "", fromDate, toDate } = req.query;

  const query = {
    $or: [
      { email: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
      { firstName: { $regex: search, $options: "i" } },
    ],
  };

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const users = await User.find(query)
    .select("-password")
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  res.json(
    new ApiResponse(200, { users, total }, "Users fetched successfully"),
  );
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);

  if (!user) throw new ApiError(404, "User not found");

  res.json(new ApiResponse(200, null, "User deleted successfully"));
});

export const updateUserByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    username,
    dob,
    gender,
    birthPlace,
    birthTime,
    bio,
    status,
  } = req.body;

  // Build update object — skip empty strings to avoid unique-index conflicts
  const updateData = {};
  const fields = {
    firstName,
    lastName,
    email,
    phoneNumber,
    username,
    dob,
    gender,
    birthPlace,
    birthTime,
    bio,
    status,
  };
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined && val !== "") updateData[key] = val;
  }

  if (updateData.username && updateData.username !== user.username) {
    const taken = await User.findOne({
      username: updateData.username,
      _id: { $ne: id },
    });
    if (taken) throw new ApiError(400, "Username already taken");
  }

  if (updateData.email && updateData.email !== user.email) {
    const taken = await User.findOne({
      email: updateData.email,
      _id: { $ne: id },
    });
    if (taken) throw new ApiError(400, "Email already in use");
  }

  if (updateData.phoneNumber && updateData.phoneNumber !== user.phoneNumber) {
    const taken = await User.findOne({
      phoneNumber: updateData.phoneNumber,
      _id: { $ne: id },
    });
    if (taken) throw new ApiError(400, "Phone number already in use");
  }

  const updated = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.json(new ApiResponse(200, updated, "Customer updated successfully"));
});
