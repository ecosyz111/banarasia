import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getPackageById, updatePackage, deletePackage } from "@/lib/caterer/store";

export const runtime = "nodejs";

// PUT /api/caterer/packages/[id] — Update package by ID
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
        { error: "Invalid or missing package ID." },
        { status: 400 }
      );
    }

    const existing = await getPackageById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Package with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body.nameEn === "string") updateData.nameEn = body.nameEn.trim();
    if (typeof body.nameHi === "string") updateData.nameHi = body.nameHi.trim();
    if (typeof body.price === "number" && !isNaN(body.price) && body.price >= 0) {
      updateData.price = body.price;
    }
    if (body.priceMode === "amount" || body.priceMode === "quote") {
      updateData.priceMode = body.priceMode;
    }
    if (typeof body.basisPax === "number" && !isNaN(body.basisPax) && body.basisPax >= 0) {
      updateData.basisPax = body.basisPax;
    }
    if (typeof body.priceUnitEn === "string") updateData.priceUnitEn = body.priceUnitEn.trim();
    if (typeof body.priceUnitHi === "string") updateData.priceUnitHi = body.priceUnitHi.trim();
    if (body.badgeEn === null || typeof body.badgeEn === "string") updateData.badgeEn = body.badgeEn?.trim() || null;
    if (body.badgeHi === null || typeof body.badgeHi === "string") updateData.badgeHi = body.badgeHi?.trim() || null;
    if (Array.isArray(body.featuresEn)) updateData.featuresEn = body.featuresEn;
    if (Array.isArray(body.featuresHi)) updateData.featuresHi = body.featuresHi;
    if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;

    const updated = await updatePackage(id, updateData);

    return NextResponse.json({ package: updated });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/packages/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update package." },
      { status: 500 }
    );
  }
}

// DELETE /api/caterer/packages/[id] — Delete package by ID
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
        { error: "Invalid or missing package ID." },
        { status: 400 }
      );
    }

    const existing = await getPackageById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Package with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    await deletePackage(id);

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    console.error("DELETE /api/caterer/packages/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete package." },
      { status: 500 }
    );
  }
}
