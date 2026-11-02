# Learnings: deploying Fluider

## `bun …/wrangler.js deploy` can stop mid-upload, exit 0, and not deploy

**Symptom:** `bun …/node_modules/wrangler/bin/wrangler.js deploy` printed `Uploaded 4 of 10 assets` and exited with status 0. `wrangler deployments list` still showed the previous version, and the live site kept serving the old bundle hash.

**Cause:** `bin/wrangler.js` is a Node launcher. It spawns `process.execPath` on `wrangler-dist/cli.js` with an IPC channel. Under Bun, `process.execPath` is Bun, and the child ended before the upload finished. Not root-caused further.

**Fix:** Run Wrangler through its `#!/usr/bin/env node` shebang: `bunx --no-install wrangler …` (or `npx wrangler …`). The same cached Wrangler 4.125.0 then finished with `Deployment complete`.

**Why this matters:** The truncated run prints no error, so it looks like a successful deploy. Confirm every deploy with `wrangler pages deployment list --project-name fluider`, or by fetching a changed asset hash from the live page.

## A new hostname can fail on this Mac while `dig` succeeds

**Symptom:** Right after the `delos.sloprefinery.ai` CNAME was published, `dig` and `dig @1.1.1.1` returned it. But `curl` returned `000`, Chrome failed with `net::ERR_NAME_NOT_RESOLVED`, and `dscacheutil -q host -a name delos.sloprefinery.ai` printed nothing.

**Cause:** `dig` queries DNS servers directly. curl and Chrome use the macOS system resolver, which had cached the "no such domain" answer from lookups made before the record existed.

**Fix:** Verify with pinned resolution: `curl --resolve delos.sloprefinery.ai:443:<ip> …`, or launch Chrome with `--host-resolver-rules="MAP delos.sloprefinery.ai <ip>"`. Otherwise wait for the negative cache to expire (about an hour here).

**Why this matters:** A green `dig` doesn't prove a browser on this machine can reach the site, and a red local browser check doesn't prove the site is down.
