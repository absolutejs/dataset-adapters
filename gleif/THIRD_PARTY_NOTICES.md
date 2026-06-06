# Third-Party Notices

`@absolutejs/dataset-gleif` accesses third-party data **at runtime** by querying
the source's public API. It does **not** bundle, embed, or redistribute any
third-party dataset.

## GLEIF — Global Legal Entity Identifier Foundation

This package retrieves Legal Entity Identifier (LEI) records from the GLEIF API
(<https://api.gleif.org>).

- **License:** GLEIF publishes LEI data under the **Creative Commons CC0 1.0
  Universal Public Domain Dedication**
  (<https://creativecommons.org/publicdomain/zero/1.0/>). No attribution is
  legally required; this notice is provided as acknowledgment.
- **Source / terms:** <https://www.gleif.org/en/about/open-data>
- **Trademarks:** "GLEIF" and "LEI" (Legal Entity Identifier) are marks of the
  Global Legal Entity Identifier Foundation. This package is not affiliated with,
  endorsed by, or sponsored by GLEIF.

## Runtime dependencies

This package bundles no third-party runtime dependencies. `@absolutejs/discover`
is a peer dependency, used only for the `DatasetSource` / `NormalizedCompany`
TypeScript types.
