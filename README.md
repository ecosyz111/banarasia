# Banarasia Buffet Art

Marketing site and content-management console for Banarasia Buffet Art, a
premium pure-veg and Jain wedding caterer in Lucknow.

Extracted from the `webtemp` monorepo (`Zeeshaan-23/webtemp`, commits
`4351869..1022c9d`) into a standalone application.

## Layout

| Path | What it is |
| --- | --- |
| `/` (and `/sample-caterer`) | The public site — one static page, `public/sample-caterer/index.html` |
| `/caterer-admin` | The CMS console: packages, gallery, about, image upload |
| `/admin/login` | Token login; sets the session cookie the write APIs require |
| `/api/caterer/content` | Public read — the single endpoint the static page fetches |
| `/api/caterer/{packages,gallery,about,upload}` | Admin CRUD, all gated by `requireAdmin` |

The public page is plain HTML with Tailwind from CDN and Google Fonts. It is
not part of the React tree — Next serves it straight from `public/`, and it
hydrates its content with one `fetch('/api/caterer/content')` on load.

## Running it

```bash
npm install
cp .env.example .env.local     # set ADMIN_TOKEN
npm run dev
```

Then open http://localhost:3000 for the site and
http://localhost:3000/caterer-admin for the console.

With no `ADMIN_TOKEN` set, development logins accept any password and log a
warning. Production returns 503 until you configure one.

## Persistence

Everything lives on the app's own disk — there is no database and no object
store at runtime:

| Path | Contents |
| --- | --- |
| `data/caterer/content.json` | All CMS content, one JSON snapshot (`src/lib/caterer/store.ts`) |
| `public/uploads/caterer/` | Uploaded images, named `<kind>_<timestamp>_<hash>.<ext>` |

Both are gitignored, and both must survive a restart, so **deploy somewhere
with a persistent filesystem** — a VPS, or a container with those two paths on
a mounted volume. Serverless hosting does not work: on Vercel `process.cwd()`
is a read-only `/var/task`, so image uploads fail outright, and the store falls
back to `/tmp` where every edit is lost on the next cold start.

Back up by copying those two paths; restore by putting them back. If
`content.json` is missing on boot the store serves the seed content in
`INITIAL_DEFAULTS` and writes a fresh file on the first edit.

Uploaded images are served by `src/app/uploads/caterer/[filename]/route.ts`,
not by Next's static handling of `public/`. Next indexes `public/` when the app
is **built**, so under `next start` a file written after that point 404s — the
console would report a successful upload and the photo would never appear until
the next rebuild. The route reads the directory per request, so it doesn't.

## The Prisma models are inert

`prisma/schema.prisma` defines `CatererPackage`, `CatererGalleryItem`, and
`CatererAbout`, and there is a migration for them. **Nothing at runtime uses
them.** The identically-named symbols in `store.ts` and the admin page are
TypeScript types, not Prisma models. Only `scripts/seed-caterer.mjs` opens a
database connection, and it seeds tables the app never reads.

They came across from the source fork, where a Postgres layer was added and
then superseded by the file store. Two ways forward:

- **The JSON file is final** — delete `prisma/`, `prisma.config.ts`,
  `scripts/seed-caterer.mjs`, `scripts/migrate-if-configured.mjs`, and the
  `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `@types/pg`
  dependencies. Nothing else changes.
- **Postgres is the plan** — wire `store.ts` to Prisma and keep them.

Leaving `DATABASE_URL` unset is safe either way: the build skips migrations.

## Known follow-ups

Carried over from the source and worth fixing before launch:

- `og:url` in `index.html` still points at `openidea.co.in/sample-caterer`.
- The WhatsApp link is the placeholder `wa.me/919999999999`.
- `/caterer-admin` and `/sample-caterer` are monorepo-era route names; `/admin`
  and `/` would read better now that this is its own product.
- `/caterer-admin` guards on a `localStorage` flag client-side. That is a UX
  hint only — the server-side gate on the APIs is what actually protects data.
