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

`src/lib/caterer/store.ts` is a dual-mode store, selected by
`BLOB_READ_WRITE_TOKEN`:

- **set** — Vercel Blob, under `system/caterer/`
- **unset** — local files under `data/caterer/`

Either way the layout is the same: **one JSON file per record**, so a save
rewrites only the record that changed rather than the whole catalogue.

```
data/caterer/
├── manifest.json              marks the store as initialised
├── packages/pkg-silver.json   one file per package
├── gallery/gal-1.json         …per gallery item, venue, cuisine,
├── venues/ven-1.json             service, feature, testimonial, lead
├── about.json                 single-record sections
├── settings.json
└── site.json
```

`manifest.json` is what tells an empty `cuisines/` directory apart from a store
that has never been written — without it the first read cannot know whether to
seed from defaults or respect a collection the owner deliberately emptied.

A store still in the old single-file `content.json` layout is read once and
re-sharded on its next write, so no manual migration is needed.

On Vercel without the token the files land in `/tmp`, so every edit is lost on
the next cold start. Set the token in any deployed environment.

Image uploads follow the same switch: Blob under `caterer/gallery/` when the
token is set, otherwise `public/uploads/caterer/`.

### Seeding

A store with no data of its own falls back to `src/lib/caterer/seed-data.json`
(118 records) and writes it out on the first save. To materialise those files
up front for local development:

```bash
npm run seed:shards           # write any shard that is missing
npm run seed:shards -- --force  # overwrite existing shards too
```

Existing files are left alone unless `--force` is passed, so it cannot silently
revert content you have already edited.

## The Prisma models are inert

`prisma/schema.prisma` defines `CatererPackage`, `CatererGalleryItem`, and
`CatererAbout`, and there is a migration for them. **Nothing at runtime uses
them.** The identically-named symbols in `store.ts` and the admin page are
TypeScript types, not Prisma models. Only `scripts/seed-caterer.mjs` opens a
database connection, and it seeds tables the app never reads.

They came across from the source fork, where a Postgres layer was added and
then superseded by the blob store. Two ways forward:

- **Blob store is final** — delete `prisma/`, `prisma.config.ts`,
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
