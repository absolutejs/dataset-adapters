import type { DatasetSource, NormalizedPerson } from "@absolutejs/discover";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS_BASE = "https://data.sec.gov/submissions";
const ARCHIVES_BASE = "https://www.sec.gov/Archives/edgar/data";
const DEFAULT_UA = "AbsoluteJS dataset-sec-edgar (https://absolutejs.com)";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_FILINGS = 8;
const INSIDER_CONFIDENCE = 70;
const CIK_PAD = 10;
const OWNERSHIP_FORMS = new Set(["3", "4", "5"]);

type TickerRow = { cik: number; title: string };

export type SecEdgarOptions = {
  /** SEC fair-access requires a descriptive User-Agent identifying you + a
   *  contact. Set this to your own app + email per SEC policy. */
  userAgent?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Max ownership filings (Form 3/4/5) read per person lookup (default 8). */
  maxFilings?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const asNumber = (value: unknown) =>
  typeof value === "number" ? value : undefined;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const titleCase = (value: string) =>
  value.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());

// SEC reports owner names as "LAST FIRST [MIDDLE/SUFFIX]" in uppercase. Move the
// surname to the end → "First Middle Last". Heuristic (multi-word surnames /
// suffixes aren't perfectly handled) but good for display + matching.
const reformatOwnerName = (raw: string) => {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return titleCase(raw.trim());
  const [surname, ...rest] = parts;

  return titleCase([...rest, surname].join(" "));
};

const normalizeCompany = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(
      /\b(inc|corp|corporation|llc|ltd|co|company|holdings|group|plc|the)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

const tagValue = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));

  return match?.[1]?.trim() || undefined;
};

const isTrue = (value: string | undefined) =>
  value === "1" || value?.toLowerCase() === "true";

// SEC EDGAR — a `@absolutejs/discover` DatasetSource over public-domain U.S.
// government filings. `findCompany` resolves a name to its CIK; `findPeople`
// returns the company's INSIDERS (officers/directors) parsed from recent Form
// 3/4/5 ownership filings. SCOPE: U.S. PUBLIC companies only, and insiders are
// C-suite/board — not necessarily the partnership contact. Authoritative for
// what it covers; pair with discover's LLM/web path for private companies + the
// long tail. Requires a fair-access User-Agent (set `userAgent`).
export const secEdgarSource = (options: SecEdgarOptions = {}): DatasetSource => {
  const doFetch = options.fetch ?? fetch;
  const userAgent = options.userAgent ?? DEFAULT_UA;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxFilings = options.maxFilings ?? DEFAULT_MAX_FILINGS;

  let tickersCache: TickerRow[] | null = null;

  const getJson = async (url: string): Promise<unknown> => {
    try {
      const response = await doFetch(url, {
        headers: { Accept: "application/json", "User-Agent": userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });

      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  };

  const getText = async (url: string) => {
    try {
      const response = await doFetch(url, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });

      return response.ok ? await response.text() : null;
    } catch {
      return null;
    }
  };

  const loadTickers = async () => {
    if (tickersCache) return tickersCache;
    const data = await getJson(TICKERS_URL);
    if (!isRecord(data)) return null;
    tickersCache = Object.values(data).flatMap((row) => {
      if (!isRecord(row)) return [];
      const cik = asNumber(row["cik_str"]);
      const title = asString(row["title"]);

      return cik !== undefined && title ? [{ cik, title }] : [];
    });

    return tickersCache;
  };

  const resolveCompany = async (name: string | undefined) => {
    const target = normalizeCompany(name?.trim() ?? "");
    if (!target) return null;
    const rows = await loadTickers();
    if (!rows) return null;
    let partial: TickerRow | null = null;
    for (const row of rows) {
      const normTitle = normalizeCompany(row.title);
      if (normTitle === target) return row;
      if (
        !partial &&
        (normTitle.startsWith(target) || target.startsWith(normTitle))
      ) {
        partial = row;
      }
    }

    return partial;
  };

  const parseFiling = async (
    cik: number,
    accession: string,
    primaryDocument: string,
    company: string,
  ): Promise<NormalizedPerson | null> => {
    const accNoDash = accession.replace(/-/g, "");
    const rawDoc = primaryDocument.split("/").pop() ?? primaryDocument;
    const xml = await getText(`${ARCHIVES_BASE}/${cik}/${accNoDash}/${rawDoc}`);
    if (!xml) return null;
    const ownerName = tagValue(xml, "rptOwnerName");
    if (!ownerName) return null;
    const title =
      tagValue(xml, "officerTitle") ??
      (isTrue(tagValue(xml, "isOfficer")) ? "Officer" : undefined) ??
      (isTrue(tagValue(xml, "isDirector")) ? "Director" : undefined);

    return {
      company,
      confidence: INSIDER_CONFIDENCE,
      fullName: reformatOwnerName(ownerName),
      source: "sec-edgar",
      title,
    };
  };

  const findCompany: NonNullable<DatasetSource["findCompany"]> = async ({
    name,
  }) => {
    const row = await resolveCompany(name);
    if (!row) return null;

    // No country: the ticker index carries none, and a US-SEC registrant can be
    // foreign (e.g. Shopify is Canadian). The CIK is the real value.
    return {
      name: row.title,
      registryId: `CIK${String(row.cik).padStart(CIK_PAD, "0")}`,
      source: "sec-edgar",
    };
  };

  const findPeople: NonNullable<DatasetSource["findPeople"]> = async (query) => {
    const row = await resolveCompany(query.company);
    if (!row) return [];
    const cikPadded = String(row.cik).padStart(CIK_PAD, "0");
    const submissions = await getJson(`${SUBMISSIONS_BASE}/CIK${cikPadded}.json`);
    const filings = isRecord(submissions) ? submissions["filings"] : null;
    const recent = isRecord(filings) ? filings["recent"] : null;
    if (!isRecord(recent)) return [];
    const forms = asStringArray(recent["form"]);
    const accessions = asStringArray(recent["accessionNumber"]);
    const docs = asStringArray(recent["primaryDocument"]);

    const targets: { accession: string; doc: string }[] = [];
    for (let index = 0; index < forms.length; index += 1) {
      if (targets.length >= maxFilings) break;
      const accession = accessions[index];
      const doc = docs[index];
      if (OWNERSHIP_FORMS.has(forms[index] ?? "") && accession && doc) {
        targets.push({ accession, doc });
      }
    }

    const parsed = await Promise.all(
      targets.map((target) =>
        parseFiling(row.cik, target.accession, target.doc, row.title),
      ),
    );

    const seen = new Set<string>();
    const deduped = parsed.filter((person): person is NormalizedPerson => {
      if (!person) return false;
      const key = person.fullName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);

      return true;
    });

    return query.limit ? deduped.slice(0, query.limit) : deduped;
  };

  return { findCompany, findPeople, name: "sec-edgar" };
};
