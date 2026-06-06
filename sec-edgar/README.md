# @absolutejs/dataset-sec-edgar

A [`@absolutejs/discover`](https://www.npmjs.com/package/@absolutejs/discover)
**DatasetSource** over [SEC EDGAR](https://www.sec.gov/os/webmaster-faq#developers)
— public-domain U.S. government filings. Unlike most open company data, this one
carries **people**: it implements both `findCompany` (CIK) and `findPeople`
(insiders).

```ts
import { secEdgarSource } from "@absolutejs/dataset-sec-edgar";

const sec = secEdgarSource({ userAgent: "MyApp (me@example.com)" });

await sec.findCompany({ name: "Shopify" });
// → { name: "SHOPIFY INC.", registryId: "CIK0001594805", source: "sec-edgar" }

await sec.findPeople({ company: "Apple", limit: 5 });
// → [ { fullName: "Kevan Parekh", title: "Senior Vice President, CFO", … },
//     { fullName: "Sabih Khan", title: "COO", … }, … ]
```

It hands `discoverContacts` real names+titles to seed from before the LLM/web call:

```ts
discoverContacts({ company: "Apple" }, { sources: [sec], extract });
```

## What it does — and doesn't

`findPeople` reads a company's recent **Form 3/4/5 ownership filings** and returns
the **insiders** (officers + directors) with their titles, names de-inverted from
SEC's `LAST FIRST` format. `findCompany` resolves a name to its **CIK**.

**Scope (be honest):** U.S. **public** companies only, and insiders are
**C-suite / board** — not necessarily the partnership contact, and nothing for
the private startups that make up the long tail. Authoritative for what it
covers; pair it with `@absolutejs/discover`'s LLM/web path for everything else.

**SEC fair access:** set `userAgent` to your own app + contact (SEC requires a
descriptive User-Agent and asks for <10 req/s). The adapter reads only a small,
bounded number of filings per lookup and caches the ticker index in memory.

Apache-2.0. Pure importer of public-domain data — see `THIRD_PARTY_NOTICES.md`.
