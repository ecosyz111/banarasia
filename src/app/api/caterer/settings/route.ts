import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings, updateSettings } from "@/lib/caterer/store";

export const runtime = "nodejs";

// Colours are injected straight into a CSS custom property on the public page,
// so anything that is not a plain hex literal is rejected rather than escaped.
const HEX = /^#[0-9a-fA-F]{6}$/;

// Same reasoning for the logo: it becomes an <img src>. Allow only same-origin
// paths and the Blob/HTTPS URLs the upload endpoint hands back — never
// `javascript:` or a `data:` payload.
function isSafeLogoUrl(url: string): boolean {
  return url.startsWith("/") || url.startsWith("https://");
}

// The number is pasted into wa.me links, which take digits with a country code
// and no "+". Owners type it however they say it aloud ("+91 99186 29017",
// "09918629017"), so normalise here and assume +91 for a bare Indian number.
function normaliseWhatsapp(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

// GET /api/caterer/settings — Branding for the admin console
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    console.error("GET /api/caterer/settings error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve settings." },
      { status: 500 }
    );
  }
}

// PUT /api/caterer/settings — Update logo and brand colours
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.logoUrl === "string" && body.logoUrl.trim()) {
      const logoUrl = body.logoUrl.trim();
      if (!isSafeLogoUrl(logoUrl)) {
        return NextResponse.json(
          { error: "logoUrl must be a site-relative path or an https:// URL." },
          { status: 400 }
        );
      }
      updateData.logoUrl = logoUrl;
    }

    for (const key of ["primaryColor", "accentColor"] as const) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) {
        if (!HEX.test(value.trim())) {
          return NextResponse.json(
            { error: `${key} must be a 6-digit hex colour, e.g. #ea580c.` },
            { status: 400 }
          );
        }
        updateData[key] = value.trim().toLowerCase();
      }
    }

    if (typeof body.whatsappNumber === "string" && body.whatsappNumber.trim()) {
      const number = normaliseWhatsapp(body.whatsappNumber);
      // E.164 tops out at 15 digits; anything under 10 cannot be a reachable
      // number with a country code in front of it.
      if (number.length < 10 || number.length > 15) {
        return NextResponse.json(
          {
            error:
              "whatsappNumber must be a phone number with country code, e.g. 919918629017.",
          },
          { status: 400 }
        );
      }
      updateData.whatsappNumber = number;
    }

    const settings = await updateSettings(updateData);
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/settings error:", err);
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500 }
    );
  }
}
