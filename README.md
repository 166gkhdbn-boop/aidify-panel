# REN Gateway Panel (Wasmer Edge)

VLESS inbound management panel running on **Wasmer Edge** (WinterJS),
using the REN Gateway reference UI with Supabase as the data store.

- **Login** (`/login`) — password gate, token stored in `localStorage`
- **Setup wizard** (`/setup`) — first-run: welcome → admin password → proxy
  domain → done. Shown automatically until `setup_done` is set in
  `panel_settings`.
- **Dashboard** (`/dashboard`) — traffic, inbounds, system overview
- **Inbounds** — table + creation **wizard** (Name → Data limit → Expiry →
  Review → link + QR), edit / toggle / reset traffic / delete, per-inbound
  VLESS links + subscription modal
- **Addresses** — extra CDN endpoints included in subscriptions
- **Domain** — which host the generated links point to (`proxy_host`)
- **Settings** — change admin password
- **Public subscription** (`/sub/{uid}`) — base64 subscription with
  `subscription-userinfo` header

## Layout

- `src/login.html`, `src/dashboard.html` — UI (REN reference design)
- `src/backend.js` — WinterJS API + Supabase
- `build.js` — inlines the HTML into `app/app.js`
- `app/app.js` — generated; this is what deploys

```sh
node build.js
wasmer deploy
```

## Secrets (set once, never in this repo)

```sh
wasmer app secret create --app 166gkhdbn-boop/aidify-panel SUPABASE_SERVICE_ROLE_KEY <key>
wasmer app secret create --app 166gkhdbn-boop/aidify-panel PANEL_PASSWORD <password>
```

Public env (`SUPABASE_URL`, `PROXY_HOST`) goes in `app.yaml`.

## Edge notes

- WinterJS strips the `Cookie` request header, so auth is a stateless
  Bearer token (`sha256(password_hash + ":ren-edge")`) kept in
  `localStorage` and sent as `Authorization` on every API call.
- `Set-Cookie` via plain-object headers is dropped — use a `Headers`
  instance with `.append()`.
- `new Response(null, …)` throws — use `""`.
- No CPU/RAM/process stats on Edge; dashboard shows traffic + inbound stats.
