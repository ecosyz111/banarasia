import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getVenueById, updateVenue, deleteVenue } from "@/lib/caterer/store";

export const runtime = "nodejs";

// PUT /api/caterer/venues/[id] — Update venue by ID
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing venue ID." },
        { status: 400 }
      );
    }

    const existing = await getVenueById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Venue with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body.nameEn === "string") updateData.nameEn = body.nameEn.trim();
    if (typeof body.nameHi === "string") updateData.nameHi = body.nameHi.trim();
    if (typeof body.areaEn === "string") updateData.areaEn = body.areaEn.trim();
    if (typeof body.areaHi === "string") updateData.areaHi = body.areaHi.trim();
    if (typeof body.capacity === "string") updateData.capacity = body.capacity.trim();
    if (typeof body.imageUrl === "string") updateData.imageUrl = body.imageUrl.trim();
    if (typeof body.notesEn === "string") updateData.notesEn = body.notesEn.trim();
    if (typeof body.notesHi === "string") updateData.notesHi = body.notesHi.trim();
    if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;

    const updated = await updateVenue(id, updateData);

    return NextResponse.json({ venue: updated });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/venues/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update venue." },
      { status: 500 }
    );
  }
}

// DELETE /api/caterer/venues/[id] — Delete venue by ID
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid or missing venue ID." },
        { status: 400 }
      );
    }

    const existing = await getVenueById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Venue with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    await deleteVenue(id);

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    console.error("DELETE /api/caterer/venues/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete venue." },
      { status: 500 }
    );
  }
}
