# AbsoluteJS Dataset Adapters

Public-data `DatasetSource` implementations for `@absolutejs/discover`. They normalize provider-specific records behind one discovery contract so applications can combine sources without baking provider logic into ranking or enrichment code.

## Packages

| Package                         | Dataset                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@absolutejs/dataset-github`    | Resolves a company’s GitHub organization and public members for technology-company contact discovery. |
| `@absolutejs/dataset-gleif`     | Resolves official legal entities, LEIs, jurisdictions, and countries from the open GLEIF registry.    |
| `@absolutejs/dataset-sec-edgar` | Resolves US public companies and officers or directors from SEC EDGAR filings.                        |

## Installation

```sh
bun add @absolutejs/discover @absolutejs/dataset-github @absolutejs/dataset-gleif @absolutejs/dataset-sec-edgar
```

Use one source or combine several through `@absolutejs/discover`. Provider READMEs document credentials, rate limits, attribution, and the exact records each source can return.
