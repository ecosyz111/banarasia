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

Content is one record per shard, behind four primitives (`read`, `listNames`,
`write`, `remove`) with three implementations. Nothing above the storage layer
knows which one is carrying it:

| | `DATABASE_URL` set | Blob store attached | neither |
| --- | --- | --- | --- |
| CMS content (`src/lib/caterer/store.ts`) | `caterer_shard` rows | `caterer/…` in Blob | `data/caterer/` |
| Uploaded images | `caterer_upload` rows | `caterer/uploads/` in Blob | `public/uploads/caterer/` |

**Postgres is the one to use on serverless**, and it wins when more than one is
configured — a project moved off Blob keeps `BLOB_STORE_ID` in its environment
long after the store stopped serving, and leaving Blob ahead would strand the
site on a backend it no longer has.

Connecting a Neon database in the Vercel dashboard is the whole configuration:
it injects `DATABASE_URL`, and `src/lib/caterer/pg.ts` creates the two tables on
first use. There is no migration step, and the inert Prisma models play no part
(the build only runs `prisma migrate deploy` when `PRISMA_MIGRATE=1`).

The tables live in the `caterer_cms` schema, and `CATERER_PG_SCHEMA` moves them.
Set it when one database is shared with another site — two deployments of this
codebase would otherwise both want `caterer_shard` in the same schema and would
serve each other's content. Changing it later does not move records; it hides
them behind an empty store that then seeds itself.

Blob works, but costs more than it looks on a Hobby plan, which meters it by
operation: one object per record, read uncached so a save is visible at once, is
an operation-hungry shape. It ran a Hobby account's monthly allowance out in a
week — Vercel then suspends the store, every read 403s, and the site has no
content to serve. The store degrades to read-only seed content rather than
failing outright when that happens, but it is not a state to run in. As rows,
the same catalogue is under a megabyte against a free half-gigabyte tier.

Disk is for local development and for a host with a persistent volume.

**The Blob store must be created with private access.** A store's access mode is
fixed at creation and applies to everything in it, and these shards include
captured leads — visitor names and phone numbers — which a public store would
expose to anyone who can derive a blob URL. Uploaded images share the store and
are therefore private too, so they are delivered through
`src/app/uploads/caterer/[filename]/route.ts` instead of by blob URL. That route
already existed for the disk backend, and it answers for both.

Either way an upload returns the same site-relative `/uploads/caterer/<file>`,
so records hold no backend-specific URL and moving between disk and Blob
rewrites no stored image path.

Content is **sharded**: one JSON file per record, so a save rewrites only the
record that changed rather than the whole catalogue.

```
manifest.json              marks the store as initialised, and carries `rev`
packages/pkg-silver.json   one file per package
gallery/gal-1.json         …per gallery item, venue, cuisine,
venues/ven-1.json             service, feature, testimonial, lead
about.json                 single-record sections
settings.json
site.json
```

`manifest.json` is what tells an empty `cuisines/` collection apart from a store
that has never been written — without it the first read cannot know whether to
seed from defaults or respect a collection the owner deliberately emptied.

It also carries `rev`, a digest of every other shard. A running instance holds
its snapshot in memory, and re-reads only the manifest — once every 10s at most
— to find out whether storage has moved on. That is what keeps several
serverless instances in step: without it, the instance that took an edit has it
and the instance answering the next page load serves its own older copy, which
is exactly what a saved package vanishing on refresh looks like. The manifest is
written last in a save, so a new `rev` never becomes visible before the records
behind it.

A store still in the old single-file `content.json` layout is read once and
re-sharded on its next write, so no manual migration is needed.

Back up by copying the store (`vercel blob` CLI, or the `data/caterer/`
directory); restore by putting it back. If the store is missing on boot the app
serves the seed content in `INITIAL_DEFAULTS` and writes fresh shards on the
first edit.

`src/app/uploads/caterer/[filename]/route.ts` serves uploads on both backends,
for a different reason each time. On Blob, a private blob has no public URL, so
delivery through a function is the only way. On disk, Next indexes `public/`
when the app is **built**, so under `next start` a file written after that point
404s — the console would report a successful upload and the photo would never
appear until the next rebuild. The route reads per request, so it doesn't.

Filenames carry a timestamp and a random hash and are never reused, so the route
answers with `immutable` and a one-year max-age. On Blob that is also what keeps
a page of photos from costing one function invocation per image per visit.

### Seeding

A store with no data of its own falls back to `src/lib/caterer/seed-data.json`
and writes it out on the first save. It holds a **small starter set** — 3
packages, 6 gallery photos, 3 venues, 8 cuisines, 8 services, 6 why-us cards, 4
reviews — the content the public page is written around.

Keep it that small. The file once shipped 118 sample records, which read as
genuine content on the live site (invented reviews, venues nobody had booked)
and reappeared on every fresh deploy. Anything added here is published as if the
owner had entered it.

On a host where the store cannot persist — serverless with no Blob store
attached — this file stops being a fallback and becomes the whole
content layer, because every admin edit is discarded on the next cold start.
What is in here is then what the deployed site serves, and an empty seed means an
empty site with an admin console reading 0 in every tab.

To materialise the seed files up front for local development:

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
