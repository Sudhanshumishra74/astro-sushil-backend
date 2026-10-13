import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { Admin } from "./admin.modal.js";
import { Role } from "../role/role.model.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const STAFF_PROJECTION = "-password -refreshToken";

const assertNotSelf = (req, targetId, verb) => {
  if (String(req.user._id) === String(targetId)) {
    throw new ApiError(400, `You cannot ${verb} your own account`);
  }
};

const assertCanTouchSuperAdmin = (req, targetAdmin) => {
  if (targetAdmin.role?.isSuperAdmin && !req.rbac?.isSuperAdmin) {
    throw new ApiError(403, "Only a Super Admin can modify another Super Admin's account");
  }
};

const assertCanAssignRole = (req, role) => {
  if (role.isSuperAdmin && !req.rbac?.isSuperAdmin) {
    throw new ApiError(403, "Only a Super Admin can assign the Super Admin role");
  }
};

const assertNotLastSuperAdmin = async (targetAdmin) => {
  if (!targetAdmin.role?.isSuperAdmin) return;

  const activeSuperAdminCount = await Admin.countDocuments({
    role: targetAdmin.role._id,
    status: "ACTIVE",
    isDeleted: { $ne: true },
  });

  if (activeSuperAdminCount <= 1) {
    throw new ApiError(403, "Cannot modify the last remaining Super Admin account");
  }
};

export const getStaff = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || "";
  const skip = (page - 1) * limit;

  const query = { isDeleted: { $ne: true } };

  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    query.$or = [{ fullName: rx }, { email: rx }, { username: rx }];
  }
  if (req.query.role) query.role = req.query.role;
  if (req.query.status) query.status = req.query.status;

  const [staff, total] = await Promise.all([
    Admin.find(query)
      .select(STAFF_PROJECTION)
      .populate("role", "name slug isSuperAdmin status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Admin.countDocuments(query),
  ]);

  res.json(
    new ApiResponse(200, staff, "Staff fetched", {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }),
  );
});

export const getStaffById = asyncHandler(async (req, res) => {
  const staff = await Admin.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    .select(STAFF_PROJECTION)
    .populate("role", "name slug isSuperAdmin status");

  if (!staff) throw new ApiError(404, "Staff account not found");

  res.json(new ApiResponse(200, staff, "Staff account fetched"));
});

export const createStaff = asyncHandler(async (req, res) => {
  const { roleId, ...data } = req.validatedData;

  const [existingEmail, existingUsername] = await Promise.all([
    Admin.findOne({ email: data.email }),
    Admin.findOne({ username: data.username }),
  ]);
  if (existingEmail) throw new ApiError(400, "An account with this email already exists");
  if (existingUsername) throw new ApiError(400, "This username is already taken");

  const role = await Role.findById(roleId);
  if (!role) throw new ApiError(400, "Invalid role");
  if (role.status !== "ACTIVE") throw new ApiError(400, "Cannot assign an inactive role");

  assertCanAssignRole(req, role);

  // Must go through `.save()` (not findOneAndUpdate/insertMany) — the
  // Admin schema's pre("save") hook is the only place the password gets
  // hashed.
  const staff = new Admin({
    ...data,
    role: role._id,
    isAdmin: true,
    isVerified: true,
    status: data.status || "ACTIVE",
    createdBy: req.user._id,
  });

  await staff.save();

  const populated = await Admin.findById(staff._id)
    .select(STAFF_PROJECTION)
    .populate("role", "name slug isSuperAdmin status");

  res.status(201).json(new ApiResponse(201, populated, "Staff account created successfully"));
});

export const updateStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const staff = await Admin.findOne({ _id: id, isDeleted: { $ne: true } }).populate(
    "role",
    "name slug isSuperAdmin status",
  );
  if (!staff) throw new ApiError(404, "Staff account not found");

  assertCanTouchSuperAdmin(req, staff);

  Object.assign(staff, req.validatedData);
  await staff.save();

  res.json(new ApiResponse(200, staff, "Staff account updated successfully"));
});

export const updateStaffRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { roleId } = req.validatedData;

  assertNotSelf(req, id, "change the role of");

  const staff = await Admin.findOne({ _id: id, isDeleted: { $ne: true } }).populate(
    "role",
    "name slug isSuperAdmin status",
  );
  if (!staff) throw new ApiError(404, "Staff account not found");

  assertCanTouchSuperAdmin(req, staff);
  await assertNotLastSuperAdmin(staff);

  const role = await Role.findById(roleId);
  if (!role) throw new ApiError(400, "Invalid role");
  if (role.status !== "ACTIVE") throw new ApiError(400, "Cannot assign an inactive role");

  assertCanAssignRole(req, role);

  staff.role = role._id;
  await staff.save();

  const populated = await Admin.findById(staff._id)
    .select(STAFF_PROJECTION)
    .populate("role", "name slug isSuperAdmin status");

  res.json(new ApiResponse(200, populated, "Staff role updated successfully"));
});

export const updateStaffStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.validatedData;

  assertNotSelf(req, id, "change the status of");

  const staff = await Admin.findOne({ _id: id, isDeleted: { $ne: true } }).populate(
    "role",
    "name slug isSuperAdmin status",
  );
  if (!staff) throw new ApiError(404, "Staff account not found");

  assertCanTouchSuperAdmin(req, staff);
  if (status === "SUSPENDED") await assertNotLastSuperAdmin(staff);

  staff.status = status;
  if (status === "SUSPENDED") staff.refreshToken = null;
  await staff.save();

  res.json(new ApiResponse(200, staff, `Staff account ${status === "ACTIVE" ? "activated" : "suspended"}`));
});

export const resetStaffPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.validatedData;

  const staff = await Admin.findOne({ _id: id, isDeleted: { $ne: true } })
    .select("+password")
    .populate("role", "name slug isSuperAdmin status");
  if (!staff) throw new ApiError(404, "Staff account not found");

  assertCanTouchSuperAdmin(req, staff);

  staff.password = newPassword; // hashed by the pre("save") hook
  staff.refreshToken = null;
  await staff.save();

  res.json(new ApiResponse(200, null, "Password reset successfully"));
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;

  assertNotSelf(req, id, "delete");

  const staff = await Admin.findOne({ _id: id, isDeleted: { $ne: true } }).populate(
    "role",
    "name slug isSuperAdmin status",
  );
  if (!staff) throw new ApiError(404, "Staff account not found");

  assertCanTouchSuperAdmin(req, staff);
  await assertNotLastSuperAdmin(staff);

  staff.isDeleted = true;
  staff.status = "SUSPENDED";
  staff.refreshToken = null;
  await staff.save();

  res.json(new ApiResponse(200, null, "Staff account deleted successfully"));
});
