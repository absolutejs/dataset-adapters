# Third-Party Notices — dataset-adapters

Every adapter in this monorepo accesses third-party data **at runtime** via the
source's public API. No adapter bundles, embeds, or redistributes any third-party
dataset. Each published subpackage carries its own `THIRD_PARTY_NOTICES.md` with
the authoritative attribution for the source(s) it uses; this file is the master
index.

**Convention (applies to every adapter, current and future):** a new
`@absolutejs/dataset-<name>` subpackage MUST ship a `THIRD_PARTY_NOTICES.md` in
its `files` allowlist that names the data source, its license/terms, links to the
source and license, and notes any trademark and any attribution/share-alike
obligation (e.g. OpenCorporates' open-use terms, unlike CC0/public-domain
sources). Add the source to the table below.

| Adapter | Source | License / terms | Attribution required |
|---|---|---|---|
| `@absolutejs/dataset-gleif` | [GLEIF LEI data](https://www.gleif.org/en/about/open-data) | CC0 1.0 (public-domain dedication) | No (acknowledged anyway) |
| `@absolutejs/dataset-sec-edgar` | [SEC EDGAR](https://www.sec.gov/os/webmaster-faq#developers) | U.S. government work — public domain (17 U.S.C. §105) | No (fair-access UA required) |

Trademarks named in the per-package notices ("GLEIF", "LEI", "EDGAR", "SEC", …)
belong to their respective owners; these adapters are not affiliated with or
endorsed by them.
