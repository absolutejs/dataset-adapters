# @absolutejs/dataset-github

A [`@absolutejs/discover`](https://www.npmjs.com/package/@absolutejs/discover)
**DatasetSource** over the GitHub REST API — for the **tech long tail** SEC EDGAR
misses: private startups with a GitHub org.

```ts
import { githubSource } from "@absolutejs/dataset-github";

const gh = githubSource({ token: process.env.GITHUB_TOKEN });

await gh.findCompany({ name: "Vercel", domain: "vercel.com" });
// → { name: "Vercel", domain: "vercel.com", registryId: "vercel", source: "github" }

await gh.findPeople({ company: "Vercel", domain: "vercel.com", limit: 5 });
// → [ { fullName: "...", title: "co-founder", company: "Vercel",
//       email: "<if public>", source: "github", confidence: 65 }, … ]
```

## What it does — and doesn't

`findCompany` resolves a company to its GitHub **org** (by domain SLD, normalized
name, then org search). `findPeople` lists the org's **public members** and
surfaces only those whose **bio signals leadership** (founder / exec / lead) —
not every engineer — with a **public email** when the profile exposes one (which
lets the caller skip email-pattern-guessing for that person).

**Scope / honest limits:**
- Only companies with a **public GitHub org** and **public members** (most users
  default membership + email to private), so coverage is spotty.
- People are **engineers/founders** — ideal for technical / dev-rel partnerships,
  not sales/BD.
- A lookup costs ~15 API calls (org + members + per-member profiles). **Provide a
  `token`** — unauthenticated GitHub is 60 req/hr; authenticated is 5000/hr.

Apache-2.0. Pure importer of public GitHub data — see `THIRD_PARTY_NOTICES.md`.
Callers are responsible for using any personal data (incl. emails) lawfully.
