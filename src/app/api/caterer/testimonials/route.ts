import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAllTestimonials, createTestimonial } from "@/lib/caterer/store";

export const runtime = "nodejs";

// The card draws one filled star per point, so a rating outside 1–5 would break
// the layout rather than the data. Clamp instead of rejecting the save.
function clampRating(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 5;
  return Math.min(5, Math.max(1, n));
}

// GET /api/caterer/testimonials — All reviews (active and inactive) for admin
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const testimonials = await getAllTestimonials();
    return NextResponse.json({ testimonials });
  } catch (err: unknown) {
    console.error("GET /api/caterer/testimonials error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve testimonials." },
      { status: 500 }
    );
  }
}

// POST /api/caterer/testimonials — Creates a new review
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { quoteEn, quoteHi, authorName, eventEn, eventHi, rating, sortOrder, isActive } =
      body ?? {};

    if (!quoteEn || typeof quoteEn !== "string" || !quoteEn.trim()) {
      return NextResponse.json({ error: "Field 'quoteEn' is required." }, { status: 400 });
    }
    if (!authorName || typeof authorName !== "string" || !authorName.trim()) {
      return NextResponse.json(
        { error: "Field 'authorName' is required." },
        { status: 400 }
      );
    }

    const created = await createTestimonial({
      quoteEn: quoteEn.trim(),
      quoteHi: typeof quoteHi === "string" ? quoteHi.trim() : "",
      authorName: authorName.trim(),
      eventEn: typeof eventEn === "string" ? eventEn.trim() : "",
      eventHi: typeof eventHi === "string" ? eventHi.trim() : "",
      rating: clampRating(rating),
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return NextResponse.json({ testimonial: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/caterer/testimonials error:", err);
    return NextResponse.json(
      { error: "Failed to create testimonial." },
      { status: 500 }
    );
  }
}
