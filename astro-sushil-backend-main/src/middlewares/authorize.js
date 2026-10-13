import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolveAdminRole } from "../modules/role/role.service.js";

/**
 * Permission gate, chained AFTER adminVerifyJWT (which attaches the live
 * Admin document to req.user). Variadic arguments are OR'd — any one of the
 * listed permissions is sufficient.
 *
 * Usage: router.get(path, adminVerifyJWT, authorize("products.view"), controller)
 *
 * Super Admin bypasses the permission check entirely (before the permissions
 * array is even read) so it automatically covers permissions created after
 * the role was seeded — see Role.isSuperAdmin / role.service.js.
 */
export const authorize = (...required) =>
  asyncHandler(async (req, res, next) => {
    const admin = req.user;

    if (!admin) {
      throw new ApiError(401, "Unauthorized request");
    }

    if (admin.isDeleted) {
      throw new ApiError(403, "This account has been removed");
    }

    if (admin.status === "SUSPENDED") {
      throw new ApiError(403, "Your account is suspended");
    }

    const { role, permissions, isSuperAdmin } = await resolveAdminRole(admin);
    req.rbac = { role, permissions, isSuperAdmin };

    if (isSuperAdmin) return next();

    if (!role) {
      throw new ApiError(403, "No role assigned to your account. Contact a Super Admin.");
    }

    if (required.length === 0 || required.some((p) => permissions.includes(p))) {
      return next();
    }

    throw new ApiError(
      403,
      `You do not have permission to perform this action (requires: ${required.join(" or ")})`,
    );
  });
