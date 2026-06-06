# Third-Party Notices

`@absolutejs/dataset-github` accesses third-party data **at runtime** by querying
the source's public API. It does **not** bundle, embed, or redistribute any
third-party dataset.

## GitHub — REST API

This package retrieves organization, public-membership, and public user-profile
data from the GitHub REST API (<https://api.github.com>).

- **Terms:** Use is governed by the GitHub Terms of Service and Acceptable Use
  Policies (<https://docs.github.com/site-policy>). Only **public** data is
  accessed (`/orgs/{org}`, `/orgs/{org}/public_members`, `/users/{login}`).
  Provide a GitHub token (`token` option) for an authenticated rate limit, and a
  descriptive `User-Agent` as GitHub requires.
- **Personal data:** profile fields (incl. any public email) are provided by
  users on GitHub. Callers are responsible for handling this data lawfully
  (GDPR/CCPA, GitHub's API restrictions on using data for spam/bulk outreach).
- **Trademarks:** "GitHub" is a trademark of GitHub, Inc. (a Microsoft company).
  This package is not affiliated with, endorsed by, or sponsored by GitHub.

## Runtime dependencies

This package bundles no third-party runtime dependencies. `@absolutejs/discover`
is a peer dependency, used only for the TypeScript types.
