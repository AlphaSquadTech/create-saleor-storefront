# @alphasquad/create-saleor-storefront

CLI to scaffold a Saleor tenant storefront by selecting one of three AlphaSquad core templates:

- `basic` -> `@alphasquad/saleor-template-basic`
- `standard` -> `@alphasquad/saleor-template-standard`
- `advance` -> `@alphasquad/saleor-template-advance`

## Usage

```bash
npx @alphasquad/create-saleor-storefront@latest my-tenant
```

Interactive flow:
1. Select `basic`, `standard`, or `advance`.
2. Prompt for all configurable values discovered from template config (prefers `template/config.schema.json`, falls back to `.env.example`).
3. Scaffold a tenant wrapper repo locally.

## Flags

```bash
--template <basic|standard|advance>
--config <path-to-json>
--yes
--package-manager <npm|pnpm|yarn>
--no-install
--ci
--no-ci
```

## Headless example

```bash
npx @alphasquad/create-saleor-storefront@latest my-tenant \
  --template standard \
  --config ./tenant-config.json \
  --package-manager npm \
  --yes \
  --ci
```

`tenant-config.json` supports:

```json
{
  "template": "standard",
  "ci": true,
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.example.com/graphql/",
    "NEXT_PUBLIC_SITE_URL": "https://shop.example.com"
  }
}
```

## Update propagation model

Generated tenant repos depend on one base template npm package. Template updates propagate by updating that dependency.

If CI is enabled, `template-sync.yml`:
- runs every 6 hours and on `repository_dispatch`
- updates template package to `@latest`
- runs checks
- opens a PR and enables auto-merge

This is the mechanism that reflects base template updates in tenant repos.

## Local development

```bash
npm install
npm run typecheck
```

## Automated publishing

This repo publishes to npm via GitHub Actions:

- `.github/workflows/ci.yml` runs typecheck on PRs and `main`.
- `.github/workflows/publish.yml` publishes on tag push matching `v*.*.*`.

Release flow:

```bash
# 1) bump package.json version
# 2) commit + push to main
git tag vX.Y.Z
git push origin vX.Y.Z
```

The publish workflow verifies that `vX.Y.Z` matches `package.json` version before publishing.

Required repo secret:

- `NPM_TOKEN` with publish access for `@alphasquad/*`
