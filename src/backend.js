/* REN Gateway panel — WinterJS (Wasmer Edge) backend, Supabase storage.
 * UI = reference design (login.html / dashboard.html inlined at build time).
 * Auth is stateless token (Cookie headers are stripped on Edge):
 *   token = sha256(password_hash + ":ren-edge")
 */

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "";
const ENV_PROXY_HOST = process.env.PROXY_HOST || "";

const LOGIN_HTML = __LOGIN_HTML__;
const DASHBOARD_HTML = __DASHBOARD_HTML__;
const SETUP_HTML = __SETUP_HTML__;
const DEPLOY_HTML = __DEPLOY_HTML__;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const err = (detail, status = 400) => json({ detail }, status);
const html = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/html;charset=utf-8" } });
// relative redirect (WinterJS req.url drops the port, so absolute redirects break)
function redir(to) {
  const h = new Headers();
  h.set("Location", to);
  return new Response("", { status: 302, headers: h });
}

async function sha256hex(str) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- Supabase ---------- */
function sb(path, opts = {}) {
  return fetch(SB_URL + "/rest/v1/" + path, {
    ...opts,
    headers: {
      apikey: SRK,
      Authorization: "Bearer " + SRK,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
}
async function sbJson(path, opts = {}) {
  const r = await sb(path, opts);
  const t = await r.text();
  try { return JSON.parse(t || "null"); } catch { return null; }
}

async function getSetting(key) {
  const rows = await sbJson(`panel_settings?key=eq.${encodeURIComponent(key)}&select=value`);
  return rows && rows[0] ? rows[0].value : null;
}
async function setSetting(key, value) {
  await sb(`panel_settings?key=eq.${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  }).catch(() => {});
  // ensure row exists (upsert fallback)
  const cur = await getSetting(key);
  if (cur === null) {
    await sb("panel_settings", { method: "POST", body: JSON.stringify({ key, value }) }).catch(() => {});
  }
}

async function listUsers() {
  const rows = await sbJson("panel_users?select=*&order=created_at.desc");
  return Array.isArray(rows) ? rows : [];
}
async function getUser(id) {
  const rows = await sbJson(`panel_users?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows && rows[0] ? rows[0] : null;
}

/* ---------- auth ---------- */
async function activePasswordHash() {
  const stored = await getSetting("admin_password_hash");
  if (stored) return stored;
  return sha256hex(PANEL_PASSWORD);
}
async function makeToken() {
  const h = await activePasswordHash();
  return sha256hex(h + ":ren-edge");
}
async function isSetupDone() {
  return (await getSetting("setup_done")) === "true";
}
async function authed(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return false;
  const tok = h.slice(7).trim();
  if (!tok) return false;
  return tok === (await makeToken());
}

/* ---------- helpers ---------- */
function parseSizeToBytes(value, unit) {
  const u = (unit || "GB").toUpperCase();
  const v = parseFloat(value) || 0;
  if (u === "GB") return Math.floor(v * 1024 ** 3);
  if (u === "MB") return Math.floor(v * 1024 ** 2);
  if (u === "KB") return Math.floor(v * 1024);
  return Math.floor(v);
}
function expiryFromDays(days) {
  const d = parseFloat(days) || 0;
  if (d <= 0) return null;
  return new Date(Date.now() + d * 86400000).toISOString();
}
function isExpired(u) {
  if (!u.expires_at) return false;
  return Date.now() >= new Date(u.expires_at).getTime();
}
async function proxyHost(req) {
  const s = await getSetting("proxy_host");
  if (s) return s;
  if (ENV_PROXY_HOST) return ENV_PROXY_HOST;
  return new URL(req.url).host;
}
async function customAddresses() {
  const s = await getSetting("custom_addresses");
  try {
    const a = JSON.parse(s || "[]");
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

function vlessLink(uuid, domain, addr, remark) {
  const q = new URLSearchParams({
    encryption: "none", security: "tls", type: "ws",
    host: domain, path: "/ws", sni: domain, fp: "chrome", alpn: "http/1.1",
  }).toString();
  return `vless://${uuid}@${addr}:443?${q}#${encodeURIComponent(remark)}`;
}

function toInbound(u, domain) {
  const used = (u.total_up || 0) + (u.total_down || 0);
  return {
    uuid: u.id,
    label: u.name,
    vless_uuid: u.uuid,
    limit_bytes: u.data_limit || 0,
    used_bytes: used,
    max_connections: 0,
    active: !!u.enabled,
    expiry: u.expires_at || "",
    expired: isExpired(u),
    created_at: u.created_at,
    current_connections: 0,
    vless_link: vlessLink(u.uuid, domain, domain, `REN-${u.name}`),
  };
}

/* ---------- handler ---------- */
async function handler(req) {
  if (!SB_URL || !SRK) return new Response("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env", { status: 500 });

  const url = new URL(req.url);
  const path = url.pathname;
  const m = req.method.toUpperCase();

  if (path === "/health") return json({ status: "ok" });

  // pages
  if (path === "/") return redir((await isSetupDone()) ? "/dashboard" : "/setup");
  if (path === "/login") {
    if (!(await isSetupDone())) return redir("/setup");
    return html(LOGIN_HTML);
  }
  if (path === "/setup") {
    if (await isSetupDone()) return redir("/login");
    return html(SETUP_HTML);
  }
  if (path === "/deploy") return html(DEPLOY_HTML);
  if (path === "/dashboard") return html(DASHBOARD_HTML);

  // ---- self-service deploy wizard (public) ----
  // The user's Wasmer token is used transiently for their deployment only.
  const WASMER_GQL = process.env.WASMER_GRAPHQL_URL || "https://registry.wasmer.io/graphql";
  async function wasmerGQL(token, query, variables, operationName) {
    const r = await fetch(WASMER_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ query, variables: variables || null, operationName }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
    if (!j.data) throw new Error("Wasmer API error");
    return j.data;
  }

  if (path === "/api/deploy/validate-token" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const token = String(body.wasmer_token || "").trim();
    if (!token) return err("Token is required");
    try {
      const d = await wasmerGQL(token, "query GetCurrentUser {\n  viewer {\n    id\n    username\n  }\n}\n", null, "GetCurrentUser");
      if (!d.viewer || !d.viewer.username) return err("Invalid Wasmer token", 401);
      return json({ ok: true, username: d.viewer.username });
    } catch (e) {
      return err("Invalid Wasmer token", 401);
    }
  }

  // ---- Supabase Management API (for the self-service deploy wizard) ----
  // With the user's Supabase PAT we create their project, tables and keys automatically.
  const SB_MGMT = process.env.SUPABASE_MGMT_URL || "https://api.supabase.com";
  async function sbMgmt(token, method, path, body) {
    const r = await fetch(SB_MGMT + path, {
      method,
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j && (j.msg || j.message || j.error_description || j.error)) || ("HTTP " + r.status);
      const e = new Error(String(msg).slice(0, 200));
      e.status = r.status;
      throw e;
    }
    return j;
  }
  function randomPassword(n) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const buf = new Uint8Array(n || 24);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => chars[b % chars.length]).join("");
  }
  const SETUP_SQL = "create table if not exists panel_users (id uuid primary key default gen_random_uuid(), name text not null, uuid text not null, trojan_password text, enabled boolean not null default true, created_at timestamptz not null default now(), last_seen timestamptz, total_up bigint not null default 0, total_down bigint not null default 0, data_limit bigint, expires_at timestamptz); create table if not exists panel_settings (key text primary key, value text);";

  if (path === "/api/deploy/validate-sb-token" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const token = String(body.supabase_token || "").trim();
    if (!token) return err("Supabase token is required");
    try {
      const orgs = await sbMgmt(token, "GET", "/v1/organizations");
      if (!Array.isArray(orgs) || !orgs.length) return err("No organizations found on this Supabase account", 401);
      return json({ ok: true, orgs: orgs.map((o) => ({ slug: o.slug || o.id, name: o.name })) });
    } catch (e) {
      if (e.status === 401 || e.status === 403) return err("Invalid Supabase token — create one at supabase.com/dashboard/account/tokens", 401);
      return err("Supabase error: " + e.message, e.status || 500);
    }
  }

  if (path === "/api/deploy/sb-create" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const token = String(body.supabase_token || "").trim();
    const orgSlug = String(body.org_slug || "").trim();
    const name = String(body.project_name || "ren-panel-db").trim().slice(0, 40) || "ren-panel-db";
    if (!token || !orgSlug) return err("Missing parameters");
    try {
      const p = await sbMgmt(token, "POST", "/v1/projects", {
        name,
        organization_slug: orgSlug,
        db_pass: randomPassword(24),
        region: "eu-west-1",
      });
      const ref = p.id || p.ref;
      if (!ref) return err("Supabase did not return a project ref");
      return json({ ok: true, ref });
    } catch (e) {
      return err("Could not create Supabase project: " + e.message, e.status || 500);
    }
  }

  if (path === "/api/deploy/sb-status" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const token = String(body.supabase_token || "").trim();
    const ref = String(body.ref || "").trim();
    if (!token || !ref) return err("Missing parameters");
    try {
      const p = await sbMgmt(token, "GET", "/v1/projects/" + encodeURIComponent(ref));
      const status = p.status || "UNKNOWN";
      return json({ ok: true, status, ready: status === "ACTIVE_HEALTHY" });
    } catch (e) {
      return err("Could not check project status: " + e.message, e.status || 500);
    }
  }

  if (path === "/api/deploy/sb-setup" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const token = String(body.supabase_token || "").trim();
    const ref = String(body.ref || "").trim();
    if (!token || !ref) return err("Missing parameters");
    try {
      await sbMgmt(token, "POST", "/v1/projects/" + encodeURIComponent(ref) + "/query", { query: SETUP_SQL });
      const keys = await sbMgmt(token, "GET", "/v1/projects/" + encodeURIComponent(ref) + "/api-keys");
      let key = null;
      if (Array.isArray(keys)) {
        const k = keys.find((x) => x.name === "service_role") || keys.find((x) => x.name === "secret");
        key = k && (k.api_key || k.key);
      }
      if (!key) return err("Could not read API keys for the new project");
      return json({ ok: true, supabase_url: "https://" + ref + ".supabase.co", service_role_key: key });
    } catch (e) {
      return err("Database setup failed: " + e.message, e.status || 500);
    }
  }

  if (path === "/api/deploy/wasmer" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const token = String(body.wasmer_token || "").trim();
    const appName = String(body.app_name || "").trim().toLowerCase();
    const sbUrl = String(body.supabase_url || "").trim().replace(/\/$/, "");
    const sbKey = String(body.service_role_key || body.supabase_key || "").trim();
    const pw = String(body.panel_password || "");
    const proxyHost = String(body.proxy_host || "").trim().toLowerCase();
    if (!token) return err("Wasmer token is required");
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(appName)) return err("Invalid app name");
    if (!/^https:\/\//.test(sbUrl) || !sbKey) return err("Invalid Supabase credentials");
    if (pw.length < 4) return err("Panel password must be at least 4 characters");
    try {
      // 1. who owns this token?
      const me = await wasmerGQL(token, "query GetCurrentUser {\n  viewer {\n    id\n    username\n  }\n}\n", null, "GetCurrentUser");
      const username = me.viewer && me.viewer.username;
      if (!username) return err("Invalid Wasmer token", 401);
      // 2. create + deploy the app (package already published)
      const cfgLines = [
        "kind: wasmer.io/App.v0",
        "name: " + appName,
        "owner: " + username,
        "package: 166gkhdbn-boop/aidify-panel",
        "env:",
        "  SUPABASE_URL: " + sbUrl,
      ];
      if (proxyHost) cfgLines.push("  PROXY_HOST: " + proxyHost);
      const cfg = cfgLines.join("\n") + "\n";
      const depQ = "mutation PublishDeployApp($config: String!, $name: ID!, $owner: ID, $makeDefault: Boolean) {\n  publishDeployApp(input: {config: {yamlConfig: $config}, name: $name, owner: $owner, makeDefault: $makeDefault}) {\n    deployAppVersion {\n      id\n      url\n      app { id }\n    }\n  }\n}\n";
      const depVars = { config: cfg, name: appName, owner: username, makeDefault: true };
      const d1 = await wasmerGQL(token, depQ, depVars, "PublishDeployApp");
      const appId = d1.publishDeployApp.deployAppVersion.app.id;
      // 3. secrets
      const secQ = "mutation UpsertAppSecrets($appId: ID!, $secrets: [SecretInput!]) {\n  upsertAppSecrets(input: {appId: $appId, secrets: $secrets}) {\n    success\n  }\n}\n";
      await wasmerGQL(token, secQ, {
        appId,
        secrets: [
          { name: "SUPABASE_SERVICE_ROLE_KEY", value: sbKey },
          { name: "PANEL_PASSWORD", value: pw },
        ],
      }, "UpsertAppSecrets");
      // 4. redeploy so secrets take effect
      const d2 = await wasmerGQL(token, depQ, depVars, "PublishDeployApp");
      const url = (d2.publishDeployApp.deployAppVersion.url || ("https://" + appName + ".wasmer.app")).replace(/\/$/, "");
      return json({ ok: true, url, username });
    } catch (e) {
      return err("Deploy failed: " + (e.message || e).slice(0, 200));
    }
  }

  // first-run setup (public until setup is done)
  if (path === "/api/setup-info" && m === "GET") {
    const done = await isSetupDone();
    return json(done ? { setup_done: true } : { setup_done: false, domain: (await getSetting("proxy_host")) || "" });
  }
  if (path === "/api/setup" && m === "POST") {
    if (await isSetupDone()) return err("Setup already completed", 403);
    let body = {};
    try { body = await req.json(); } catch {}
    const pw = String(body.password || "");
    let domain = String(body.domain || "").trim().toLowerCase()
      .replace("https://", "").replace("http://", "").replace(/\/$/, "");
    if (pw.length < 4) return err("Password must be at least 4 characters");
    if (!domain || !/^[a-z0-9\-_.]+$/.test(domain)) return err("Invalid domain format");
    await setSetting("admin_password_hash", await sha256hex(pw));
    await setSetting("proxy_host", domain);
    await setSetting("setup_done", "true");
    return json({ ok: true });
  }

  // public subscription
  if (path.startsWith("/sub/") && m === "GET") {
    const uid = decodeURIComponent(path.slice(5));
    const u = await getUser(uid);
    if (!u) return err("link not found", 404);
    if (!u.enabled) return err("link disabled", 403);
    if (isExpired(u)) return err("link expired", 403);
    const domain = await proxyHost(req);
    const addrs = await customAddresses();
    const links = [vlessLink(u.uuid, domain, domain, `REN-${u.name}-Server`)];
    addrs.forEach((a, i) => links.push(vlessLink(u.uuid, domain, a, `REN-${u.name}-IP${i + 1}`)));
    const b64 = btoa(unescape(encodeURIComponent(links.join("\n"))));
    const h = new Headers();
    h.set("Content-Type", "text/plain; charset=utf-8");
    h.set("profile-update-interval", "6");
    const exp = u.expires_at ? Math.floor(new Date(u.expires_at).getTime() / 1000) : 0;
    h.set("subscription-userinfo", `upload=${(u.total_up || 0) + (u.total_down || 0)}; download=0; total=${u.data_limit || 0}; expire=${exp}`);
    return new Response(b64, { headers: h });
  }

  // login
  if (path === "/api/login" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const pw = String(body.password || "");
    if ((await sha256hex(pw)) === (await activePasswordHash())) {
      return json({ ok: true, token: await makeToken() });
    }
    return err("Invalid password", 401);
  }

  // everything below needs auth
  if (!(await authed(req))) return err("unauthorized", 401);

  if (path === "/api/logout" && m === "POST") return json({ ok: true });
  if (path === "/api/me" && m === "GET") return json({ authenticated: true });

  if (path === "/api/change-password" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const cur = String(body.current_password || "");
    const nw = String(body.new_password || "");
    if ((await sha256hex(cur)) !== (await activePasswordHash())) return err("Current password is incorrect");
    if (nw.length < 4) return err("Password must be at least 4 characters");
    await setSetting("admin_password_hash", await sha256hex(nw));
    return json({ ok: true });
  }

  if (path === "/stats" && m === "GET") {
    const users = await listUsers();
    const totalBytes = users.reduce((a, u) => a + (u.total_up || 0) + (u.total_down || 0), 0);
    const domain = await proxyHost(req);
    return json({
      cpu_percent: 0, memory_percent: 0,
      total_traffic_mb: Math.round((totalBytes / 1048576) * 100) / 100,
      active_connections: users.filter((u) => u.enabled).length,
      total_requests: 0, total_errors: 0,
      uptime: "Wasmer Edge", timestamp: new Date().toISOString(),
      recent_errors: [], links_count: users.length, domain,
      hourly_traffic: {},
    });
  }

  // inbounds
  if (path === "/api/links" && m === "GET") {
    const users = await listUsers();
    const domain = await proxyHost(req);
    return json({ links: users.map((u) => toInbound(u, domain)) });
  }
  if (path === "/api/links" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const label = String(body.label || "").trim().slice(0, 60) || "New Link";
    if (!/^[a-zA-Z0-9\-_. ]+$/.test(label)) return err("Inbound name must contain only English letters, numbers, and characters: - _ . space");
    const users = await listUsers();
    if (users.some((u) => u.name === label)) return err("An inbound with this name already exists");
    const limit = parseSizeToBytes(body.limit_value, body.limit_unit);
    const row = {
      name: label, uuid: crypto.randomUUID(), enabled: true,
      data_limit: limit > 0 ? limit : null,
      expires_at: expiryFromDays(body.expiry_days),
      total_up: 0, total_down: 0,
    };
    const created = await sbJson("panel_users", { method: "POST", body: JSON.stringify(row) });
    const u = created && created[0] ? created[0] : { ...row, id: "unknown", created_at: new Date().toISOString() };
    const domain = await proxyHost(req);
    const inb = toInbound(u, domain);
    return json({ ...inb, label, limit_bytes: inb.limit_bytes, used_bytes: 0, max_connections: 0, active: true, expiry: inb.expiry, created_at: inb.created_at });
  }

  const linkMatch = path.match(/^\/api\/links\/([^/]+)(\/sub)?$/);
  if (linkMatch) {
    const uid = decodeURIComponent(linkMatch[1]);
    const u = await getUser(uid);
    if (!u) return err("link not found", 404);
    const domain = await proxyHost(req);

    if (linkMatch[2] === "/sub" && m === "GET") {
      const used = (u.total_up || 0) + (u.total_down || 0);
      const limit = u.data_limit || 0;
      const cfg = vlessLink(u.uuid, domain, domain, `REN-${u.name}`);
      const subText = `# REN Subscription\n# Label: ${u.name}\n# Used: ${Math.round((used / 1048576) * 100) / 100} MB / ${limit > 0 ? Math.round((limit / 1048576) * 100) / 100 : "Unlimited"} MB\n# Status: ${u.enabled ? "Active" : "Disabled"}\n${cfg}`;
      return json({
        subscription_url: `${domain}/sub/${u.id}`,
        config: cfg, label: u.name, used_bytes: used, limit_bytes: limit,
        used_mb: Math.round((used / 1048576) * 100) / 100,
        limit_mb: limit > 0 ? Math.round((limit / 1048576) * 100) / 100 : 0,
        remaining_mb: limit > 0 ? Math.round(((limit - used) / 1048576) * 100) / 100 : 0,
        usage_percent: limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0,
        active: !!u.enabled,
        sub_base64: btoa(unescape(encodeURIComponent(subText))),
        sub_text: subText,
      });
    }

    if (m === "PATCH") {
      let body = {};
      try { body = await req.json(); } catch {}
      const patch = {};
      if ("active" in body) patch.enabled = !!body.active;
      if ("limit_value" in body) {
        const lb = parseSizeToBytes(body.limit_value, body.limit_unit);
        patch.data_limit = lb > 0 ? lb : null;
      }
      if (body.reset_usage) { patch.total_up = 0; patch.total_down = 0; }
      if ("expiry_days" in body) patch.expires_at = expiryFromDays(body.expiry_days);
      if ("label" in body) patch.name = String(body.label).slice(0, 60);
      if (Object.keys(patch).length) {
        await sb(`panel_users?id=eq.${encodeURIComponent(uid)}`, { method: "PATCH", body: JSON.stringify(patch) });
      }
      return json({ ok: true });
    }
    if (m === "DELETE") {
      await sb(`panel_users?id=eq.${encodeURIComponent(uid)}`, { method: "DELETE" });
      return json({ ok: true });
    }
  }

  // domain
  if (path === "/api/domain" && m === "GET") {
    return json({ domain: (await getSetting("proxy_host")) || "" });
  }
  if (path === "/api/domain" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    let domain = String(body.domain || "").trim().toLowerCase()
      .replace("https://", "").replace("http://", "").replace(/\/$/, "");
    if (domain && !/^[a-z0-9\-_.]+$/.test(domain)) return err("Invalid domain format");
    await setSetting("proxy_host", domain);
    return json({ ok: true, domain });
  }

  // addresses
  if (path === "/api/addresses" && m === "GET") {
    return json({ addresses: await customAddresses() });
  }
  if (path === "/api/addresses" && m === "POST") {
    let body = {};
    try { body = await req.json(); } catch {}
    const addr = String(body.address || "").trim();
    if (!addr) return err("Address is required");
    if (!/^[a-zA-Z0-9\-_. ]+$/.test(addr)) return err("Address must contain only English letters, numbers, and characters: - _ .");
    const addrs = await customAddresses();
    if (addrs.includes(addr)) return err("Address already exists");
    addrs.push(addr);
    await setSetting("custom_addresses", JSON.stringify(addrs));
    return json({ ok: true, addresses: addrs });
  }
  const addrDel = path.match(/^\/api\/addresses\/(\d+)$/);
  if (addrDel && m === "DELETE") {
    const i = parseInt(addrDel[1], 10);
    const addrs = await customAddresses();
    if (i < 0 || i >= addrs.length) return err("Address not found", 404);
    addrs.splice(i, 1);
    await setSetting("custom_addresses", JSON.stringify(addrs));
    return json({ ok: true, addresses: addrs });
  }

  return new Response("Not found", { status: 404 });
}

addEventListener("fetch", (e) => e.respondWith(handler(e.request).catch((ex) => {
  return html(`<div style="background:#0c0c0f;color:#e2e2f0;font-family:sans-serif;padding:40px"><h3>Error</h3><div class="alert err">${String(ex && ex.message || ex)}</div></div>`, 500);
})));
