// Route handlers for the photo-card collections (Services, Why Choose Us).
//
// Both collections hold the same record and need the same admin-only CRUD, so
// the handlers are written once here and bound to a collection in the route
// files. The response key is configurable because each route answers under its
// own name — { services: [...] }, { feature: {...} } — which is what the admin
// screen already expects from the older, hand-written collection routes.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { PHOTO_CARD_OPS, type PhotoCardCollection } from "@/lib/caterer/store";

type PhotoCardRouteConfig = {
  collection: PhotoCardCollection;
  // Response keys and error copy: "service" / "services".
  singular: string;
  plural: string;
};

export function photoCardCollectionRoutes({
  collection,
  singular,
  plural,
}: PhotoCardRouteConfig) {
  const ops = PHOTO_CARD_OPS[collection];

  // GET — every tile, active and inactive, for the admin screen.
  async function GET(req: Request) {
    const denied = requireAdmin(req);
    if (denied) return denied;

    try {
      const items = await ops.getAll();
      return NextResponse.json({ [plural]: items });
    } catch (err: unknown) {
      console.error(`GET /api/caterer/${plural} error:`, err);
      return NextResponse.json(
        { error: `Failed to retrieve ${plural}.` },
        { status: 500 }
      );
    }
  }

  // POST — creates a tile.
  async function POST(req: Request) {
    const denied = requireAdmin(req);
    if (denied) return denied;

    try {
      const body = await req.json();
      const { nameEn, nameHi, descEn, descHi, imageUrl, sortOrder, isActive } = body ?? {};

      if (!nameEn || typeof nameEn !== "string" || !nameEn.trim()) {
        return NextResponse.json({ error: "Field 'nameEn' is required." }, { status: 400 });
      }
      if (!nameHi || typeof nameHi !== "string" || !nameHi.trim()) {
        return NextResponse.json({ error: "Field 'nameHi' is required." }, { status: 400 });
      }

      const created = await ops.create({
        nameEn: nameEn.trim(),
        nameHi: nameHi.trim(),
        descEn: typeof descEn === "string" ? descEn.trim() : "",
        descHi: typeof descHi === "string" ? descHi.trim() : "",
        // Blank is a valid choice, not a missing value — it renders the
        // gradient tile instead of a photo card.
        imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: typeof isActive === "boolean" ? isActive : true,
      });

      return NextResponse.json({ [singular]: created }, { status: 201 });
    } catch (err: unknown) {
      console.error(`POST /api/caterer/${plural} error:`, err);
      return NextResponse.json(
        { error: `Failed to create ${singular}.` },
        { status: 500 }
      );
    }
  }

  return { GET, POST };
}

export function photoCardItemRoutes({ collection, singular, plural }: PhotoCardRouteConfig) {
  const ops = PHOTO_CARD_OPS[collection];

  async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = requireAdmin(req);
    if (denied) return denied;

    try {
      const { id } = await params;
      if (!id || typeof id !== "string") {
        return NextResponse.json(
          { error: `Invalid or missing ${singular} ID.` },
          { status: 400 }
        );
      }

      const existing = await ops.getById(id);
      if (!existing) {
        return NextResponse.json(
          { error: `Item with ID '${id}' not found.` },
          { status: 404 }
        );
      }

      const body = await req.json();
      const updateData: Record<string, unknown> = {};
      if (typeof body.nameEn === "string") updateData.nameEn = body.nameEn.trim();
      if (typeof body.nameHi === "string") updateData.nameHi = body.nameHi.trim();
      if (typeof body.descEn === "string") updateData.descEn = body.descEn.trim();
      if (typeof body.descHi === "string") updateData.descHi = body.descHi.trim();
      if (typeof body.imageUrl === "string") updateData.imageUrl = body.imageUrl.trim();
      if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
      if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;

      const updated = await ops.update(id, updateData);

      return NextResponse.json({ [singular]: updated });
    } catch (err: unknown) {
      console.error(`PUT /api/caterer/${plural}/[id] error:`, err);
      return NextResponse.json(
        { error: `Failed to update ${singular}.` },
        { status: 500 }
      );
    }
  }

  async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = requireAdmin(req);
    if (denied) return denied;

    try {
      const { id } = await params;
      if (!id || typeof id !== "string") {
        return NextResponse.json(
          { error: `Invalid or missing ${singular} ID.` },
          { status: 400 }
        );
      }

      const existing = await ops.getById(id);
      if (!existing) {
        return NextResponse.json(
          { error: `Item with ID '${id}' not found.` },
          { status: 404 }
        );
      }

      await ops.remove(id);

      return NextResponse.json({ ok: true, deletedId: id });
    } catch (err: unknown) {
      console.error(`DELETE /api/caterer/${plural}/[id] error:`, err);
      return NextResponse.json(
        { error: `Failed to delete ${singular}.` },
        { status: 500 }
      );
    }
  }

  return { PUT, DELETE };
}
