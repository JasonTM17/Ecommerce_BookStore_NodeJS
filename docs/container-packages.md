# Node.js demo containers and releases

The manual **Publish Node demo packages** workflow builds the active Node API and Next.js storefront, checks both against a disposable PostgreSQL instance and publishes them to GHCR. The historical `v1.x` tags belong to the preserved Spring project; Node demo releases use `node-vX.Y.Z`.

## Images

| Image | Purpose |
| --- | --- |
| `ghcr.io/jasontm17/bookstore-node-api:node-v0.1.0` | NestJS API, port8080 |
| `ghcr.io/jasontm17/bookstore-node-web:node-v0.1.0` | Next.js storefront/admin, port3000 |

Each image also has a `sha-<full-source-commit>` tag and OCI source/revision/version/license labels. Use the registry digest from the release's `release-manifest.json` for immutable deployment. This first release targets **linux/amd64**; it does not claim an ARM64 build or promote a `latest` tag.

```sh
docker pull ghcr.io/jasontm17/bookstore-node-api:node-v0.1.0
docker pull ghcr.io/jasontm17/bookstore-node-web:node-v0.1.0
```

The web image defaults to proxying `/api` to `http://backend-node:8080/api`. Run it on the same Docker network as an API container named `backend-node`, or supply `API_PROXY_TARGET` explicitly. The API requires PostgreSQL and a strong private `JWT_SECRET`; provide server-only database and Supabase Storage configuration through environment/secrets. Existing hosted data must use `DB_SYNCHRONIZE=false` and the documented schema/migration process. Image publication does not deploy or initialize a production database.

## Publishing a subsequent release

1. Commit reviewed changes and obtain successful **Node.js application checks** for that exact source SHA.
2. Run **Publish Node demo packages** on `main` with a new `node-vX.Y.Z` version. The workflow rejects an existing Git version tag and requires successful exact-source CI.
3. Check container readiness: real PostgreSQL, API ready, frontend ready with matching source SHA, and catalog through the frontend proxy. Only then do image pushes run.
4. Download the `node-release-manifest` artifact. Verify registry digests, repository association and intended package visibility.
5. Create the annotated Git tag on the verified source SHA, then publish a GitHub demo release with that manifest attached. Preserve previous tags/digests.

The workflow uses GitHub's job-scoped `GITHUB_TOKEN` with package-write permission, not a registry password committed to source. See [GitHub's container publishing guide](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Verification boundary

The container check proves that the built images boot and connect to their disposable database/API. It does not verify live Supabase, SMTP delivery, payment or AI providers, every checkout scenario, load capacity or another CPU architecture. Those checks have separate evidence. Packages and GitHub Releases describe reproducible demo artifacts, not a commercial production certification.
