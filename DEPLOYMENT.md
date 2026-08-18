# Deploying Reson8 Web Client

This is a static single-page app with **no backend of its own** — every
build connects to whatever `reson8` server address the user types into
the connect screen at runtime (master PRD §7, non-goal 5; there is no
build-time server binding). That shapes every decision below.

## Option A — Static host + CDN (recommended default)

The natural fit, since this app has nothing to run server-side:

```
npm ci
npm run build       # outputs dist/
```

Deploy `dist/` to any static host — Netlify, Vercel, Cloudflare Pages,
GitHub Pages, or a plain S3+CloudFront/nginx bucket all work identically,
since the app makes no assumptions about its own hosting beyond what's
covered below. Two things every option needs to get right:

- **SPA fallback routing.** This app uses client-side routing (React
  Router) — every path that isn't a real static file (`/app`,
  `/app/dms/:id`, etc.) must serve `index.html`, not a 404. Netlify and
  Cloudflare Pages detect a Vite SPA and do this automatically; **Vercel
  does not** — a plain Vite build deployed there 404s on any subroute
  reload unless a rewrite is configured explicitly, which is what this
  repo's root `vercel.json` does (`{"rewrites":[{"source":"/(.*)",
  "destination":"/index.html"}]}` — static files under `public/` still
  take priority over the rewrite, per Vercel's own routing order, so this
  doesn't shadow real assets). A plain nginx/S3 setup needs the same
  fallback configured explicitly too (see `nginx.conf` in this repo for a
  working example, used by Option B below too).
- **HTTPS.** Every host listed above provides this by default. If
  self-hosting on bare nginx/Apache, you must put TLS in front of it
  yourself — see the HTTPS section below for why this isn't optional.

## Option B — Docker, alongside the `reson8` server's own stack

For self-hosters who'd rather run the web client on the same box as their
`reson8` server, next to its existing `docker-compose.yml` — this repo
ships a working `Dockerfile` + `nginx.conf` that build and serve the app
the same way Option A's static host would, just containerized:

```
docker build -t reson8-web-client .
docker run -p 8080:80 reson8-web-client
```

To run it alongside an existing `reson8` server stack, add it as a
service in that stack's compose file (or a docker-compose override file,
matching the pattern `../reson8/docker-compose.cloudflared.yml` already
establishes for optional add-ons):

```yaml
services:
  reson8-web-client:
    build: ../reson8-web-client
    container_name: reson8-web-client
    restart: unless-stopped
    ports:
      - "8080:80"
```

**This container does not terminate TLS**, deliberately matching the
`reson8` server's own existing expectation — that repo's server container
also serves plain HTTP/WS on `9800` and relies on something in front of it
(Cloudflare Tunnel, via `docker-compose.cloudflared.yml`, or a reverse
proxy you bring yourself) for HTTPS. Put this container behind the same
kind of layer, whichever one you're already using for the server.

Note this build stage was written and reviewed against this repo's actual
`package.json`/`package-lock.json` and `npm run build` output, but
**hasn't been build-tested end-to-end in this environment** — no Docker
daemon is available in this sandbox. If it doesn't build cleanly on real
Docker, that's a real gap to fix, not a documentation nitpick — flag it.

## HTTPS is mandatory, not a recommendation

Several APIs this app depends on are restricted to [secure
contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
by every browser that implements them — there's no way to opt out of this
browser-level restriction from application code:

- `getUserMedia` (voice — Phase 2) refuses to run at all over plain HTTP.
- Service workers (the install/update-flow this app's own P7.2 built) can
  only register over HTTPS.
- The Badging and Vibration APIs (P7.4) are secure-context-gated too.

`localhost` is the one exception browsers carve out, for local dev only —
`npm run dev`/`npm run preview` work over plain HTTP purely because of
that carve-out, never because the app doesn't need HTTPS. Any real
deployment, on any hosting option above, needs a real TLS certificate.

## The `reson8` server connection needs WSS too

This client already defaults correctly here — `src/lib/serverUrl.ts`'s
`normalizeServerUrl()` prepends `wss://` to whatever the user types,
unless the host is clearly `localhost`/`127.0.0.1`/`::1` (dev only), in
which case it uses plain `ws://`. Nothing to change for this phase item,
just documenting the existing, already-correct behavior — and the
practical backstop: even if a user manually typed an explicit `ws://`
address for a non-local host, a browser will block that connection anyway
once this app itself is served over HTTPS (mixed active content), so
there's no way to end up silently downgraded in production.

This means: **the `reson8` server itself must also be reachable over WSS**
in any production deployment this client is expected to talk to — same
"something terminates TLS in front of it" requirement as this client's own
Option B above, and already how that server's own `docker-compose.
cloudflared.yml` is set up. If you're self-hosting `reson8` without
Cloudflare Tunnel, you need your own TLS-terminating reverse proxy in
front of port `9800` (and note: only the Socket.io/HTTP-upload traffic
needs to go through it — the mediasoup UDP/TCP media ports, `10000–10100`,
are a separate concern documented in the server's own setup, unaffected
by this client's requirements).

## Content-Security-Policy

`nginx.conf` in this repo sets the CSP for the Docker option; replicate
the same directives at whatever static host you use for Option A (most
support custom response headers — Netlify's `_headers` file, Vercel's
`vercel.json` headers config, Cloudflare Pages' `_headers` file, etc.).

The one directive worth calling out explicitly, per master PRD §5.6's own
instruction not to ship a silent wildcard: **`connect-src` and `img-src`
allow any host over a secure scheme (`https:`/`wss:`), not a single
allowlisted origin.**

```
connect-src 'self' https: wss:;
img-src 'self' data: https:;
```

This is a deliberate tradeoff, not an oversight. This app has no backend
of its own — a single hardcoded origin here would break the actual,
intended purpose of the connect screen (connecting to *any* self-hosted
`reson8` server the user chooses to type in, per master PRD §7's
confirmed non-goal against inventing a fixed-server model). Restricting
to secure schemes still blocks what CSP is actually meant to stop here:
plain-HTTP downgrade, `javascript:`/`data:`-scheme script injection via a
compromised dependency, and arbitrary non-TLS exfiltration. What it does
**not** protect against: a user who deliberately connects to a malicious
`reson8` server receiving the WebSocket traffic and attachment/emoji
fetches that connection implies — but that's true of the app's entire
design (the server *is* the trusted party the user is choosing to talk
to), not something CSP could meaningfully close off without breaking the
feature.

The rest of the policy is a standard locked-down baseline for a React SPA
with no inline scripts: `script-src 'self'` (Vite's build emits no inline
`<script>` content), `style-src 'self' 'unsafe-inline'` (Radix UI's
positioning primitives set inline `style` attributes for popovers/dropdown
menus — this is what actually needs the `unsafe-inline` allowance, not
arbitrary style injection), `frame-ancestors 'none'` (this app is never
meant to be embedded in an iframe), plus the usual `X-Content-Type-
Options`/`X-Frame-Options`/`Referrer-Policy` hardening headers.
