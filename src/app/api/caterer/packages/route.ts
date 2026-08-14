import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAllPackages, createPackage } from "@/lib/caterer/store";

export const runtime = "nodejs";

// GET /api/caterer/packages — Returns all packages (active and inactive) for admin management
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const packages = await getAllPackages();
    return NextResponse.json({ packages });
  } catch (err: unknown) {
    console.error("GET /api/caterer/packages error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve packages." },
      { status: 500 }
    );
  }
}

// POST /api/caterer/packages — Creates a new package
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      nameEn,
      nameHi,
      price,
      priceUnitEn,
      priceUnitHi,
      badgeEn,
      badgeHi,
      featuresEn,
      featuresHi,
      sortOrder,
      isActive,
    } = body ?? {};

    if (!nameEn || typeof nameEn !== "string" || !nameEn.trim()) {
      return NextResponse.json(
        { error: "Field 'nameEn' is required." },
        { status: 400 }
      );
    }
    if (!nameHi || typeof nameHi !== "string" || !nameHi.trim()) {
      return NextResponse.json(
        { error: "Field 'nameHi' is required." },
        { status: 400 }
      );
    }
    if (typeof price !== "number" || isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: "Field 'price' must be a non-negative number." },
        { status: 400 }
      );
    }

    const created = await createPackage({
      nameEn: nameEn.trim(),
      nameHi: nameHi.trim(),
      price,
      priceUnitEn: typeof priceUnitEn === "string" && priceUnitEn.trim() ? priceUnitEn.trim() : "/ Plate",
      priceUnitHi: typeof priceUnitHi === "string" && priceUnitHi.trim() ? priceUnitHi.trim() : "/ प्लेट",
      badgeEn: typeof badgeEn === "string" ? badgeEn.trim() : null,
      badgeHi: typeof badgeHi === "string" ? badgeHi.trim() : null,
      featuresEn: Array.isArray(featuresEn) ? featuresEn : [],
      featuresHi: Array.isArray(featuresHi) ? featuresHi : [],
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return NextResponse.json({ package: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/caterer/packages error:", err);
    return NextResponse.json(
      { error: "Failed to create package." },
      { status: 500 }
    );
  }
}
