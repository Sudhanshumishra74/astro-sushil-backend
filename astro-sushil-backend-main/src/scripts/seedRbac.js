import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import connectDB from "../config/db.js";
import { Permission } from "../modules/permission/permission.model.js";
import { flattenCatalog } from "../modules/permission/permission.catalog.js";
import { Role } from "../modules/role/role.model.js";
import { Admin } from "../modules/admin/admin.modal.js";

dotenv.config();

const PRUNE = process.argv.includes("--prune");
const RESET_ADMIN_ROLE = process.argv.includes("--reset-admin-role");

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase() || null;
const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME || "superadmin";
const SUPER_ADMIN_FULLNAME = process.env.SUPER_ADMIN_FULLNAME || "Super Admin";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || null;

// Modules a plain "Admin" role should NOT get by default — managing other
// admins/roles is reserved for Super Admin.
const ADMIN_ROLE_EXCLUDED_MODULES = ["roles", "permissions", "staff"];

async function upsertPermissions() {
  const records = flattenCatalog();
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const result = await Permission.findOneAndUpdate(
      { name: record.name },
      { $set: record },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true },
    );
    if (result.lastErrorObject?.upserted) created += 1;
    else updated += 1;
  }

  console.log(`Permissions: ${created} created, ${updated} updated (${records.length} total in catalog).`);

  if (PRUNE) {
    const catalogNames = new Set(records.map((r) => r.name));
    const stale = await Permission.find({ name: { $nin: [...catalogNames] } }).select("_id name");

    if (stale.length) {
      const staleIds = stale.map((p) => p._id);
      await Role.updateMany({}, { $pull: { permissions: { $in: staleIds } } });
      await Permission.deleteMany({ _id: { $in: staleIds } });
      console.log(`Pruned ${stale.length} out-of-catalog permission(s): ${stale.map((p) => p.name).join(", ")}`);
    }
  }

  return Permission.find().lean();
}

async function upsertSuperAdminRole(allPermissions) {
  const allPermissionIds = allPermissions.map((p) => p._id);

  const role = await Role.findOneAndUpdate(
    { slug: "super-admin" },
    {
      $set: {
        name: "Super Admin",
        description:
          "Full unrestricted access. Automatically receives every permission, including ones created after this role.",
        isSuperAdmin: true,
        isSystem: true,
        status: "ACTIVE",
        permissions: allPermissionIds,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`Super Admin role: ${role._id} (${allPermissionIds.length} permissions).`);
  return role;
}

async function upsertAdminRole(allPermissions) {
  const adminPermissionIds = allPermissions
    .filter((p) => !ADMIN_ROLE_EXCLUDED_MODULES.includes(p.module))
    .map((p) => p._id);

  const metaUpdate = {
    name: "Admin",
    description: "Full operational access. Cannot manage roles or staff accounts.",
    isSuperAdmin: false,
    isSystem: true,
    status: "ACTIVE",
  };

  const update = RESET_ADMIN_ROLE
    ? { $set: { ...metaUpdate, permissions: adminPermissionIds } }
    : { $set: metaUpdate, $setOnInsert: { permissions: adminPermissionIds } };

  const role = await Role.findOneAndUpdate({ slug: "admin" }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  console.log(`Admin role: ${role._id} (${role.permissions.length} permissions${RESET_ADMIN_ROLE ? ", reset" : ""}).`);
  return role;
}

/**
 * Migrates existing `admins` documents via the RAW MongoDB driver, not the
 * Mongoose model — this bypasses schema casting entirely, so it works
 * whether the Admin schema still declares `role` as String (pre-migration)
 * or has already been changed to ObjectId. Must run before the schema
 * change ships, or any populate("role") on an unmigrated doc throws a
 * CastError (a login-breaking 500).
 */
async function migrateAdminRoles(superAdminRole, adminRole) {
  const col = mongoose.connection.db.collection("admins");

  const results = await Promise.all([
    col.updateMany({ role: "SUPER_ADMIN" }, { $set: { role: superAdminRole._id } }),
    col.updateMany({ role: "ADMIN" }, { $set: { role: adminRole._id } }),
    col.updateMany({ role: { $type: "string" } }, { $set: { role: adminRole._id } }), // catch-all for any other string value
    col.updateMany(
      { $or: [{ role: { $exists: false } }, { role: null }] },
      { $set: { role: adminRole._id } },
    ),
  ]);

  const unsetResult = await col.updateMany({}, { $unset: { permissions: "" } });

  const [superMigrated, adminMigrated, otherStringMigrated, missingMigrated] = results;
  console.log(
    `Migrated admin roles — SUPER_ADMIN: ${superMigrated.modifiedCount}, ADMIN: ${adminMigrated.modifiedCount}, ` +
      `other string values: ${otherStringMigrated.modifiedCount}, missing/null: ${missingMigrated.modifiedCount}.`,
  );
  console.log(`Dropped legacy \`permissions\` field on ${unsetResult.modifiedCount} admin document(s).`);
}

/** Ensures at least one admin currently holds the Super Admin role. */
async function ensureSuperAdminExists(superAdminRole) {
  const col = mongoose.connection.db.collection("admins");

  const existingCount = await col.countDocuments({
    role: superAdminRole._id,
    isDeleted: { $ne: true },
  });

  if (existingCount > 0) {
    console.log(`Super Admin already assigned to ${existingCount} account(s) — no promotion needed.`);
    return;
  }

  const target = SUPER_ADMIN_EMAIL
    ? await col.findOne({ email: SUPER_ADMIN_EMAIL })
    : await col.find({ isAdmin: true, isDeleted: { $ne: true } }).sort({ createdAt: 1 }).limit(1).next();

  if (!target) {
    console.warn(
      "\n*** WARNING: no admin account found to promote to Super Admin. " +
        "Set SUPER_ADMIN_EMAIL to an existing admin's email, or create one first. ***\n",
    );
    return;
  }

  await col.updateOne({ _id: target._id }, { $set: { role: superAdminRole._id } });
  console.log(`\n*** PROMOTED ${target.email} (${target.username}) TO SUPER ADMIN ***\n`);
}

/**
 * Bootstraps a first admin account when the database has none at all. Uses
 * the raw driver (with a manual bcrypt hash) rather than `new Admin().save()`
 * — this step can run either before or after the Admin schema's `role` field
 * type flips from String to ObjectId, and going through Mongoose would tie
 * it to whichever schema shape happens to be deployed at the time.
 */
async function bootstrapFirstAdminIfNeeded(superAdminRole) {
  const count = await Admin.countDocuments();
  if (count > 0) return;

  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    throw new Error(
      "No admin accounts exist and SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD are not set — " +
        "cannot bootstrap a first admin. Set both env vars and re-run the seed.",
    );
  }

  const col = mongoose.connection.db.collection("admins");
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  const now = new Date();

  const { insertedId } = await col.insertOne({
    fullName: SUPER_ADMIN_FULLNAME,
    username: SUPER_ADMIN_USERNAME,
    email: SUPER_ADMIN_EMAIL,
    password: hashedPassword,
    isAdmin: true,
    isVerified: true,
    status: "ACTIVE",
    isDeleted: false,
    loginHistory: [],
    role: superAdminRole._id,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`\n*** BOOTSTRAPPED first admin account: ${SUPER_ADMIN_EMAIL} (Super Admin, _id ${insertedId}) ***\n`);
}

async function seedRbac() {
  await connectDB();

  const allPermissions = await upsertPermissions();
  const superAdminRole = await upsertSuperAdminRole(allPermissions);
  const adminRole = await upsertAdminRole(allPermissions);

  await bootstrapFirstAdminIfNeeded(superAdminRole);
  await migrateAdminRoles(superAdminRole, adminRole);
  await ensureSuperAdminExists(superAdminRole);

  console.log("\nRBAC seed complete.");
  await mongoose.disconnect();
}

seedRbac().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
