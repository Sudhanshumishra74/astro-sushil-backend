// Single source of truth for what permissions should exist. One entry per
// real admin-panel module (mirrors astro-sushil-admin's Sidebar.jsx groups),
// each with the actions that make sense for that module. The seed script
// upserts one Permission document per (module, action) pair from this list —
// add a module/action here and re-run `npm run seed:rbac` to pick it up.

export const ACTION_LABELS = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  export: "Export",
};

// Matches Sidebar.jsx's category order so the permission matrix UI renders
// in the same order admins already see in the sidebar.
export const GROUP_ORDER = [
  "Main",
  "Catalog",
  "Sales",
  "Users",
  "Content",
  "Media",
  "Global Setting",
  "Settings",
  "Administration",
];

export const PERMISSION_CATALOG = [
  { module: "dashboard", moduleLabel: "Dashboard", group: "Main", actions: ["view"] },

  { module: "banners", moduleLabel: "Banners", group: "Catalog", actions: ["view", "create", "edit", "delete"] },
  { module: "categories", moduleLabel: "Categories", group: "Catalog", actions: ["view", "create", "edit", "delete"] },
  { module: "courses", moduleLabel: "Courses", group: "Catalog", actions: ["view", "create", "edit", "delete"] },
  { module: "products", moduleLabel: "Products", group: "Catalog", actions: ["view", "create", "edit", "delete"] },
  { module: "consultations", moduleLabel: "Consultations", group: "Catalog", actions: ["view", "create", "edit", "delete"] },

  { module: "orders", moduleLabel: "Orders", group: "Sales", actions: ["view", "edit", "export"] },
  { module: "reportOrders", moduleLabel: "Report Orders", group: "Sales", actions: ["view", "edit"] },
  { module: "transactions", moduleLabel: "Transactions", group: "Sales", actions: ["view", "export"] },
  { module: "gstReport", moduleLabel: "GST Report", group: "Sales", actions: ["view", "export"] },
  { module: "bookings", moduleLabel: "Bookings", group: "Sales", actions: ["view", "create", "edit", "delete"] },
  { module: "coupons", moduleLabel: "Coupons", group: "Sales", actions: ["view", "create", "edit", "delete"] },

  { module: "customers", moduleLabel: "Customers", group: "Users", actions: ["view", "edit", "delete"] },
  { module: "contacts", moduleLabel: "Contacts", group: "Users", actions: ["view", "edit", "delete"] },

  { module: "blogs", moduleLabel: "Blogs", group: "Content", actions: ["view", "create", "edit", "delete"] },
  { module: "faqs", moduleLabel: "FAQs", group: "Content", actions: ["view", "create", "edit", "delete"] },
  { module: "testimonials", moduleLabel: "Testimonials", group: "Content", actions: ["view", "create", "edit", "delete"] },
  { module: "pdfReports", moduleLabel: "PDF Reports", group: "Content", actions: ["view", "create", "edit", "delete"] },

  { module: "media", moduleLabel: "Media", group: "Media", actions: ["view", "create", "edit", "delete"] },

  { module: "availability", moduleLabel: "Availability", group: "Global Setting", actions: ["view", "edit"] },

  { module: "settings", moduleLabel: "Website Settings", group: "Settings", actions: ["view", "edit"] },
  { module: "seo", moduleLabel: "SEO", group: "Settings", actions: ["view", "create", "edit", "delete"] },

  { module: "roles", moduleLabel: "Roles", group: "Administration", actions: ["view", "create", "edit", "delete"] },
  { module: "permissions", moduleLabel: "Permissions", group: "Administration", actions: ["view"] },
  { module: "staff", moduleLabel: "Staff", group: "Administration", actions: ["view", "create", "edit", "delete"] },
];

/** Flattens the catalog into individual permission records ({name, module, moduleLabel, action, label, group, sortOrder}). */
export const flattenCatalog = () => {
  const records = [];

  PERMISSION_CATALOG.forEach((entry, moduleIndex) => {
    entry.actions.forEach((action, actionIndex) => {
      records.push({
        name: `${entry.module}.${action}`,
        module: entry.module,
        moduleLabel: entry.moduleLabel,
        action,
        label: `${ACTION_LABELS[action]} ${entry.moduleLabel}`,
        group: entry.group,
        sortOrder: moduleIndex * 10 + actionIndex,
      });
    });
  });

  return records;
};
