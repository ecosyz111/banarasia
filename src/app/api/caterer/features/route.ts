import { photoCardCollectionRoutes } from "@/lib/caterer/photo-card-api";

export const runtime = "nodejs";

// GET  /api/caterer/features — All "Why Choose Us" tiles for the admin screen
// POST /api/caterer/features — Creates a Why Choose Us tile
const handlers = photoCardCollectionRoutes({
  collection: "features",
  singular: "feature",
  plural: "features",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
