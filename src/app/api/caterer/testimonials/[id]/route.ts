import { NextResponse } from "next/server";
import {
  getTestimonialById,
  updateTestimonial,
  deleteTestimonial,
} from "@/lib/caterer/store";
import { requireAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

// One filled star per point, so anything outside 1–5 is clamped rather than
// rejected — same rule the create route applies.
function clampRating(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, n));
}

// PUT /api/caterer/testimonials/[id] — Update review by ID
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
        { error: "Invalid or missing testimonial ID." },
        { status: 400 }
      );
    }

    const existing = await getTestimonialById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Testimonial with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body.quoteEn === "string") updateData.quoteEn = body.quoteEn.trim();
    if (typeof body.quoteHi === "string") updateData.quoteHi = body.quoteHi.trim();
    if (typeof body.authorName === "string") updateData.authorName = body.authorName.trim();
    if (typeof body.eventEn === "string") updateData.eventEn = body.eventEn.trim();
    if (typeof body.eventHi === "string") updateData.eventHi = body.eventHi.trim();
    if (body.rating !== undefined) updateData.rating = clampRating(body.rating);
    if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;

    const updated = await updateTestimonial(id, updateData);

    return NextResponse.json({ testimonial: updated });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/testimonials/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update testimonial." },
      { status: 500 }
    );
  }
}

// DELETE /api/caterer/testimonials/[id] — Delete review by ID
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
        { error: "Invalid or missing testimonial ID." },
        { status: 400 }
      );
    }

    const existing = await getTestimonialById(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Testimonial with ID '${id}' not found.` },
        { status: 404 }
      );
    }

    await deleteTestimonial(id);

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    console.error("DELETE /api/caterer/testimonials/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete testimonial." },
      { status: 500 }
    );
  }
}
