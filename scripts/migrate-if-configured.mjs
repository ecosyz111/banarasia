// Build-time guard: apply Prisma migrations only when someone asks for them.
//
// This used to run on the mere presence of DATABASE_URL, and that became a trap
// the moment the CMS started using Postgres for real. The store does not go
// through Prisma — it owns caterer_shard and caterer_upload and creates them on
// demand (see src/lib/caterer/pg.ts). The models in prisma/schema.prisma are
// inert: nothing at runtime reads them, only scripts/seed-caterer.mjs does.
//
// So on a deployment that has just been pointed at a database, this would have
// applied a migration for tables nobody reads — and worse, a `migrate deploy`
// that fails for any reason (an unreachable database, a drifted history) fails
// the BUILD, taking the whole site down over an unused schema.
//
// It is therefore opt-in now: set PRISMA_MIGRATE=1 to apply migrations. The CMS
// never needs it; it is here for whoever revives those models.
//
// prisma.config.ts resolves the migrate connection from DIRECT_URL || DATABASE_URL,
// so a pooled DATABASE_URL + direct DIRECT_URL split works as recommended.
import { execSync } from "node:child_process";

const requested = process.env.PRISMA_MIGRATE?.trim() === "1";
const configured = !!process.env.DATABASE_URL?.trim();

if (!requested) {
  console.log(
    "[build] PRISMA_MIGRATE not set — skipping Prisma migrate. The CMS store " +
      "creates its own tables; the Prisma models are inert."
  );
  process.exit(0);
}

if (!configured) {
  console.log(
    "[build] PRISMA_MIGRATE=1 but DATABASE_URL is not set — nothing to migrate."
  );
  process.exit(0);
}

console.log(
  "[build] PRISMA_MIGRATE=1 — applying Prisma migrations (prisma migrate deploy)…"
);
execSync("npx prisma migrate deploy", { stdio: "inherit" });
