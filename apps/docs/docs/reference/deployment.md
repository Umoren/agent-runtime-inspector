# Deploy the docs site

ARI's public documentation site is built from `apps/docs` and runs at:

```text
https://ari.umoren.xyz
```

The root `vercel.json` config builds the Docusaurus app from the monorepo root:

```json
{
  "buildCommand": "pnpm --filter @ari/docs build",
  "outputDirectory": "apps/docs/build",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

## Vercel setup

Import the GitHub repository into Vercel and keep the project root at the repository root.

Use:

| Setting | Value |
| --- | --- |
| Build command | `pnpm --filter @ari/docs build` |
| Output directory | `apps/docs/build` |
| Install command | `pnpm install --frozen-lockfile` |

Production deployments should come from `main`.

## Custom domain

Add `ari.umoren.xyz` to the Vercel project domains.

In Cloudflare DNS, create a CNAME record for the subdomain target Vercel gives you. Vercel's domain screen provides the exact value for the project.

```text
Type: CNAME
Name: ari
Target: <vercel-provided-cname>
Proxy status: DNS only during verification
```

After Vercel verifies the domain and issues TLS, the docs site should resolve at `https://ari.umoren.xyz`.
