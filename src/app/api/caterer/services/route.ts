import { photoCardCollectionRoutes } from "@/lib/caterer/photo-card-api";

export const runtime = "nodejs";

// GET  /api/caterer/services — All "Our Services" tiles for the admin screen
// POST /api/caterer/services — Creates a service tile
const handlers = photoCardCollectionRoutes({
  collection: "services",
  singular: "service",
  plural: "services",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
