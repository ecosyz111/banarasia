import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createLead, getAllLeads, type LeadSource } from "@/lib/caterer/store";

export const runtime = "nodejs";

// Everything below the admin gate is written by anonymous visitors, so each
// field is length-clamped before it reaches the store: an oversized paste must
// not bloat the JSON document every other read depends on.
const LIMITS = {
  name: 80,
  email: 160,
  phone: 24,
  eventType: 40,
  guests: 12,
  message: 1000,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Indian numbers arrive as "+91 99186 29017", "09918629017", "9918629017".
// Keep the digits (and a leading +) so two spellings of one number match, and
// require enough of them to be dialable.
function normalizePhone(raw: string): string | null {
  if (!raw) return "";
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return (plus ? "+" : "") + digits;
}

// Best-effort throttle. Serverless instances are ephemeral and unshared, so
// this caps a single burst rather than a distributed flood — the real backstop
// is MAX_LEADS in the store.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

declare global {
  var __catererLeadRate__: Map<string, number[]> | undefined;
}

function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const store = (globalThis.__catererLeadRate__ ??= new Map<string, number[]>());
  const now = Date.now();
  const recent = (store.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);

  if (recent.length >= RATE_MAX) {
    store.set(ip, recent);
    return true;
  }
  recent.push(now);
  store.set(ip, recent);

  // Drop windows that have fully expired so the map cannot grow unbounded.
  if (store.size > 500) {
    for (const [key, stamps] of store) {
      if (stamps.every((t) => now - t >= RATE_WINDOW_MS)) store.delete(key);
    }
  }
  return false;
}

// GET /api/caterer/leads — Lead inbox for the admin console
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const leads = await getAllLeads();
    return NextResponse.json({ leads });
  } catch (err: unknown) {
    console.error("GET /api/caterer/leads error:", err);
    return NextResponse.json({ error: "Failed to retrieve leads." }, { status: 500 });
  }
}

// POST /api/caterer/leads — PUBLIC. The footer subscribe box and the contact
// inquiry form both post here; `source` says which.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const source: LeadSource = body.source === "inquiry" ? "inquiry" : "newsletter";
    const email = clean(body.email, LIMITS.email);
    const rawPhone = clean(body.phone, LIMITS.phone);

    if (email && !EMAIL.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const phone = normalizePhone(rawPhone);
    if (phone === null) {
      return NextResponse.json(
        { error: "Please enter a valid phone number." },
        { status: 400 }
      );
    }

    // One contact route is enough to follow up on; requiring both would lose
    // the visitor who only wants to leave a number.
    if (!email && !phone) {
      return NextResponse.json(
        { error: "Please enter an email address or a phone number." },
        { status: 400 }
      );
    }

    // Throttle only what would actually be written, so a visitor fixing a
    // mistyped address five times does not lock themselves out.
    if (rateLimited(req)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    await createLead({
      name: clean(body.name, LIMITS.name),
      email: email.toLowerCase(),
      phone,
      eventType: clean(body.eventType, LIMITS.eventType),
      guests: clean(body.guests, LIMITS.guests),
      message: clean(body.message, LIMITS.message),
      source,
    });

    // Deliberately no lead data echoed back — this endpoint is unauthenticated.
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/caterer/leads error:", err);
    return NextResponse.json({ error: "Failed to save your details." }, { status: 500 });
  }
}
