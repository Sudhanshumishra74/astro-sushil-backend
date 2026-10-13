import slugify from "slugify";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { Role } from "./role.model.js";
import { Permission } from "../permission/permission.model.js";
import { Admin } from "../admin/admin.modal.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertPermissionIdsExist = async (permissionIds = []) => {
  if (!permissionIds.length) return;

  const uniqueIds = [...new Set(permissionIds.map(String))];
  const count = await Permission.countDocuments({ _id: { $in: uniqueIds } });

  if (count !== uniqueIds.length) {
    throw new ApiError(400, "One or more permissions are invalid");
  }
};

// Defensive: even though the Zod schemas are .strict() and can never let
// these fields arrive, never trust them from a request body regardless.
const stripProtectedFields = (data) => {
  const clean = { ...data };
  delete clean.isSuperAdmin;
  delete clean.isSystem;
  delete clean.slug;
  return clean;
};

export const getRoles = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || "";
  const skip = (page - 1) * limit;

  const query = { name: { $regex: escapeRegex(search), $options: "i" } };
  if (req.query.status) query.status = req.query.status;

  const [roles, total] = await Promise.all([
    Role.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Role.countDocuments(query),
  ]);

  const roleIds = roles.map((r) => r._id);
  const counts = await Admin.aggregate([
    { $match: { role: { $in: roleIds }, isDeleted: { $ne: true } } },
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  const countByRole = new Map(counts.map((c) => [String(c._id), c.count]));

  const rolesWithMeta = roles.map((role) => ({
    ...role,
    adminCount: countByRole.get(String(role._id)) || 0,
    permissionCount: role.isSuperAdmin ? "ALL" : role.permissions.length,
  }));

  res.json(
    new ApiResponse(200, rolesWithMeta, "Roles fetched", {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }),
  );
});

// Must be registered before GET /:id, or "options" gets parsed as an id.
export const getRoleOptions = asyncHandler(async (req, res) => {
  const roles = await Role.find({ status: "ACTIVE" })
    .select("name slug isSuperAdmin")
    .sort({ name: 1 });

  res.json(new ApiResponse(200, roles, "Role options fetched"));
});

export const getRoleById = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id).populate(
    "permissions",
    "name module moduleLabel action label group",
  );

  if (!role) throw new ApiError(404, "Role not found");

  res.json(new ApiResponse(200, role, "Role fetched"));
});

export const createRole = asyncHandler(async (req, res) => {
  const data = stripProtectedFields(req.validatedData);

  const existing = await Role.findOne({
    name: new RegExp(`^${escapeRegex(data.name)}$`, "i"),
  });
  if (existing) throw new ApiError(400, "A role with this name already exists");

  await assertPermissionIdsExist(data.permissions);

  const slug = slugify(data.name, { lower: true, strict: true });
  const slugTaken = await Role.findOne({ slug });
  if (slugTaken) throw new ApiError(400, "A role with a similar name already exists");

  const role = await Role.create({
    ...data,
    slug,
    isSuperAdmin: false,
    isSystem: false,
    createdBy: req.user._id,
  });

  const populated = await role.populate("permissions", "name module moduleLabel action label group");

  res.status(201).json(new ApiResponse(201, populated, "Role created successfully"));
});

export const updateRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = stripProtectedFields(req.validatedData);

  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, "Role not found");

  if (role.isSuperAdmin) {
    throw new ApiError(403, "The Super Admin role cannot be modified");
  }

  if (role.isSystem && data.name && data.name !== role.name) {
    throw new ApiError(403, "System role cannot be renamed");
  }

  if (data.name && data.name !== role.name) {
    const existing = await Role.findOne({
      _id: { $ne: id },
      name: new RegExp(`^${escapeRegex(data.name)}$`, "i"),
    });
    if (existing) throw new ApiError(400, "A role with this name already exists");
  }

  if (data.permissions) {
    await assertPermissionIdsExist(data.permissions);

    // Self-lockout guard: an admin editing their own currently-assigned role
    // can't strip the permissions that let them manage roles at all.
    const isOwnRole = String(req.user.role) === String(role._id);
    if (isOwnRole && !req.rbac?.isSuperAdmin) {
      const requiredNames = ["roles.view", "roles.edit"];
      const newPermissions = await Permission.find({ _id: { $in: data.permissions } }).select("name");
      const newNames = new Set(newPermissions.map((p) => p.name));
      const missing = requiredNames.filter((n) => !newNames.has(n));

      if (missing.length) {
        throw new ApiError(400, "You cannot remove Role Management permissions from your own role");
      }
    }
  }

  Object.assign(role, data);
  await role.save();

  const populated = await role.populate("permissions", "name module moduleLabel action label group");

  res.json(new ApiResponse(200, populated, "Role updated successfully"));
});

export const updateRoleStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.validatedData;

  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, "Role not found");

  if (role.isSuperAdmin) {
    throw new ApiError(403, "The Super Admin role cannot be modified");
  }

  if (String(req.user.role) === String(role._id) && status !== "ACTIVE") {
    throw new ApiError(400, "You cannot deactivate your own role");
  }

  role.status = status;
  await role.save();

  res.json(new ApiResponse(200, role, "Role status updated successfully"));
});

export const deleteRole = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, "Role not found");

  if (role.isSuperAdmin || role.isSystem) {
    throw new ApiError(403, "This role cannot be deleted");
  }

  if (String(req.user.role) === String(role._id)) {
    throw new ApiError(400, "You cannot delete your own role");
  }

  const inUse = await Admin.countDocuments({ role: id, isDeleted: { $ne: true } });
  if (inUse > 0) {
    throw new ApiError(
      400,
      `Cannot delete this role — it is assigned to ${inUse} admin account(s). Reassign them first.`,
    );
  }

  await Role.findByIdAndDelete(id);

  res.json(new ApiResponse(200, null, "Role deleted successfully"));
});
