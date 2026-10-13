import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Permission } from "./permission.model.js";
import { GROUP_ORDER } from "./permission.catalog.js";

// Groups a flat permission list into [{group, modules: [{module, moduleLabel, permissions}]}],
// ordered to match the admin sidebar's own category order (GROUP_ORDER),
// for the frontend's grouped permission-matrix checkbox UI.
const groupPermissions = (permissions) => {
  const groupMap = new Map();

  for (const permission of permissions) {
    if (!groupMap.has(permission.group)) groupMap.set(permission.group, new Map());
    const moduleMap = groupMap.get(permission.group);

    if (!moduleMap.has(permission.module)) {
      moduleMap.set(permission.module, {
        module: permission.module,
        moduleLabel: permission.moduleLabel,
        permissions: [],
      });
    }

    moduleMap.get(permission.module).permissions.push({
      _id: permission._id,
      name: permission.name,
      action: permission.action,
      label: permission.label,
    });
  }

  const orderedGroups = [...GROUP_ORDER, ...[...groupMap.keys()].filter((g) => !GROUP_ORDER.includes(g))];

  return orderedGroups
    .filter((group) => groupMap.has(group))
    .map((group) => ({ group, modules: [...groupMap.get(group).values()] }));
};

export const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await Permission.find().sort({ group: 1, sortOrder: 1 }).lean();

  if (req.query.flat === "true") {
    return res.json(new ApiResponse(200, permissions, "Permissions fetched"));
  }

  res.json(new ApiResponse(200, groupPermissions(permissions), "Permissions fetched"));
});
