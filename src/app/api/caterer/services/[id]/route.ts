import { photoCardItemRoutes } from "@/lib/caterer/photo-card-api";

export const runtime = "nodejs";

// PUT    /api/caterer/services/[id] — Update a service tile by ID
// DELETE /api/caterer/services/[id] — Delete a service tile by ID
const handlers = photoCardItemRoutes({
  collection: "services",
  singular: "service",
  plural: "services",
});

export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
