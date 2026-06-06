import type { DatasetSource, NormalizedPerson } from "@absolutejs/discover";

const API = "https://api.github.com";
const DEFAULT_UA = "AbsoluteJS-dataset-github";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_MEMBERS = 15;
const LEADER_CONFIDENCE = 65;

// Leadership / decision-maker signals in a GitHub bio. We surface only members
// whose bio matches — founders/execs/leads — not every engineer.
const LEADERSHIP_RE =
  /\b(co-?founders?|founders?|ceo|cto|coo|cfo|cmo|chief\s+\w+\s+officer|president|vice\s+president|vp\b|head\s+of\s+[a-z ]+|director\s+of\s+[a-z ]+|partnerships?|business\s+development)\b/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

// Second-level label of a host: "vercel.com" / "sub.vercel.com" → "vercel".
// (ccTLDs like "co.uk" aren't special-cased — a known heuristic limit.)
const domainSld = (domain: string) => {
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const parts = (host ?? "").split(".").filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];

  return parts[0];
};

const bareDomain = (url: string) => {
  const host = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

  return host || undefined;
};

export type GithubOptions = {
  /** A GitHub token for an authenticated rate limit (5000/hr vs 60/hr).
   *  Strongly recommended — a lookup costs ~15 calls. */
  token?: string;
  userAgent?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Max public members inspected per lookup (default 15). */
  maxMembers?: number;
};

// GitHub — a `@absolutejs/discover` DatasetSource for the TECH long tail SEC
// misses (private startups with a GitHub org). `findCompany` resolves the org;
// `findPeople` returns the org's PUBLIC members whose bio signals leadership
// (founders/execs/leads), with a public email when the profile exposes one.
// SCOPE/limits: only companies with a public GitHub org + public members; people
// are engineers/founders (great for technical/dev-rel partnerships, not sales);
// most users hide their email + org membership. Provide a `token`.
export const githubSource = (options: GithubOptions = {}): DatasetSource => {
  const doFetch = options.fetch ?? fetch;
  const userAgent = options.userAgent ?? DEFAULT_UA;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxMembers = options.maxMembers ?? DEFAULT_MAX_MEMBERS;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": userAgent,
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  };

  const getJson = async (path: string): Promise<unknown> => {
    try {
      const response = await doFetch(`${API}${path}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  };

  const fetchOrg = async (login: string) => {
    const data = await getJson(`/orgs/${encodeURIComponent(login)}`);

    return isRecord(data) && data["type"] === "Organization" ? data : null;
  };

  const firstOrg = async (
    candidates: string[],
  ): Promise<Record<string, unknown> | null> => {
    const [head, ...rest] = candidates;
    if (!head) return null;
    const org = await fetchOrg(head);

    return org ?? firstOrg(rest);
  };

  const resolveOrg = async (
    name: string | undefined,
    domain: string | undefined,
  ) => {
    const candidates: string[] = [];
    if (domain) {
      const sld = domainSld(domain);
      if (sld) candidates.push(sld);
    }
    if (name) {
      const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalized) candidates.push(normalized);
    }
    const direct = await firstOrg([...new Set(candidates)]);
    if (direct) return direct;
    if (!name) return null;
    // Fallback: org search by name.
    const search = await getJson(
      `/search/users?q=${encodeURIComponent(name)}+type:org&per_page=1`,
    );
    const items =
      isRecord(search) && Array.isArray(search["items"]) ? search["items"] : [];
    const first = items[0];
    const login = isRecord(first) ? asString(first["login"]) : undefined;

    return login ? fetchOrg(login) : null;
  };

  const findCompany: NonNullable<DatasetSource["findCompany"]> = async ({
    name,
    domain,
  }) => {
    const org = await resolveOrg(name, domain);
    const login = org ? asString(org["login"]) : undefined;
    if (!org || !login) return null;
    const blog = asString(org["blog"]);

    return {
      domain: blog ? bareDomain(blog) : undefined,
      name: asString(org["name"]) ?? login,
      registryId: login,
      source: "github",
    };
  };

  const findPeople: NonNullable<DatasetSource["findPeople"]> = async (query) => {
    const org = await resolveOrg(query.company, query.domain);
    const login = org ? asString(org["login"]) : undefined;
    if (!org || !login) return [];
    const orgName = asString(org["name"]) ?? login;

    const members = await getJson(
      `/orgs/${login}/public_members?per_page=${maxMembers}`,
    );
    const memberLogins = Array.isArray(members)
      ? members.flatMap((member) => {
          const memberLogin = isRecord(member)
            ? asString(member["login"])
            : undefined;

          return memberLogin ? [memberLogin] : [];
        })
      : [];

    const profiles = await Promise.all(
      memberLogins.map(async (memberLogin): Promise<NormalizedPerson | null> => {
        const user = await getJson(`/users/${encodeURIComponent(memberLogin)}`);
        if (!isRecord(user)) return null;
        const bio = asString(user["bio"]) ?? "";
        // Only the CURRENT part of the bio — drop anything after a "before /
        // previously / ex-" marker so a PAST founder/exec role at another company
        // doesn't get mislabeled as their role here.
        const currentBio =
          bio.split(/\b(?:before|previously|formerly|prev|ex[-\s])/i)[0] ?? bio;
        const leadership = currentBio.match(LEADERSHIP_RE);
        if (!leadership) return null; // decision-makers only, not every engineer

        return {
          company: orgName,
          confidence: LEADER_CONFIDENCE,
          email: asString(user["email"]),
          fullName: asString(user["name"]) ?? memberLogin,
          source: "github",
          title: leadership[0],
        };
      }),
    );

    const people = profiles.flatMap((person) => (person ? [person] : []));

    return query.limit ? people.slice(0, query.limit) : people;
  };

  return { findCompany, findPeople, name: "github" };
};
