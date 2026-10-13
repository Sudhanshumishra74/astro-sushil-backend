import mongoose from "mongoose";
import { Role } from "./role.model.js";
import { Permission } from "../permission/permission.model.js";

const EMPTY_RESULT = { role: null, permissions: [], isSuperAdmin: false };

/**
 * Every permission name in the DB — used only for Super Admin resolution
 * (so a Super Admin automatically gets permissions created after their role
 * was seeded, not just whatever was on the role at creation time). Queried
 * fresh each time rather than cached, so a newly-added permission is
 * immediately usable without a server restart.
 */
const getAllPermissionNames = async () => {
  const permissions = await Permission.find().select("name").lean();
  return permissions.map((p) => p.name);
};

/**
 * Resolves an Admin document's role into a usable permission set.
 *
 * Guards with isValidObjectId before querying: if `admin.role` is still the
 * pre-migration enum string ("ADMIN"/"SUPER_ADMIN"), this degrades to an
 * empty permission set instead of throwing a Mongoose CastError — turning a
 * would-be 500 (total lockout) into a clean 403 on gated routes, while login
 * and profile fetch keep working untouched.
 */
export const resolveAdminRole = async (admin) => {
  const rawRole = admin?.role;
  if (!rawRole) return EMPTY_RESULT;

  const roleId = rawRole?._id ?? rawRole;
  if (!mongoose.isValidObjectId(roleId)) return EMPTY_RESULT;

  const role = await Role.findById(roleId).populate("permissions", "name");
  if (!role) return EMPTY_RESULT;

  if (role.isSuperAdmin) {
    return { role, permissions: await getAllPermissionNames(), isSuperAdmin: true };
  }

  if (role.status !== "ACTIVE") {
    return { role, permissions: [], isSuperAdmin: false };
  }

  return {
    role,
    permissions: role.permissions.map((p) => p.name),
    isSuperAdmin: false,
  };
};

/**
 * The canonical shape returned by login, profile fetch, and profile update —
 * keeping all three identical is what prevents a profile save from
 * accidentally stripping role/permissions from the frontend store.
 */
export const buildAdminAuthPayload = async (admin) => {
  const { role, permissions, isSuperAdmin } = await resolveAdminRole(admin);

  return {
    _id: admin._id,
    fullName: admin.fullName || "",
    username: admin.username || "",
    email: admin.email || "",
    phoneNumber: admin.phoneNumber || "",
    profilePhoto: admin.profilePhoto || "",
    designation: admin.designation || "",
    website: admin.website || "",
    portfolioLink: admin.portfolioLink || "",
    address: admin.address || "",
    city: admin.city || "",
    state: admin.state || "",
    postalCode: admin.postalCode || "",
    loginTime: admin.loginTime || null,
    loginHistory: admin.loginHistory || [],
    isAdmin: admin.isAdmin,
    status: admin.status,
    role: role
      ? {
          _id: role._id,
          name: role.name,
          slug: role.slug,
          isSuperAdmin: role.isSuperAdmin,
          status: role.status,
        }
      : null,
    isSuperAdmin,
    permissions,
  };
};
