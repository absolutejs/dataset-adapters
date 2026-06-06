# Third-Party Notices

`@absolutejs/dataset-sec-edgar` accesses third-party data **at runtime** by
querying the source's public API. It does **not** bundle, embed, or redistribute
any third-party dataset.

## SEC EDGAR — U.S. Securities and Exchange Commission

This package retrieves company (CIK) and insider data from the SEC EDGAR system
(<https://www.sec.gov>, <https://data.sec.gov>) — `company_tickers.json`, the
submissions API, and Form 3/4/5 ownership filings.

- **License:** Works of the U.S. federal government are **not subject to
  copyright** in the United States (17 U.S.C. §105) — SEC EDGAR data is in the
  **public domain**. No attribution is legally required.
- **Fair access:** SEC requires a descriptive `User-Agent` identifying the
  requester and asks clients to stay under 10 requests/second. This adapter sends
  a `User-Agent` (set `userAgent` to your own app + contact, per SEC policy) and
  reads only a small, bounded number of filings per lookup.
- **Source / terms:** <https://www.sec.gov/os/webmaster-faq#developers>
- **Trademarks:** "SEC" and "EDGAR" are marks of the U.S. Securities and Exchange
  Commission. This package is not affiliated with, endorsed by, or sponsored by
  the SEC.

## Runtime dependencies

This package bundles no third-party runtime dependencies. `@absolutejs/discover`
is a peer dependency, used only for the TypeScript types.
