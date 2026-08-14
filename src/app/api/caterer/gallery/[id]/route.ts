import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getGalleryItemById, updateGalleryItem, deleteGalleryItem } from "@/lib/caterer/store";

export const runtime = "nodejs";

// PUT /api/caterer/gallery/[id] — Update gallery item by ID
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
        { error: "Invalid or missing gallery item ID." },
        { status: 400 }
      );
    }

    const existing = await getGalleryItemById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Gallery item with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body.imageUrl === "string" && body.imageUrl.trim()) {
      updateData.imageUrl = body.imageUrl.trim();
    }
    if (typeof body.captionEn === "string" && body.captionEn.trim()) {
      updateData.captionEn = body.captionEn.trim();
    }
    if (typeof body.captionHi === "string" && body.captionHi.trim()) {
      updateData.captionHi = body.captionHi.trim();
    }
    if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;

    const updated = await updateGalleryItem(id, updateData);

    return NextResponse.json({ galleryItem: updated });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/gallery/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update gallery item." },
      { status: 500 }
    );
  }
}

// DELETE /api/caterer/gallery/[id] — Delete gallery item by ID
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
        { error: "Invalid or missing gallery item ID." },
        { status: 400 }
      );
    }

    const existing = await getGalleryItemById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Gallery item with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    await deleteGalleryItem(id);

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    console.error("DELETE /api/caterer/gallery/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete gallery item." },
      { status: 500 }
    );
  }
}
