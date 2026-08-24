// Upstash Redis over its REST API — the production store.
//
// Asked in three places — the content store, the uploader and the image route —
// which must all agree, for the reason ./blob spells out: a disagreement means
// content written to one backend and read from another.
//
// WHY REST AND NOT A CLIENT LIBRARY. Upstash's REST endpoint is one POST with a
// JSON array — ["GET", "key"] — and a {"result": …} back. Wrapping that costs
// less than the dependency would, and it keeps the whole protocol surface of
// this app visible in one file.
//
// WHY REDIS AND NOT THE DISK. On serverless there is no disk to speak of: the
// bundle is read-only and /tmp belongs to one instance and is wiped on the next
// cold start. Something outside the instance has to hold the content, and an
// HTTP key-value store is the least machinery that does it — no connection
// pool to size, nothing to wake up, no cold-start penalty on the first query.
import "server-only";

// FINDING THE CREDENTIALS.
//
// Upstash's own names are UPSTASH_REDIS_REST_URL / _TOKEN, and Vercel's KV
// integration used KV_REST_API_URL / _TOKEN. But connecting the store through
// Vercel's marketplace offers a "custom prefix" that renames everything it
// injects, so the pair can arrive called anything at all — and a deployment
// whose variables are spelled unexpectedly would silently fall through to
// another backend and serve the seed.
//
// So: the known names first, then whatever pair the environment actually holds,
// recognised by the URL pointing at upstash.io and a token sitting under the
// same prefix. Two candidate pairs is refused rather than guessed — picking the
// wrong store would write this site's content into another one.
type RedisCredentials = { url: string; token: string };

const KNOWN_PAIRS: [string, string][] = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
];

// The token that belongs with a URL variable, tried in the order the
// integrations name them: <PREFIX>_REST_API_TOKEN beside a _REST_API_URL,
// <PREFIX>_TOKEN beside a plain _URL.
const TOKEN_SUFFIXES = ["_REST_API_TOKEN", "_REST_TOKEN", "_TOKEN"];

function isUpstashUrl(value: string | undefined): boolean {
  return Boolean(value && /^https:\/\/[^\s]+\.upstash\.io\/?$/.test(value.trim()));
}

function discoverPairs(): RedisCredentials[] {
  const found: RedisCredentials[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.endsWith("_URL") || !isUpstashUrl(value)) continue;
    const prefix = key.replace(/_REST_API_URL$|_REST_URL$|_URL$/, "");
    for (const suffix of TOKEN_SUFFIXES) {
      const token = process.env[`${prefix}${suffix}`]?.trim();
      if (token) {
        found.push({ url: value!.trim(), token });
        break;
      }
    }
  }
  return found;
}

export function redisCredentials(): RedisCredentials | null {
  for (const [urlKey, tokenKey] of KNOWN_PAIRS) {
    const url = process.env[urlKey]?.trim();
    const token = process.env[tokenKey]?.trim();
    if (url && token) return { url, token };
  }

  const discovered = discoverPairs();
  if (discovered.length === 1) return discovered[0];
  if (discovered.length > 1) {
    throw new Error(
      "More than one Upstash Redis credential pair is present in the environment. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN explicitly to say which store this site uses."
    );
  }
  return null;
}

export function isRedisConfigured(): boolean {
  return redisCredentials() !== null;
}

// Every key this app owns starts with this, so one Upstash database can hold
// several sites. Two deployments of this codebase would otherwise both write
// `caterer:shard:packages/pkg-silver.json` and serve each other's content.
//
// Change it only with data in mind: pointing a live deployment at a different
// prefix does not move its records, it hides them behind an empty store that
// then seeds itself.
const DEFAULT_PREFIX = "caterer";

export function keyPrefix(): string {
  const configured = process.env.CATERER_REDIS_PREFIX?.trim();
  // Colons separate our namespace segments, so one inside the prefix would
  // shift every key's meaning; a space would make keys awkward to inspect.
  if (configured && /[:\s]/.test(configured)) {
    throw new Error(
      `CATERER_REDIS_PREFIX must not contain ':' or whitespace, got: ${configured}`
    );
  }
  return configured || DEFAULT_PREFIX;
}

export function shardKey(rel: string): string {
  return `${keyPrefix()}:shard:${rel}`;
}

export function uploadKey(name: string): string {
  return `${keyPrefix()}:upload:${name}`;
}

type RedisReply = { result?: unknown; error?: string };

// One command, one round trip. Upstash answers 200 with {"error": …} for a
// command Redis rejected, so a non-ok status is not the only failure to check.
export async function redisCommand<T = unknown>(args: (string | number)[]): Promise<T> {
  const credentials = redisCredentials();
  if (!credentials) {
    throw new Error(
      "Upstash Redis is not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }
  const { url, token } = credentials;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.map(String)),
    // The store's own in-memory copy is the cache; a cached HTTP response here
    // would serve a save back stale and undo the point of the revalidation.
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Upstash ${args[0]} failed: ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`
    );
  }

  const body = (await res.json()) as RedisReply;
  if (body.error) throw new Error(`Upstash ${args[0]} failed: ${body.error}`);
  return body.result as T;
}

// SCAN rather than KEYS: KEYS blocks the server for the whole keyspace, and
// this database may be shared with other sites. The cursor is followed to the
// end because a SCAN page can come back empty while more keys remain — a
// first-page-only read would report records as deleted.
export async function redisScan(match: string): Promise<string[]> {
  const found: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await redisCommand<[string, string[]]>([
      "SCAN",
      cursor,
      "MATCH",
      match,
      "COUNT",
      "1000",
    ]);
    found.push(...batch);
    cursor = next;
  } while (cursor !== "0");
  // SCAN can return the same key twice across pages when the keyspace changes
  // under it, which would show as a duplicate record.
  return [...new Set(found)];
}
