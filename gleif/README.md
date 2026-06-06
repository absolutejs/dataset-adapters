# @absolutejs/dataset-gleif

A [`@absolutejs/discover`](https://www.npmjs.com/package/@absolutejs/discover)
**DatasetSource** over [GLEIF](https://www.gleif.org/en/about/open-data) — the
Global Legal Entity Identifier registry, published as open **CC0** data.

```ts
import { gleifSource } from "@absolutejs/dataset-gleif";
import { discoverContacts } from "@absolutejs/discover";

const gleif = gleifSource();

await gleif.findCompany({ name: "Stripe, Inc." });
// → { name: "STRIPE, INC.", country: "US", registryId: "<LEI>", source: "gleif" }

// Or hand it to discover as a seed source consulted before LLM/web:
await discoverContacts({ company: "Acme" }, { sources: [gleif], extract });
```

## What it does — and doesn't

GLEIF is **legal entities, not people**, so this adapter implements **`findCompany`
only**. It canonicalizes a name to its official legal entity and returns the
**LEI** (`registryId`) — the key to follow up for parent/subsidiary relationships
in the GLEIF graph — plus the registered country.

**Honest limits:** GLEIF carries **no domains**, so matching is by name and is
inherently ambiguous — a fulltext `"Stripe"` can surface an unrelated `"Stripe
B.V."`. Treat a hit as *"a legal entity by this name"*, not a certainty. It also
has no industry, headcount, or contacts — pair it with `@absolutejs/discover`
(people) and `@absolutejs/enrich` (emails). Defaults to ACTIVE entities only.

## Offline snapshot — no rate limits, no network

For high-volume or offline use, build a local SQLite index from GLEIF's full
**Golden Copy** dump (~2.7M entities) and point the adapter at it:

1. **Download** the Golden Copy (LEI2, CSV or `.zip`) from
   <https://goldencopy.gleif.org> (it's CC0). Their bulk host WAF-blocks many
   data-center IPs, so fetch it from a browser / allowed network — this tool does
   not download it for you.
2. **Build** the snapshot:
   ```sh
   bunx gleif-snapshot golden-copy.zip gleif-snapshot.sqlite
   # or: bun run node_modules/@absolutejs/dataset-gleif/dist/snapshot.js <file> [out]
   ```
3. **Use** it:
   ```ts
   gleifSource({ snapshotPath: "gleif-snapshot.sqlite" });
   ```
   `findCompany` resolves from the snapshot — instant, offline, zero rate limits —
   falling back to the live API only on a miss. Re-run the generator to refresh
   (GLEIF republishes 3×/day). Snapshot reads use `bun:sqlite` (loaded lazily;
   live-only use needs nothing).

Apache-2.0. Pure importer of public CC0 data — the self-collected, self-healing
dataset is deliberately not part of any adapter.
