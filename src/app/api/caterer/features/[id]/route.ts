import { photoCardItemRoutes } from "@/lib/caterer/photo-card-api";

export const runtime = "nodejs";

// PUT    /api/caterer/features/[id] — Update a Why Choose Us tile by ID
// DELETE /api/caterer/features/[id] — Delete a Why Choose Us tile by ID
const handlers = photoCardItemRoutes({
  collection: "features",
  singular: "feature",
  plural: "features",
});

export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
