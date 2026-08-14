import { NextResponse } from "next/server";
import { getCuisineById, updateCuisine, deleteCuisine } from "@/lib/caterer/store";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

// PUT /api/caterer/cuisines/[id] — Update cuisine tile by ID
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
        { error: "Invalid or missing cuisine ID." },
        { status: 400 }
      );
    }

    const existing = await getCuisineById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Cuisine with ID '${id}' not found.` },
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

    const updated = await updateCuisine(id, updateData);

    return NextResponse.json({ cuisine: updated });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/cuisines/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update cuisine." },
      { status: 500 }
    );
  }
}

// DELETE /api/caterer/cuisines/[id] — Delete cuisine tile by ID
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
        { error: "Invalid or missing cuisine ID." },
        { status: 400 }
      );
    }

    const existing = await getCuisineById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Cuisine with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    await deleteCuisine(id);

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    console.error("DELETE /api/caterer/cuisines/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete cuisine." },
      { status: 500 }
    );
  }
}
