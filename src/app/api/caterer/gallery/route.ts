import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAllGalleryItems, createGalleryItem } from "@/lib/caterer/store";

export const runtime = "nodejs";

// GET /api/caterer/gallery — Returns all gallery items (active and inactive) for admin management
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const items = await getAllGalleryItems();
    return NextResponse.json({ gallery: items });
  } catch (err: unknown) {
    console.error("GET /api/caterer/gallery error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve gallery items." },
      { status: 500 }
    );
  }
}

// POST /api/caterer/gallery — Creates a new gallery item
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { imageUrl, captionEn, captionHi, sortOrder, isActive } = body ?? {};

    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
      return NextResponse.json(
        { error: "Field 'imageUrl' is required." },
        { status: 400 }
      );
    }
    if (!captionEn || typeof captionEn !== "string" || !captionEn.trim()) {
      return NextResponse.json(
        { error: "Field 'captionEn' is required." },
        { status: 400 }
      );
    }
    if (!captionHi || typeof captionHi !== "string" || !captionHi.trim()) {
      return NextResponse.json(
        { error: "Field 'captionHi' is required." },
        { status: 400 }
      );
    }

    const created = await createGalleryItem({
      imageUrl: imageUrl.trim(),
      captionEn: captionEn.trim(),
      captionHi: captionHi.trim(),
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return NextResponse.json({ galleryItem: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/caterer/gallery error:", err);
    return NextResponse.json(
      { error: "Failed to create gallery item." },
      { status: 500 }
    );
  }
}
