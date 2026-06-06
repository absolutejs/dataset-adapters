import type { DatasetSource, NormalizedCompany } from "@absolutejs/discover";

const GLEIF_API = "https://api.gleif.org/api/v1";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_PAGE_SIZE = 10;

// Shared name normalizer — used both to BUILD the snapshot's lookup key and to
// QUERY it, so the two always agree. Lowercases, strips punctuation + common
// legal suffixes, collapses whitespace ("Stripe, Inc." → "stripe").
export const normalizeCompanyName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(
      /\b(inc|incorporated|corp|corporation|llc|llp|lp|ltd|limited|co|company|gmbh|ag|sa|bv|nv|plc|holding|holdings|group|the)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

type GleifEntity = {
  legalName?: { name?: string };
  legalAddress?: { country?: string };
  status?: string;
};
type GleifRecord = { attributes?: { lei?: string; entity?: GleifEntity } };
type GleifResponse = { data?: GleifRecord[] };

// Snapshot (SQLite) read path — opened lazily + once per file, read-only.
type SnapshotRow = {
  lei: string;
  name: string;
  country: string | null;
  status: string | null;
};
const snapshotLookups = new Map<
  string,
  (norm: string) => SnapshotRow | null
>();

const getSnapshotLookup = async (path: string) => {
  const existing = snapshotLookups.get(path);
  if (existing) return existing;
  const { Database } = await import("bun:sqlite");
  const db = new Database(path, { readonly: true });
  const statement = db.query<SnapshotRow, [string]>(
    "SELECT lei, name, country, status FROM company WHERE norm_name = ?1 ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END LIMIT 1",
  );
  const lookup = (norm: string) => statement.get(norm);
  snapshotLookups.set(path, lookup);

  return lookup;
};

const toCompany = (record: GleifRecord): NormalizedCompany | null => {
  const entity = record.attributes?.entity;
  const name = entity?.legalName?.name?.trim();
  if (!name) return null;

  return {
    country: entity?.legalAddress?.country ?? undefined,
    name,
    registryId: record.attributes?.lei ?? undefined,
    source: "gleif",
  };
};

export type GleifOptions = {
  /** Inject a fetch (proxy, test stub). Defaults to global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Only consider ACTIVE legal entities (default true). */
  activeOnly?: boolean;
  /** Path to a SQLite snapshot built by the snapshot generator (see scripts/).
   *  When set, findCompany resolves from it first — instant, offline, no rate
   *  limit — and falls back to the live API only on a miss. */
  snapshotPath?: string;
};

// GLEIF (Global Legal Entity Identifier Foundation) — a `@absolutejs/discover`
// DatasetSource over the open, CC0 LEI registry. Provides `findCompany` only:
// GLEIF is LEGAL ENTITIES, not people, so it canonicalizes a company to its
// official legal name + jurisdiction/country + LEI (the key to follow up for
// parent/subsidiary relationships). It does NOT carry domains, so matching is by
// name and inherently ambiguous (a fulltext "Stripe" can hit an unrelated "Stripe
// B.V."); treat a hit as "a legal entity by this name", not a certainty.
export const gleifSource = (options: GleifOptions = {}): DatasetSource => {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const activeOnly = options.activeOnly ?? true;

  const findCompany: NonNullable<DatasetSource["findCompany"]> = async ({
    name,
  }) => {
    const query = name?.trim();
    if (!query) return null;

    // 1. Local snapshot first (instant, offline). Miss → fall to the live API.
    if (options.snapshotPath) {
      try {
        const lookup = await getSnapshotLookup(options.snapshotPath);
        const row = lookup(normalizeCompanyName(query));
        if (row) {
          return {
            country: row.country ?? undefined,
            name: row.name,
            registryId: row.lei,
            source: "gleif",
          };
        }
      } catch {
        // snapshot unreadable → fall through to the live API
      }
    }

    // 2. Live GLEIF API.
    const params = new URLSearchParams();
    params.set("filter[fulltext]", query);
    params.set("page[size]", String(DEFAULT_PAGE_SIZE));

    let body: GleifResponse;
    try {
      const response = await doFetch(`${GLEIF_API}/lei-records?${params}`, {
        headers: { Accept: "application/vnd.api+json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      body = await response.json();
    } catch {
      return null;
    }

    const records = body.data ?? [];
    const eligible = activeOnly
      ? records.filter((record) => record.attributes?.entity?.status === "ACTIVE")
      : records;
    // Prefer an exact (case-insensitive) legal-name match, else the best
    // eligible record, else the first raw result.
    const target = query.toLowerCase();
    const exact = eligible.find(
      (record) =>
        record.attributes?.entity?.legalName?.name?.toLowerCase() === target,
    );
    const pick = exact ?? eligible[0] ?? records[0];

    return pick ? toCompany(pick) : null;
  };

  return { findCompany, name: "gleif" };
};
