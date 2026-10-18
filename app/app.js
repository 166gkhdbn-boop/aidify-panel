/* REN Gateway panel — WinterJS (Wasmer Edge) backend, Supabase storage.
 * UI = reference design (login.html / dashboard.html inlined at build time).
 * Auth is stateless token (Cookie headers are stripped on Edge):
 *   token = sha256(password_hash + ":ren-edge")
 */

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "";
const ENV_PROXY_HOST = process.env.PROXY_HOST || "";

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>REN — Sign In</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0f;--panel:#13131a;--border:#1e1e2e;--border-hi:#2a2a3e;--text:#e2e2f0;--muted:#6b6b8a;--dim:#3a3a52;--accent:#6366f1;--accent-glow:rgba(99,102,241,0.18);--accent-dim:rgba(99,102,241,0.08);--red:#f43f5e;--red-dim:rgba(244,63,94,0.08);--green:#10b981}
html,body{height:100%;background:var(--bg);font-family:'Inter',system-ui,sans-serif;color:var(--text)}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;position:relative;overflow:hidden}
.bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(99,102,241,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.bg-glow{position:fixed;width:600px;height:600px;background:radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
.wrap{position:relative;z-index:1;width:100%;max-width:380px;padding:20px}
.logo{text-align:center;margin-bottom:32px}
.logo-mark{width:48px;height:48px;background:var(--accent);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;letter-spacing:-1px;margin-bottom:14px;box-shadow:0 0 40px var(--accent-glow)}
.logo h1{font-size:22px;font-weight:700;letter-spacing:-0.5px}
.logo p{font-size:13px;color:var(--muted);margin-top:4px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.field input{width:100%;padding:10px 14px;background:#0a0a10;border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}
.field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.field input::placeholder{color:var(--dim)}
.remember{display:flex;align-items:center;gap:8px;margin-bottom:20px;cursor:pointer;font-size:13px;color:var(--muted)}
.remember input[type=checkbox]{width:16px;height:16px;accent-color:var(--accent);cursor:pointer}
.btn{width:100%;padding:11px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.btn:hover{filter:brightness(1.1);box-shadow:0 4px 20px var(--accent-glow)}
.btn:active{transform:scale(0.99)}
.btn.loading{pointer-events:none;opacity:.7}
.err{background:var(--red-dim);border:1px solid rgba(244,63,94,0.2);color:var(--red);border-radius:9px;padding:10px 14px;font-size:13px;margin-bottom:14px;display:none;align-items:center;gap:8px}
.err.show{display:flex}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:none}
.btn.loading .spinner{display:inline-block}
.btn.loading .btn-text{opacity:0}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="bg-glow"></div>
<div class="wrap">
  <div class="logo">
    <div class="logo-mark">R</div>
    <h1>REN Gateway</h1>
    <p>Secure access panel</p>
  </div>
  <div class="card">
    <div class="err" id="err">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span id="err-msg">Invalid password</span>
    </div>
    <div class="field">
      <label>Username</label>
      <input type="text" id="username" value="admin" placeholder="admin" autocomplete="username">
    </div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="password" placeholder="••••••••" autocomplete="current-password">
    </div>
    <label class="remember">
      <input type="checkbox" id="remember" checked>
      Keep me signed in
    </label>
    <div style="text-align:center;margin-top:16px;font-size:12px;color:var(--muted)">Want your own panel? <a href="/deploy" style="color:var(--accent);text-decoration:none;font-weight:600">Deploy it in minutes →</a></div>
    <button class="btn" id="btn" onclick="doLogin()" style="margin-top:14px">
      <span class="spinner"></span>
      <span class="btn-text">Sign In</span>
    </button>
  </div>
</div>
<script>
if(localStorage.getItem('ren_token')){window.location.href='/dashboard';}
document.getElementById('password').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
async function doLogin(){
  const pw=document.getElementById('password').value;
  const btn=document.getElementById('btn');
  const err=document.getElementById('err');
  if(!pw){showErr('Password is required');return;}
  btn.classList.add('loading');
  err.classList.remove('show');
  try{
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    if(r.ok){const d=await r.json();localStorage.setItem('ren_token',d.token||'');window.location.href='/dashboard';}
    else{const d=await r.json();showErr(d.detail||'Invalid password');}
  }catch(e){showErr('Connection error');}
  btn.classList.remove('loading');
}
function showErr(msg){
  document.getElementById('err-msg').textContent=msg;
  document.getElementById('err').classList.add('show');
}
</script>
</body>
</html>`;
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>REN Panel</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0f;--sidebar:#0e0e14;--panel:#13131a;--panel2:#18181f;--border:#1c1c28;--border-hi:#252535;--text:#e2e2f0;--muted:#6b6b8a;--dim:#2e2e42;--accent:#6366f1;--accent-glow:rgba(99,102,241,0.15);--accent-dim:rgba(99,102,241,0.08);--green:#10b981;--green-dim:rgba(16,185,129,0.08);--red:#f43f5e;--red-dim:rgba(244,63,94,0.08);--yellow:#f59e0b;--yellow-dim:rgba(245,158,11,0.08);--sky:#0ea5e9;--sky-dim:rgba(14,165,233,0.08)}
html,body{height:100%;font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);overflow:hidden}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--dim);border-radius:2px}

/* Layout */
.layout{display:flex;height:100vh}

/* Sidebar */
.sidebar{width:230px;background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;position:relative;z-index:50}
.sidebar::after{content:'';position:absolute;top:0;right:0;bottom:0;width:1px;background:linear-gradient(to bottom,transparent,rgba(99,102,241,0.15),transparent)}
.sidebar-head{padding:18px 16px 16px;border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{width:34px;height:34px;background:var(--accent);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 0 20px var(--accent-glow)}
.brand-name{font-size:15px;font-weight:700;letter-spacing:-.3px}
.brand-ver{font-size:10px;color:var(--muted);font-weight:500}
.sidebar-nav{flex:1;padding:10px 8px;overflow-y:auto}
.nav-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);padding:12px 10px 5px}
.nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;cursor:pointer;color:var(--muted);font-size:13px;font-weight:500;transition:all .15s;margin-bottom:1px;border:none;background:none;width:100%;text-align:left}
.nav-item:hover{background:var(--panel);color:var(--text)}
.nav-item.active{background:var(--accent-dim);color:var(--accent);font-weight:600}
.nav-item.active .ni{opacity:1}
.ni{width:16px;height:16px;flex-shrink:0;opacity:.5}
.nav-item.active .ni{color:var(--accent)}
.nav-badge{margin-left:auto;background:var(--accent);color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;min-width:18px;text-align:center}
.sidebar-foot{padding:12px 8px;border-top:1px solid var(--border)}
.foot-user{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;margin-bottom:6px;background:var(--panel2)}
.foot-avatar{width:28px;height:28px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0}
.foot-info{flex:1;min-width:0}
.foot-name{font-size:12px;font-weight:600;truncate:ellipsis}
.foot-role{font-size:10px;color:var(--muted)}
.foot-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.foot-btn{padding:6px;border:1px solid var(--border);border-radius:8px;background:none;color:var(--muted);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;text-align:center}
.foot-btn:hover{border-color:var(--border-hi);color:var(--text)}
.foot-btn.logout:hover{background:var(--red-dim);border-color:rgba(244,63,94,.2);color:var(--red)}

/* Main */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{height:54px;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;gap:16px;flex-shrink:0;background:var(--sidebar)}
.topbar-title{font-size:14px;font-weight:600;color:var(--text)}
.topbar-sub{font-size:12px;color:var(--muted);margin-left:4px}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.uptime-badge{font-size:11px;color:var(--muted);background:var(--panel);border:1px solid var(--border);border-radius:7px;padding:3px 9px;font-weight:500}
.content{flex:1;overflow-y:auto;padding:20px 24px 32px}
.page{display:none;animation:fadeUp .3s ease}
.page.active{display:block}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ph{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px}
.ph-left{}
.ph-title{font-size:16px;font-weight:700;letter-spacing:-.3px}
.ph-desc{font-size:12px;color:var(--muted);margin-top:3px}
.ph-right{display:flex;gap:8px;align-items:center}

/* Stats Grid */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.stat{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:16px 18px;transition:border-color .2s,transform .2s}
.stat:hover{border-color:var(--border-hi);transform:translateY(-2px)}
.stat-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:16px}
.stat-icon.purple{background:var(--accent-dim);color:var(--accent)}
.stat-icon.green{background:var(--green-dim);color:var(--green)}
.stat-icon.red{background:var(--red-dim);color:var(--red)}
.stat-icon.sky{background:var(--sky-dim);color:var(--sky)}
.stat-val{font-size:22px;font-weight:700;letter-spacing:-.5px;line-height:1}
.stat-unit{font-size:12px;font-weight:400;color:var(--muted);margin-left:2px}
.stat-lbl{font-size:11px;color:var(--muted);margin-top:5px;font-weight:500}
.stat-trend{font-size:10px;color:var(--green);font-weight:600;margin-top:4px}

/* Cards */
.card{background:var(--panel);border:1px solid var(--border);border-radius:13px;padding:18px}
.card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.card-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px}
.card-title-dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* Buttons */
.btn{font-family:inherit;font-size:12px;font-weight:600;border-radius:8px;padding:7px 13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:none;transition:all .15s;white-space:nowrap}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{filter:brightness(1.1);box-shadow:0 4px 14px var(--accent-glow)}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}
.btn-ghost:hover{border-color:var(--border-hi);color:var(--text)}
.btn-danger{background:var(--red-dim);color:var(--red);border:1px solid rgba(244,63,94,.15)}
.btn-danger:hover{background:rgba(244,63,94,.14)}
.btn-sm{padding:5px 9px;font-size:11px;border-radius:7px}
.btn-icon{padding:6px;width:30px;height:30px;justify-content:center;border-radius:7px}

/* Table */
.tbl-wrap{overflow-x:auto}
.tbl{width:100%;border-collapse:collapse}
.tbl th{text-align:left;font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:9px 12px;border-bottom:1px solid var(--border);background:var(--panel2);white-space:nowrap}
.tbl th:first-child{border-radius:8px 0 0 0}
.tbl th:last-child{border-radius:0 8px 0 0}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.tbl tr:last-child td{border-bottom:none}
.tbl tbody tr{transition:background .1s}
.tbl tbody tr:hover td{background:var(--accent-dim)}
.tbl-actions{display:flex;gap:4px;justify-content:flex-end}

/* Tags */
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap}
.tag-active{background:var(--green-dim);color:var(--green)}
.tag-disabled{background:var(--red-dim);color:var(--red)}
.tag-expired{background:var(--yellow-dim);color:var(--yellow)}
.tag-vless{background:var(--accent-dim);color:var(--accent)}

/* Toggle */
.toggle{position:relative;width:36px;height:20px;flex-shrink:0;cursor:pointer}
.toggle input{opacity:0;width:0;height:0;position:absolute}
.toggle-track{position:absolute;inset:0;border-radius:10px;background:var(--dim);transition:background .2s;border:1px solid var(--border)}
.toggle input:checked~.toggle-track{background:var(--green);border-color:var(--green)}
.toggle-thumb{position:absolute;width:14px;height:14px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.toggle input:checked~.toggle-thumb{transform:translateX(16px)}

/* Progress */
.prog-wrap{display:flex;align-items:center;gap:8px;font-size:11px}
.prog-bar{flex:1;height:4px;background:var(--dim);border-radius:2px;overflow:hidden;min-width:60px}
.prog-fill{height:100%;border-radius:2px;transition:width .4s}
.prog-fill.green{background:var(--green)}
.prog-fill.yellow{background:var(--yellow)}
.prog-fill.red{background:var(--red)}

/* Sys meters */
.sys-row{display:flex;flex-direction:column;gap:10px}
.sys-item{display:flex;flex-direction:column;gap:6px}
.sys-hd{display:flex;justify-content:space-between;align-items:center;font-size:12px}
.sys-key{color:var(--muted);font-weight:500}
.sys-val{font-weight:700;color:var(--text)}
.sys-bar{height:6px;background:var(--dim);border-radius:3px;overflow:hidden}
.sys-fill{height:100%;border-radius:3px;transition:width .5s cubic-bezier(.4,0,.2,1)}
.sys-fill.cpu{background:linear-gradient(90deg,var(--accent),#818cf8)}
.sys-fill.ram{background:linear-gradient(90deg,var(--sky),#38bdf8)}

/* Info rows */
.info-rows{display:flex;flex-direction:column;gap:0}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:12px}
.info-row:last-child{border-bottom:none;padding-bottom:0}
.info-k{color:var(--muted);display:flex;align-items:center;gap:6px}
.info-v{font-weight:600;color:var(--text);font-size:12px;max-width:200px;text-align:right;word-break:break-all}

/* QR box */
.qr-box{text-align:center;padding:20px;background:var(--panel2);border-radius:12px;border:1px solid var(--border)}
.qr-box img{max-width:200px;border-radius:8px;background:#fff;padding:8px}

/* Forms */
.form-group{margin-bottom:12px}
.form-label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.form-input,.form-select{width:100%;padding:9px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:inherit;font-size:13px;outline:none;transition:border-color .2s,box-shadow .2s}
.form-input:focus,.form-select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.form-input::placeholder{color:var(--dim)}
.form-select option{background:var(--panel);color:var(--text)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.form-row3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}

/* Search */
.search-wrap{position:relative;flex:1;max-width:280px}
.search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
.search-inp{width:100%;padding:7px 12px 7px 32px;background:var(--panel2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:inherit;font-size:13px;outline:none;transition:border-color .2s}
.search-inp:focus{border-color:var(--accent)}
.search-inp::placeholder{color:var(--dim)}

/* Modal */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:200;display:none;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
.overlay.show{display:flex}
.modal{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 25px 60px rgba(0,0,0,.5);animation:modalIn .3s cubic-bezier(.34,1.2,.64,1)}
@keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}
.modal-title{font-size:15px;font-weight:700;margin-bottom:18px;padding-right:30px}
.modal-close{position:absolute;top:16px;right:16px;background:var(--panel2);border:1px solid var(--border);color:var(--muted);width:28px;height:28px;border-radius:7px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.modal-close:hover{background:var(--red-dim);color:var(--red);border-color:rgba(244,63,94,.2)}
.modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}

/* Toast */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);background:var(--panel);color:var(--text);border:1px solid var(--border-hi);border-radius:10px;padding:10px 18px;font-size:13px;font-weight:500;opacity:0;transition:all .3s;z-index:999;display:flex;align-items:center;gap:8px;box-shadow:0 8px 30px rgba(0,0,0,.3);backdrop-filter:blur(10px);white-space:nowrap}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.toast.ok{border-color:rgba(16,185,129,.25);color:var(--green)}
.toast.err{border-color:rgba(244,63,94,.25);color:var(--red)}

/* Empty */
.empty{text-align:center;padding:48px 20px;color:var(--muted)}
.empty-ico{font-size:36px;margin-bottom:12px;opacity:.3}
.empty-txt{font-size:13px}

/* Code */
.code-block{background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-family:'Courier New',monospace;font-size:11px;color:var(--muted);word-break:break-all;line-height:1.6;position:relative}
.code-copy{position:absolute;top:8px;right:8px}

/* Address chips */
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:var(--panel2);border:1px solid var(--border);border-radius:7px;font-size:12px;color:var(--text)}
.chip-del{background:none;border:none;color:var(--muted);cursor:pointer;display:flex;align-items:center;padding:0;font-size:14px;transition:color .15s;line-height:1}
.chip-del:hover{color:var(--red)}

/* Chart area */
.chart-area{height:160px;position:relative}

/* Pager */
.pager{display:flex;align-items:center;justify-content:space-between;padding:10px 0 0;font-size:12px;color:var(--muted)}
.pager-btns{display:flex;gap:4px}
.pager-btn{padding:5px 10px;border:1px solid var(--border);border-radius:7px;background:none;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
.pager-btn:hover{border-color:var(--border-hi);color:var(--text)}
.pager-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}

/* Copy feedback */
.copied{color:var(--green)!important}

/* Responsive */
@media(max-width:900px){.stats{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}.sidebar{width:200px}}
@media(max-width:640px){.sidebar{display:none}.content{padding:14px}.stats{grid-template-columns:1fr 1fr}}

/* ---- Inbound wizard ---- */
.wz-steps{display:flex;align-items:center;margin-bottom:22px}
.wz-dot{width:26px;height:26px;border-radius:50%;background:var(--panel2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--muted);flex-shrink:0;transition:all .3s}
.wz-dot.done{background:var(--green-dim);border-color:var(--green);color:var(--green)}
.wz-dot.now{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 0 14px var(--accent-glow)}
.wz-line{flex:1;height:1px;background:var(--border);margin:0 6px}
.wz-line.done{background:var(--green)}
.wz-lbl{font-size:10px;color:var(--muted);text-align:center;margin-top:5px;font-weight:600}
.wz-lbl.now{color:var(--accent)}
.wz-col{display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:52px}
.wz-step{display:none;animation:fadeUp .3s ease}
.wz-step.on{display:block}
.wz-step h3{font-size:14px;font-weight:700;margin-bottom:6px}
.wz-step .desc{font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.6}
.wz-err{background:var(--red-dim);border:1px solid rgba(244,63,94,.2);color:var(--red);border-radius:9px;padding:9px 13px;font-size:12px;margin-bottom:14px;display:none}
.wz-err.show{display:block}
.unlim{display:flex;align-items:center;gap:9px;padding:11px 13px;border:1px solid var(--border);border-radius:10px;cursor:pointer;margin-bottom:12px;transition:border-color .15s;font-size:13px;font-weight:500}
.unlim:hover{border-color:var(--border-hi)}
.unlim input{width:16px;height:16px;accent-color:var(--accent)}
.wz-done-ico{width:58px;height:58px;border-radius:50%;background:var(--green-dim);border:1px solid var(--green);color:var(--green);display:flex;align-items:center;justify-content:center;margin:4px auto 16px;animation:modalIn .4s cubic-bezier(.34,1.3,.64,1)}
</style>
</head>
<body>
<div class="layout">
<!-- Sidebar -->
<aside class="sidebar">
  <div class="sidebar-head">
    <div class="brand">
      <div class="brand-icon">R</div>
      <div>
        <div class="brand-name">REN</div>
        <div class="brand-ver">Gateway v2.0</div>
      </div>
    </div>
  </div>
  <nav class="sidebar-nav">
    <div class="nav-label">Overview</div>
    <button class="nav-item active" onclick="goPage('dashboard')">
      <svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
      Dashboard
    </button>
    <div class="nav-label">Management</div>
    <button class="nav-item" onclick="goPage('inbounds')">
      <svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Inbounds
      <span class="nav-badge" id="nb-inbounds">0</span>
    </button>
    <button class="nav-item" onclick="goPage('addresses')">
      <svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      Addresses
    </button>
    <div class="nav-label">Configuration</div>
    <button class="nav-item" onclick="goPage('domain')">
      <svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Domain
    </button>
    <button class="nav-item" onclick="goPage('settings')">
      <svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Settings
    </button>
  </nav>
  <div class="sidebar-foot">
    <div class="foot-user">
      <div class="foot-avatar">A</div>
      <div class="foot-info">
        <div class="foot-name">Admin</div>
        <div class="foot-role">Administrator</div>
      </div>
    </div>
    <div class="foot-actions">
      <button class="foot-btn" onclick="goPage('settings')">⚙ Settings</button>
      <button class="foot-btn logout" onclick="doLogout()">↪ Logout</button>
    </div>
  </div>
</aside>

<!-- Main -->
<div class="main">
  <header class="topbar">
    <span class="topbar-title" id="tb-title">Dashboard</span>
    <span class="topbar-sub" id="tb-sub"></span>
    <div class="topbar-right">
      <span class="status-dot"></span>
      <span class="uptime-badge" id="tb-uptime">—</span>
    </div>
  </header>
  <div class="content">

  <!-- DASHBOARD -->
  <div class="page active" id="pg-dashboard">
    <div class="stats">
      <div class="stat">
        <div class="stat-icon purple"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
        <div><span class="stat-val" id="s-cpu">—</span><span class="stat-unit">%</span></div>
        <div class="stat-lbl">CPU Usage</div>
      </div>
      <div class="stat">
        <div class="stat-icon sky"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></ellipse></svg></div>
        <div><span class="stat-val" id="s-ram">—</span><span class="stat-unit">%</span></div>
        <div class="stat-lbl">RAM Usage</div>
      </div>
      <div class="stat">
        <div class="stat-icon green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
        <div><span class="stat-val" id="s-traffic">0</span><span class="stat-unit">MB</span></div>
        <div class="stat-lbl">Total Traffic</div>
      </div>
      <div class="stat">
        <div class="stat-icon red"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div><span class="stat-val" id="s-conns">0</span></div>
        <div class="stat-lbl">Active Connections</div>
      </div>
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-title-dot"></div>Traffic (24h)</div>
        </div>
        <div class="chart-area"><canvas id="trafficChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-title-dot" style="background:var(--sky)"></div>System</div>
        </div>
        <div class="sys-row">
          <div class="sys-item">
            <div class="sys-hd"><span class="sys-key">CPU</span><span class="sys-val" id="sys-cpu">—</span></div>
            <div class="sys-bar"><div class="sys-fill cpu" id="sys-cpu-bar" style="width:0%"></div></div>
          </div>
          <div class="sys-item">
            <div class="sys-hd"><span class="sys-key">Memory</span><span class="sys-val" id="sys-ram">—</span></div>
            <div class="sys-bar"><div class="sys-fill ram" id="sys-ram-bar" style="width:0%"></div></div>
          </div>
        </div>
        <div class="info-rows" style="margin-top:14px">
          <div class="info-row"><span class="info-k">Uptime</span><span class="info-v" id="sys-uptime">—</span></div>
          <div class="info-row"><span class="info-k">Total Requests</span><span class="info-v" id="sys-reqs">—</span></div>
          <div class="info-row"><span class="info-k">Errors</span><span class="info-v" id="sys-errs">—</span></div>
          <div class="info-row"><span class="info-k">Domain</span><span class="info-v" id="sys-domain">—</span></div>
          <div class="info-row"><span class="info-k">Inbounds</span><span class="info-v" id="sys-links">—</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- INBOUNDS -->
  <div class="page" id="pg-inbounds">
    <div class="ph">
      <div class="ph-left">
        <div class="ph-title">Inbounds</div>
        <div class="ph-desc">Manage VLESS tunnel configurations</div>
      </div>
      <div class="ph-right">
        <div class="search-wrap">
          <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="search-inp" id="inbound-search" placeholder="Search inbounds…" oninput="filterInbounds()">
        </div>
        <button class="btn btn-primary" onclick="openWizard()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Inbound
        </button>
      </div>
    </div>
    <div class="card" style="padding:0">
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Name</th>
            <th>Protocol</th>
            <th>Traffic</th>
            <th>Connections</th>
            <th>Expiry</th>
            <th>Status</th>
            <th style="text-align:right">Actions</th>
          </tr></thead>
          <tbody id="inbounds-tbody"></tbody>
        </table>
      </div>
      <div id="inbounds-empty" class="empty" style="display:none">
        <div class="empty-ico">🛡</div>
        <div class="empty-txt">No inbounds yet — create your first one</div>
      </div>
      <div class="pager" style="padding:10px 16px">
        <span id="inbounds-count" style="font-size:12px;color:var(--muted)"></span>
        <div class="pager-btns" id="inbounds-pager"></div>
      </div>
    </div>
  </div>

  <!-- ADDRESSES -->
  <div class="page" id="pg-addresses">
    <div class="ph">
      <div class="ph-left">
        <div class="ph-title">Custom Addresses</div>
        <div class="ph-desc">Alternative server addresses for subscriptions</div>
      </div>
      <div class="ph-right">
        <button class="btn btn-primary" onclick="openAddAddressModal()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Address
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-head">
        <div class="card-title"><div class="card-title-dot" style="background:var(--sky)"></div>Active Addresses</div>
      </div>
      <div id="chips-wrap" class="chips"></div>
      <div id="addr-empty" class="empty" style="display:none;padding:24px 0">
        <div class="empty-ico">🌐</div>
        <div class="empty-txt">No custom addresses configured</div>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="card-head">
        <div class="card-title"><div class="card-title-dot" style="background:var(--muted)"></div>About Addresses</div>
      </div>
      <div style="font-size:13px;color:var(--muted);line-height:1.7">
        Custom addresses are used in subscription configs as alternative endpoints. Each address creates an extra VLESS entry pointing to that host while keeping the same UUID and TLS settings. The default server address is always included first.
      </div>
    </div>
  </div>

  <!-- DOMAIN -->
  <div class="page" id="pg-domain">
    <div class="ph">
      <div class="ph-left">
        <div class="ph-title">Custom Domain</div>
        <div class="ph-desc">Override the auto-detected server domain</div>
      </div>
    </div>
    <div class="card" style="max-width:520px">
      <div class="card-head">
        <div class="card-title"><div class="card-title-dot"></div>Domain Settings</div>
      </div>
      <div class="form-group">
        <label class="form-label">Custom Domain</label>
        <input class="form-input" id="domain-input" placeholder="e.g. example.com" autocomplete="off">
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.6">
        Leave blank to auto-detect from environment. When set, this domain is used in all generated VLESS links and TLS SNI.
      </div>
      <div class="info-rows" style="margin-bottom:14px">
        <div class="info-row"><span class="info-k">Auto-detected</span><span class="info-v" id="auto-domain">—</span></div>
        <div class="info-row"><span class="info-k">Active</span><span class="info-v" id="active-domain">—</span></div>
      </div>
      <button class="btn btn-primary" onclick="saveDomain()">Save Domain</button>
    </div>
  </div>

  <!-- SETTINGS -->
  <div class="page" id="pg-settings">
    <div class="ph">
      <div class="ph-left">
        <div class="ph-title">Settings</div>
        <div class="ph-desc">Security and system configuration</div>
      </div>
    </div>
    <div class="grid2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-title-dot" style="background:var(--red)"></div>Change Password</div>
        </div>
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input class="form-input" type="password" id="pw-current" placeholder="••••••••">
        </div>
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input class="form-input" type="password" id="pw-new" placeholder="Min 4 characters">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm Password</label>
          <input class="form-input" type="password" id="pw-confirm" placeholder="Repeat new password">
        </div>
        <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-title"><div class="card-title-dot" style="background:var(--green)"></div>System Info</div>
        </div>
        <div class="info-rows">
          <div class="info-row"><span class="info-k">Service</span><span class="info-v">REN Gateway</span></div>
          <div class="info-row"><span class="info-k">Version</span><span class="info-v">2.0.0</span></div>
          <div class="info-row"><span class="info-k">Uptime</span><span class="info-v" id="set-uptime">—</span></div>
          <div class="info-row"><span class="info-k">Protocol</span><span class="info-v">VLESS / WebSocket / TLS</span></div>
          <div class="info-row"><span class="info-k">Total Traffic</span><span class="info-v" id="set-traffic">—</span></div>
          <div class="info-row"><span class="info-k">Total Requests</span><span class="info-v" id="set-reqs">—</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="card-head">
        <div class="card-title"><div class="card-title-dot" style="background:var(--yellow)"></div>Recent Errors</div>
      </div>
      <div id="err-log-wrap"></div>
    </div>
  </div>

  </div><!-- /content -->
</div><!-- /main -->
</div><!-- /layout -->

<!-- ADD INBOUND MODAL -->
<div class="overlay" id="add-modal">
  <div class="modal">
    <div class="modal-title" id="add-modal-title">New Inbound</div>
    <button class="modal-close" onclick="closeModal('add-modal')">✕</button>
    <input type="hidden" id="edit-uid">
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="f-label" placeholder="e.g. MyUser" autocomplete="off">
    </div>
    <div class="form-row3" style="margin-bottom:12px">
      <div class="form-group" style="margin:0">
        <label class="form-label">Traffic Limit</label>
        <input class="form-input" id="f-limit-val" type="number" min="0" step="0.1" placeholder="0 = unlimited">
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Unit</label>
        <select class="form-select" id="f-limit-unit">
          <option value="GB">GB</option>
          <option value="MB">MB</option>
          <option value="KB">KB</option>
        </select>
      </div>
      <div class="form-group" style="margin:0">
        <label class="form-label">Max Conn</label>
        <input class="form-input" id="f-max-conn" type="number" min="0" placeholder="0 = ∞">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Expiry (days from now)</label>
      <input class="form-input" id="f-expiry" type="number" min="0" step="1" placeholder="0 = no expiry">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('add-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitInbound()">Save Inbound</button>
    </div>
  </div>
</div>

<!-- SUBSCRIPTION MODAL -->
<div class="overlay" id="sub-modal">
  <div class="modal" style="max-width:500px">
    <div class="modal-title" id="sub-modal-title">Subscription</div>
    <button class="modal-close" onclick="closeModal('sub-modal')">✕</button>
    <div class="info-rows" style="margin-bottom:14px">
      <div class="info-row"><span class="info-k">Traffic</span><span class="info-v" id="sub-traffic">—</span></div>
      <div class="info-row"><span class="info-k">Status</span><span class="info-v" id="sub-status">—</span></div>
      <div class="info-row"><span class="info-k">Expiry</span><span class="info-v" id="sub-expiry">—</span></div>
    </div>
    <div class="form-group">
      <label class="form-label">VLESS Config</label>
      <div class="code-block" id="sub-vless">
        <button class="btn btn-ghost btn-sm code-copy" onclick="copyEl('sub-vless-text')">Copy</button>
        <div id="sub-vless-text" style="padding-right:48px"></div>
      </div>
    </div>
    <div class="form-group" style="margin-top:10px">
      <label class="form-label">Subscription URL</label>
      <div class="code-block" id="sub-url-block">
        <button class="btn btn-ghost btn-sm code-copy" onclick="copyEl('sub-url-text')">Copy</button>
        <div id="sub-url-text" style="padding-right:48px"></div>
      </div>
    </div>
    <div class="qr-box" style="margin-top:12px">
      <img id="sub-qr" src="" alt="QR Code" style="max-width:180px">
      <div style="font-size:11px;color:var(--muted);margin-top:8px">Scan with V2RayNG or Shadowrocket</div>
    </div>
  </div>
</div>

<!-- ADD ADDRESS MODAL -->
<div class="overlay" id="addr-modal">
  <div class="modal" style="max-width:400px">
    <div class="modal-title">Add Custom Address</div>
    <button class="modal-close" onclick="closeModal('addr-modal')">✕</button>
    <div class="form-group">
      <label class="form-label">Address / Domain / IP</label>
      <input class="form-input" id="f-addr" placeholder="e.g. cdn.example.com" autocomplete="off">
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Letters, numbers, dashes, underscores, and dots only.</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('addr-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddress()">Add Address</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// Token auth: WinterJS/Edge strips Cookie headers, so the session token lives
// in localStorage and is sent as Authorization: Bearer on every API call.
(function(){
  var _f = window.fetch;
  window.fetch = function(u, o){
    o = o || {};
    try{
      var t = localStorage.getItem('ren_token');
      if(t){ o.headers = Object.assign({}, o.headers, {Authorization: 'Bearer '+t}); }
    }catch(e){}
    return _f(u, o).then(function(r){
      if(r.status === 401 && String(u).indexOf('/api/login') < 0){ window.location.href = '/login'; }
      return r;
    });
  };
  try{ if(!localStorage.getItem('ren_token')){ window.location.href = '/login'; } }catch(e){}
})();
</script>
<script>
let statsData={};let trafficChart=null;let allLinks=[];let filteredLinks=[];
let curPage=1;const PER_PAGE=10;

// Navigation
function goPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('pg-'+id)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{if(n.onclick?.toString().includes(id))n.classList.add('active')});
  const titles={dashboard:'Dashboard',inbounds:'Inbounds',addresses:'Addresses',domain:'Domain',settings:'Settings'};
  const subs={dashboard:'Real-time overview',inbounds:'Manage tunnels',addresses:'CDN endpoints',domain:'Domain config',settings:'System settings'};
  document.getElementById('tb-title').textContent=titles[id]||id;
  document.getElementById('tb-sub').textContent='— '+subs[id]||'';
  if(id==='inbounds')loadInbounds();
  if(id==='addresses')loadAddresses();
  if(id==='domain')loadDomain();
  if(id==='settings')loadSettings();
}

// Toast
let toastTimer;
function toast(msg,type='ok'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast '+type+' show';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

// Modal
function closeModal(id){document.getElementById(id)?.classList.remove('show')}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show')}));

// Copy
async function copyText(text,el){
  try{await navigator.clipboard.writeText(text);}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);}
  if(el){const old=el.textContent;el.textContent='✓ Copied';el.classList.add('copied');setTimeout(()=>{el.textContent=old;el.classList.remove('copied')},1800);}
  toast('Copied to clipboard');
}
function copyEl(id){const el=document.getElementById(id);if(el)copyText(el.textContent.trim());}

// Stats
async function loadStats(){
  try{
    const r=await fetch('/stats');if(!r.ok)return;
    statsData=await r.json();
    document.getElementById('s-cpu').textContent=statsData.cpu_percent?.toFixed(1)||'0';
    document.getElementById('s-ram').textContent=statsData.memory_percent?.toFixed(1)||'0';
    document.getElementById('s-traffic').textContent=statsData.total_traffic_mb?.toFixed(1)||'0';
    document.getElementById('s-conns').textContent=statsData.active_connections||'0';
    document.getElementById('tb-uptime').textContent=statsData.uptime||'—';
    document.getElementById('sys-cpu').textContent=(statsData.cpu_percent?.toFixed(1)||'0')+'%';
    document.getElementById('sys-ram').textContent=(statsData.memory_percent?.toFixed(1)||'0')+'%';
    document.getElementById('sys-cpu-bar').style.width=(statsData.cpu_percent||0)+'%';
    document.getElementById('sys-ram-bar').style.width=(statsData.memory_percent||0)+'%';
    document.getElementById('sys-uptime').textContent=statsData.uptime||'—';
    document.getElementById('sys-reqs').textContent=(statsData.total_requests||0).toLocaleString();
    document.getElementById('sys-errs').textContent=statsData.total_errors||'0';
    document.getElementById('sys-domain').textContent=statsData.domain||'—';
    document.getElementById('sys-links').textContent=statsData.links_count||'0';
    updateChart(statsData.hourly_traffic||{});
  }catch(e){}
}

// Chart
function initChart(){
  if(typeof Chart==='undefined')return;
  const ctx=document.getElementById('trafficChart');if(!ctx)return;
  trafficChart=new Chart(ctx,{type:'bar',data:{labels:[],datasets:[{label:'MB',data:[],backgroundColor:'rgba(99,102,241,0.5)',borderColor:'#6366f1',borderWidth:1,borderRadius:5,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>v.raw.toFixed(1)+' MB'}}},scales:{x:{grid:{display:false},ticks:{color:'rgba(226,226,240,.3)',font:{size:10}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'rgba(226,226,240,.3)',font:{size:10},callback:v=>v+' MB'},beginAtZero:true}}}});
}

function updateChart(ht){
  if(!trafficChart||typeof Chart==='undefined')return;
  const sorted=Object.entries(ht).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
  trafficChart.data.labels=sorted.map(e=>e[0]);
  trafficChart.data.datasets[0].data=sorted.map(e=>+(e[1]/1048576).toFixed(2));
  trafficChart.update('none');
}

// Inbounds
async function loadInbounds(){
  try{
    const r=await fetch('/api/links');if(!r.ok)return;
    const d=await r.json();allLinks=d.links||[];
    document.getElementById('nb-inbounds').textContent=allLinks.length;
    filterInbounds();
  }catch(e){}
}

function filterInbounds(){
  const q=(document.getElementById('inbound-search')?.value||'').toLowerCase();
  filteredLinks=allLinks.filter(l=>l.label.toLowerCase().includes(q));
  curPage=1;renderInbounds();
}

function fmt(bytes){if(!bytes)return'0 B';const u=['B','KB','MB','GB','TB'];let i=0,b=bytes;while(b>=1024&&i<u.length-1){b/=1024;i++;}return b.toFixed(1)+' '+u[i];}
function fmtExpiry(exp){if(!exp)return'Never';const d=new Date(exp);const now=new Date();const diff=Math.round((d-now)/(1000*60*60*24));if(diff<0)return'Expired';if(diff===0)return'Today';return diff+'d left';}

function renderInbounds(){
  const tbody=document.getElementById('inbounds-tbody');
  const empty=document.getElementById('inbounds-empty');
  const count=document.getElementById('inbounds-count');
  const total=filteredLinks.length;
  const pages=Math.ceil(total/PER_PAGE)||1;
  const start=(curPage-1)*PER_PAGE;const end=Math.min(start+PER_PAGE,total);
  const slice=filteredLinks.slice(start,end);
  count.textContent=total>0?\`\${start+1}–\${end} of \${total}\`:'';
  if(total===0){tbody.innerHTML='';empty.style.display='block';renderPager(0,1);return;}
  empty.style.display='none';
  tbody.innerHTML=slice.map(l=>{
    const pct=l.limit_bytes>0?Math.min(100,Math.round(l.used_bytes/l.limit_bytes*100)):0;
    const pctCls=pct>90?'red':pct>60?'yellow':'green';
    const limitStr=l.limit_bytes>0?fmt(l.limit_bytes):'∞';
    const statusTag=l.expired?'<span class="tag tag-expired">Expired</span>':l.active?'<span class="tag tag-active">Active</span>':'<span class="tag tag-disabled">Off</span>';
    const expStr=fmtExpiry(l.expiry);
    const conns=l.current_connections||0;
    const maxC=l.max_connections||0;
    return \`<tr>
      <td><div style="font-weight:600;font-size:13px">\${esc(l.label)}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">\${l.uuid}</div></td>
      <td><span class="tag tag-vless">VLESS</span></td>
      <td><div class="prog-wrap"><span style="color:var(--muted)">\${fmt(l.used_bytes)}</span><div class="prog-bar"><div class="prog-fill \${pctCls}" style="width:\${pct}%"></div></div><span style="color:var(--muted)">\${limitStr}</span></div></td>
      <td style="font-size:13px">\${conns}\${maxC>0?' / '+maxC:''}</td>
      <td style="font-size:12px;color:var(--muted)">\${expStr}</td>
      <td>
        <label class="toggle" title="Toggle active">
          <input type="checkbox" \${l.active&&!l.expired?'checked':''} onchange="toggleLink('\${esc(l.uuid)}',this.checked)">
          <div class="toggle-track"></div>
          <div class="toggle-thumb"></div>
        </label>
      </td>
      <td>
        <div class="tbl-actions">
          <button class="btn btn-ghost btn-sm btn-icon" title="Subscription" onclick="openSub('\${esc(l.uuid)}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Reset Traffic" onclick="resetTraffic('\${esc(l.uuid)}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Edit" onclick="openEdit('\${esc(l.uuid)}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="deleteLink('\${esc(l.uuid)}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
        </div>
      </td>
    </tr>\`;
  }).join('');
  renderPager(total,pages);
}

function renderPager(total,pages){
  const p=document.getElementById('inbounds-pager');
  if(pages<=1){p.innerHTML='';return;}
  let h='';
  for(let i=1;i<=pages;i++)h+=\`<button class="pager-btn\${i===curPage?' active':''}" onclick="goPg(\${i})">\${i}</button>\`;
  p.innerHTML=h;
}
function goPg(n){curPage=n;renderInbounds();}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function openAddModal(){
  document.getElementById('add-modal-title').textContent='New Inbound';
  document.getElementById('edit-uid').value='';
  document.getElementById('f-label').value='';
  document.getElementById('f-limit-val').value='';
  document.getElementById('f-limit-unit').value='GB';
  document.getElementById('f-max-conn').value='';
  document.getElementById('f-expiry').value='';
  document.getElementById('f-label').disabled=false;
  document.getElementById('add-modal').classList.add('show');
}

function openEdit(uid){
  const l=allLinks.find(x=>x.uuid===uid);if(!l)return;
  document.getElementById('add-modal-title').textContent='Edit Inbound';
  document.getElementById('edit-uid').value=uid;
  document.getElementById('f-label').value=l.label;
  document.getElementById('f-label').disabled=true;
  let lv=0,lu='GB';
  if(l.limit_bytes>0){if(l.limit_bytes%(1024**3)===0){lv=l.limit_bytes/(1024**3);lu='GB';}else if(l.limit_bytes%(1024**2)===0){lv=l.limit_bytes/(1024**2);lu='MB';}else{lv=l.limit_bytes/1024;lu='KB';}}
  document.getElementById('f-limit-val').value=lv||'';
  document.getElementById('f-limit-unit').value=lu;
  document.getElementById('f-max-conn').value=l.max_connections||'';
  document.getElementById('f-expiry').value='';
  document.getElementById('add-modal').classList.add('show');
}

async function submitInbound(){
  const uid=document.getElementById('edit-uid').value;
  const label=document.getElementById('f-label').value.trim();
  const lv=parseFloat(document.getElementById('f-limit-val').value)||0;
  const lu=document.getElementById('f-limit-unit').value;
  const mc=parseInt(document.getElementById('f-max-conn').value)||0;
  const expDays=parseFloat(document.getElementById('f-expiry').value)||0;
  if(!uid&&!label){toast('Name is required','err');return;}
  try{
    let r;
    if(uid){
      r=await fetch('/api/links/'+encodeURIComponent(uid),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit_value:lv,limit_unit:lu,max_connections:mc,...(expDays>0?{expiry_days:expDays}:{})})});
    }else{
      r=await fetch('/api/links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label,limit_value:lv,limit_unit:lu,max_connections:mc,expiry_days:expDays})});
    }
    if(!r.ok){const d=await r.json();toast(d.detail||'Error','err');return;}
    toast(uid?'Inbound updated':'Inbound created');
    closeModal('add-modal');loadInbounds();
  }catch(e){toast('Network error','err');}
}

async function toggleLink(uid,active){
  try{
    const r=await fetch('/api/links/'+encodeURIComponent(uid),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active})});
    if(!r.ok)throw new Error();
    toast(active?'Enabled':'Disabled');
    loadInbounds();
  }catch(e){toast('Error','err');loadInbounds();}
}

async function resetTraffic(uid){
  if(!confirm('Reset traffic for this inbound?'))return;
  try{
    const r=await fetch('/api/links/'+encodeURIComponent(uid),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({reset_usage:true})});
    if(!r.ok)throw new Error();
    toast('Traffic reset');loadInbounds();
  }catch(e){toast('Error','err');}
}

async function deleteLink(uid){
  if(!confirm('Delete this inbound permanently?'))return;
  try{
    const r=await fetch('/api/links/'+encodeURIComponent(uid),{method:'DELETE'});
    if(!r.ok)throw new Error();
    toast('Deleted');loadInbounds();
  }catch(e){toast('Error','err');}
}

async function openSub(uid){
  try{
    const r=await fetch('/api/links/'+encodeURIComponent(uid)+'/sub');if(!r.ok)return;
    const d=await r.json();
    document.getElementById('sub-modal-title').textContent='Subscription — '+d.label;
    document.getElementById('sub-traffic').textContent=
      d.limit_bytes>0?\`\${d.used_mb} MB / \${d.limit_mb} MB (\${d.usage_percent}%)\`:\`\${d.used_mb} MB used (Unlimited)\`;
    document.getElementById('sub-status').textContent=d.active?'Active':'Disabled';
    document.getElementById('sub-expiry').textContent='Unlimited (no expiry)';
    document.getElementById('sub-vless-text').textContent=d.config;
    const domain=window.location.host;
    const subUrl=\`https://\${domain}/sub/\${uid}\`;
    document.getElementById('sub-url-text').textContent=subUrl;
    document.getElementById('sub-qr').src=\`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=\${encodeURIComponent(d.config)}&bgcolor=13131a&color=6366f1&margin=10\`;
    document.getElementById('sub-modal').classList.add('show');
  }catch(e){toast('Error loading subscription','err');}
}

// Addresses
async function loadAddresses(){
  try{
    const r=await fetch('/api/addresses');if(!r.ok)return;
    const d=await r.json();
    const wrap=document.getElementById('chips-wrap');
    const empty=document.getElementById('addr-empty');
    const addrs=d.addresses||[];
    if(addrs.length===0){wrap.innerHTML='';empty.style.display='block';return;}
    empty.style.display='none';
    wrap.innerHTML=addrs.map((a,i)=>\`<div class="chip"><span>\${esc(a)}</span><button class="chip-del" onclick="delAddress(\${i})" title="Remove">×</button></div>\`).join('');
  }catch(e){}
}

function openAddAddressModal(){
  document.getElementById('f-addr').value='';
  document.getElementById('addr-modal').classList.add('show');
}

async function submitAddress(){
  const addr=document.getElementById('f-addr').value.trim();
  if(!addr){toast('Address is required','err');return;}
  try{
    const r=await fetch('/api/addresses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address:addr})});
    if(!r.ok){const d=await r.json();toast(d.detail||'Error','err');return;}
    toast('Address added');closeModal('addr-modal');loadAddresses();
  }catch(e){toast('Network error','err');}
}

async function delAddress(i){
  if(!confirm('Remove this address?'))return;
  try{
    const r=await fetch('/api/addresses/'+i,{method:'DELETE'});
    if(!r.ok)throw new Error();
    toast('Removed');loadAddresses();
  }catch(e){toast('Error','err');}
}

// Domain
async function loadDomain(){
  try{
    const r=await fetch('/api/domain');if(!r.ok)return;
    const d=await r.json();
    document.getElementById('domain-input').value=d.domain||'';
    const sr=await fetch('/stats');const sd=await sr.json();
    document.getElementById('auto-domain').textContent=sd.domain||'—';
    document.getElementById('active-domain').textContent=d.domain||sd.domain||'—';
  }catch(e){}
}

async function saveDomain(){
  const domain=document.getElementById('domain-input').value.trim();
  try{
    const r=await fetch('/api/domain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain})});
    if(!r.ok){const d=await r.json();toast(d.detail||'Error','err');return;}
    toast('Domain saved');loadDomain();
  }catch(e){toast('Error','err');}
}

// Settings
function loadSettings(){
  document.getElementById('set-uptime').textContent=statsData.uptime||'—';
  document.getElementById('set-traffic').textContent=(statsData.total_traffic_mb||0).toFixed(2)+' MB';
  document.getElementById('set-reqs').textContent=(statsData.total_requests||0).toLocaleString();
  const errs=statsData.recent_errors||[];
  const wrap=document.getElementById('err-log-wrap');
  if(errs.length===0){wrap.innerHTML='<div style="font-size:13px;color:var(--muted);padding:8px 0">No recent errors — system is healthy</div>';return;}
  wrap.innerHTML=errs.slice().reverse().map(e=>\`<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--muted)">\${(e.time||'').slice(0,19).replace('T',' ')}</span> — <span style="color:var(--red)">\${esc(e.error||'')}</span></div>\`).join('');
}

async function changePassword(){
  const cur=document.getElementById('pw-current').value;
  const nw=document.getElementById('pw-new').value;
  const conf=document.getElementById('pw-confirm').value;
  if(!cur||!nw){toast('All fields required','err');return;}
  if(nw!==conf){toast('Passwords do not match','err');return;}
  if(nw.length<4){toast('Min 4 characters','err');return;}
  try{
    const r=await fetch('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:cur,new_password:nw})});
    if(!r.ok){const d=await r.json();toast(d.detail||'Error','err');return;}
    toast('Password updated');
    document.getElementById('pw-current').value='';
    document.getElementById('pw-new').value='';
    document.getElementById('pw-confirm').value='';
  }catch(e){toast('Error','err');}
}

async function doLogout(){
  await fetch('/api/logout',{method:'POST'});
  window.location.href='/login';
}


// ---- Inbound creation wizard ----
const WZ_LABELS = ['Name','Data','Expiry','Review'];
let wz = null;
function openWizard(){
  wz = {step:0, created:null};
  document.getElementById('wz-label').value='';
  document.getElementById('wz-unlim').checked=true;
  document.getElementById('wz-limit-row').style.opacity=.4;
  document.getElementById('wz-limit-val').value='';
  document.getElementById('wz-limit-unit').value='GB';
  document.getElementById('wz-expiry').value='';
  document.getElementById('wz-maxconn').value='';
  document.getElementById('wizard-modal').classList.add('show');
  renderWz();
}
function wzErr(m){const e=document.getElementById('wz-err');if(!m){e.classList.remove('show');return;}e.textContent=m;e.classList.add('show');}
function renderWz(){
  const steps=document.getElementById('wz-steps');
  let h='';
  for(let i=0;i<4;i++){
    const cls=i<wz.step?'done':(i===wz.step?'now':'');
    const inner=i<wz.step?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':(i+1);
    h+=\`<div class="wz-col"><div class="wz-dot \${cls}">\${inner}</div><div class="wz-lbl \${i===wz.step?'now':''}">\${WZ_LABELS[i]}</div></div>\`;
    if(i<3)h+=\`<div class="wz-line \${i<wz.step?'done':''}" style="margin-bottom:22px"></div>\`;
  }
  steps.innerHTML=h;
  document.querySelectorAll('.wz-step').forEach(el=>el.classList.toggle('on',+el.dataset.wz===wz.step));
  wzErr(null);
  const back=document.getElementById('wz-back'), next=document.getElementById('wz-next'), foot=document.getElementById('wz-footer');
  if(wz.step===4){foot.style.display='none';return;}
  foot.style.display='flex';
  back.style.visibility=wz.step===0?'hidden':'visible';
  next.innerHTML=wz.step===3?'Create inbound':'Continue →';
  if(wz.step===3)renderWzReview();
}
function renderWzReview(){
  const unlim=document.getElementById('wz-unlim').checked;
  const lv=parseFloat(document.getElementById('wz-limit-val').value)||0;
  const lu=document.getElementById('wz-limit-unit').value;
  const exp=parseFloat(document.getElementById('wz-expiry').value)||0;
  const mc=parseInt(document.getElementById('wz-maxconn').value)||0;
  const row=(k,v)=>\`<div style="display:flex;justify-content:space-between;font-size:13px;padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">\${k}</span><b>\${esc(v)}</b></div>\`;
  document.getElementById('wz-review').innerHTML =
    row('Name',document.getElementById('wz-label').value.trim())+
    row('Data limit',unlim?'Unlimited':(lv>0?lv+' '+lu:'Unlimited'))+
    row('Expiry',exp>0?exp+' days':'Never')+
    row('Max connections',mc>0?String(mc):'Unlimited');
}
function wzValid(){
  if(wz.step===0){
    const l=document.getElementById('wz-label').value.trim();
    if(!l){wzErr('Name is required.');return false;}
    if(!/^[a-zA-Z0-9\\-_. ]+\$/.test(l)){wzErr('Only English letters, numbers and - _ . space.');return false;}
    if(allLinks.some(x=>x.label===l)){wzErr('An inbound with this name already exists.');return false;}
  }
  return true;
}
function wzGo(d){
  if(d>0){
    if(!wzValid())return;
    if(wz.step===3){wzCreate();return;}
  }else{
    if(wz.step===0)return;
  }
  wz.step=Math.min(3,Math.max(0,wz.step+d));
  renderWz();
}
async function wzCreate(){
  const next=document.getElementById('wz-next');
  next.disabled=true;next.textContent='Creating…';wzErr(null);
  const unlim=document.getElementById('wz-unlim').checked;
  const lv=parseFloat(document.getElementById('wz-limit-val').value)||0;
  const lu=document.getElementById('wz-limit-unit').value;
  const exp=parseFloat(document.getElementById('wz-expiry').value)||0;
  const mc=parseInt(document.getElementById('wz-maxconn').value)||0;
  try{
    const r=await fetch('/api/links',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({label:document.getElementById('wz-label').value.trim(),limit_value:unlim?0:lv,limit_unit:lu,max_connections:mc,expiry_days:exp})});
    const d=await r.json();
    if(!r.ok){wzErr(d.detail||'Error');next.disabled=false;next.textContent='Create inbound';return;}
    wz.created=d;
    document.getElementById('wz-link').textContent=d.vless_link;
    document.getElementById('wz-suburl').textContent='https://'+window.location.host+'/sub/'+d.uuid;
    document.getElementById('wz-qr').src=\`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=\${encodeURIComponent(d.vless_link)}&bgcolor=13131a&color=6366f1&margin=10\`;
    wz.step=4;renderWz();
    loadInbounds();
  }catch(e){wzErr('Network error');}
  next.disabled=false;next.textContent='Create inbound';
}
function wzDone(){closeModal('wizard-modal');goPage('inbounds');}

// Init
initChart();
loadStats();
setInterval(loadStats,5000);
</script>

<!-- Inbound creation wizard -->
<div class="overlay" id="wizard-modal">
  <div class="modal" style="max-width:520px">
    <div class="modal-title">New Inbound</div>
    <button class="modal-close" onclick="closeModal('wizard-modal')">✕</button>
    <div class="wz-steps" id="wz-steps"></div>
    <div class="wz-err" id="wz-err"></div>

    <div class="wz-step" data-wz="0">
      <h3>Name your inbound</h3>
      <p class="desc">A short English name — it will appear in the link remark.</p>
      <div class="form-group"><label class="form-label">Inbound name</label>
      <input class="form-input" id="wz-label" placeholder="e.g. phone-main" dir="ltr" maxlength="60"></div>
    </div>

    <div class="wz-step" data-wz="1">
      <h3>Data limit</h3>
      <p class="desc">How much traffic can this inbound use?</p>
      <label class="unlim"><input type="checkbox" id="wz-unlim" checked onchange="document.getElementById('wz-limit-row').style.opacity=this.checked?0.4:1"> Unlimited traffic</label>
      <div class="form-row" id="wz-limit-row" style="opacity:.4">
        <div class="form-group"><label class="form-label">Amount</label><input class="form-input" id="wz-limit-val" type="number" min="0" placeholder="10" dir="ltr"></div>
        <div class="form-group"><label class="form-label">Unit</label><select class="form-select" id="wz-limit-unit"><option>MB</option><option selected>GB</option><option>TB</option></select></div>
      </div>
    </div>

    <div class="wz-step" data-wz="2">
      <h3>Expiry &amp; connections</h3>
      <p class="desc">Optional limits. Leave empty for no expiry / unlimited connections.</p>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Expires in (days)</label><input class="form-input" id="wz-expiry" type="number" min="0" placeholder="Never" dir="ltr"></div>
        <div class="form-group"><label class="form-label">Max connections</label><input class="form-input" id="wz-maxconn" type="number" min="0" placeholder="Unlimited" dir="ltr"></div>
      </div>
    </div>

    <div class="wz-step" data-wz="3">
      <h3>Review</h3>
      <p class="desc">Check everything before creating.</p>
      <div class="summary" id="wz-review" style="background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:6px 16px;margin-bottom:6px"></div>
    </div>

    <div class="wz-step" data-wz="4">
      <div style="text-align:center">
        <div class="wz-done-ico"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h3>Inbound created</h3>
        <p class="desc">Share the link or QR with the user.</p>
      </div>
      <div class="form-group"><label class="form-label">VLESS link</label>
        <div class="code-block" id="wz-link" style="padding-right:44px"></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-primary btn-sm" onclick="copyEl('wz-link')">Copy link</button>
          <button class="btn btn-ghost btn-sm" onclick="copyEl('wz-suburl')">Copy subscription URL</button>
        </div>
      </div>
      <div class="form-group" style="display:none"><span id="wz-suburl"></span></div>
      <div class="qr-box"><img id="wz-qr" alt="QR" style="max-width:180px"></div>
      <div style="text-align:center;margin-top:16px"><button class="btn btn-primary" onclick="wzDone()">Done</button></div>
    </div>

    <div class="modal-footer" id="wz-footer">
      <button class="btn btn-ghost" id="wz-back" onclick="wzGo(-1)">← Back</button>
      <button class="btn btn-primary" id="wz-next" onclick="wzGo(1)">Continue →</button>
    </div>
  </div>
</div>
</body>
</html>`;
const SETUP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>REN — Setup</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0f;--panel:#13131a;--panel2:#18181f;--border:#1c1c28;--border-hi:#2a2a3e;--text:#e2e2f0;--muted:#6b6b8a;--dim:#2e2e42;--accent:#6366f1;--accent-glow:rgba(99,102,241,0.18);--accent-dim:rgba(99,102,241,0.08);--green:#10b981;--green-dim:rgba(16,185,129,0.08);--red:#f43f5e;--red-dim:rgba(244,63,94,0.08)}
html,body{height:100%;background:var(--bg);font-family:'Inter',system-ui,sans-serif;color:var(--text)}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;position:relative;overflow:hidden;padding:20px}
.bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(99,102,241,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.bg-glow{position:fixed;width:700px;height:700px;background:radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
.wrap{position:relative;z-index:1;width:100%;max-width:480px}
.logo{text-align:center;margin-bottom:24px}
.logo-mark{width:52px;height:52px;background:var(--accent);border-radius:15px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff;margin-bottom:12px;box-shadow:0 0 44px var(--accent-glow)}
.logo h1{font-size:22px;font-weight:700;letter-spacing:-.5px}
.logo p{font-size:13px;color:var(--muted);margin-top:4px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.4);overflow:hidden}
/* steps indicator */
.steps{display:flex;align-items:center;margin-bottom:26px}
.step-dot{width:28px;height:28px;border-radius:50%;background:var(--panel2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0;transition:all .3s}
.step-dot.done{background:var(--green-dim);border-color:var(--green);color:var(--green)}
.step-dot.now{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 0 16px var(--accent-glow)}
.step-line{flex:1;height:1px;background:var(--border);margin:0 8px;transition:background .3s}
.step-line.done{background:var(--green)}
.step{display:none;animation:fadeUp .35s ease}
.step.on{display:block}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.step h2{font-size:17px;font-weight:700;margin-bottom:8px;letter-spacing:-.3px}
.step .desc{font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:20px}
.feat{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:10px;background:var(--panel2)}
.feat-ico{width:34px;height:34px;border-radius:9px;background:var(--accent-dim);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.feat b{font-size:13px;display:block;margin-bottom:2px}
.feat span{font-size:12px;color:var(--muted)}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.field input{width:100%;padding:11px 14px;background:#0a0a10;border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}
.field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.field input::placeholder{color:var(--dim)}
.field .hint{font-size:11px;color:var(--muted);margin-top:6px}
.err{background:var(--red-dim);border:1px solid rgba(244,63,94,0.2);color:var(--red);border-radius:9px;padding:10px 14px;font-size:13px;margin-bottom:14px;display:none;align-items:center;gap:8px}
.err.show{display:flex}
.nav{display:flex;justify-content:space-between;gap:10px;margin-top:24px}
.btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:11px 22px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;border:none;transition:all .15s}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{filter:brightness(1.1);box-shadow:0 4px 18px var(--accent-glow)}
.btn-primary:disabled{opacity:.5;pointer-events:none}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}
.btn-ghost:hover{border-color:var(--border-hi);color:var(--text)}
.done-ico{width:64px;height:64px;border-radius:50%;background:var(--green-dim);border:1px solid var(--green);color:var(--green);display:flex;align-items:center;justify-content:center;margin:6px auto 18px;animation:pop .5s cubic-bezier(.34,1.4,.64,1)}
@keyframes pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.center{text-align:center}
.summary{background:var(--panel2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:6px}
.summary .row{display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px solid var(--border)}
.summary .row:last-child{border-bottom:none}
.summary .k{color:var(--muted)}
.summary .v{font-weight:600}
.spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:none}
.btn.loading .spinner{display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="bg-glow"></div>
<div class="wrap">
  <div class="logo">
    <div class="logo-mark">R</div>
    <h1>REN Gateway</h1>
    <p>First-time setup</p>
  </div>
  <div class="card">
    <div class="steps" id="steps"></div>
    <div class="err" id="err"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span id="err-msg"></span></div>

    <div class="step on" data-step="0">
      <h2>Welcome to REN</h2>
      <p class="desc">Your VLESS gateway panel is almost ready. This short wizard will set your admin password and proxy domain.</p>
      <div class="feat"><div class="feat-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div><b>Secure by default</b><span>Token-based auth, no cookies, no tracking.</span></div></div>
      <div class="feat"><div class="feat-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div><div><b>Manage inbounds</b><span>Create links with data limits, expiry and traffic stats.</span></div></div>
      <div class="feat"><div class="feat-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div><div><b>Subscriptions</b><span>Per-inbound subscription URLs for v2rayNG and friends.</span></div></div>
    </div>

    <div class="step" data-step="1">
      <h2>Admin password</h2>
      <p class="desc">Choose the password you'll use to sign in to this panel.</p>
      <div class="field"><label>Password</label><input type="password" id="pw" placeholder="••••••••" autocomplete="new-password"><div class="hint">At least 4 characters.</div></div>
      <div class="field"><label>Confirm password</label><input type="password" id="pw2" placeholder="••••••••" autocomplete="new-password"></div>
    </div>

    <div class="step" data-step="2">
      <h2>Proxy domain</h2>
      <p class="desc">The public host your VLESS links will point to. You can change it later in <b>Domain</b>.</p>
      <div class="field"><label>Domain</label><input type="text" id="domain" placeholder="example.com" dir="ltr"><div class="hint">Your <b>proxy</b> host (where VLESS clients connect) — without https://</div></div>
    </div>

    <div class="step" data-step="3">
      <div class="center">
        <div class="done-ico"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h2>You're all set</h2>
        <p class="desc">Your gateway is configured. Sign in to open the dashboard.</p>
      </div>
      <div class="summary">
        <div class="row"><span class="k">Admin user</span><span class="v">admin</span></div>
        <div class="row"><span class="k">Proxy domain</span><span class="v" id="sum-domain" dir="ltr">—</span></div>
      </div>
    </div>

    <div class="nav">
      <button class="btn btn-ghost" id="btn-back" onclick="go(-1)" style="visibility:hidden">← Back</button>
      <button class="btn btn-primary" id="btn-next" onclick="go(1)"><span class="spinner" id="spin"></span><span id="next-txt">Continue →</span></button>
    </div>
  </div>
</div>
<script>
let cur = 0;
const N = 4;
const labels = ['Welcome','Password','Domain','Done'];
function renderSteps(){
  const w = document.getElementById('steps');
  let h = '';
  for(let i=0;i<N;i++){
    const cls = i<cur?'done':(i===cur?'now':'');
    const inner = i<cur
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
      : (i+1);
    h += \`<div class="step-dot \${cls}">\${inner}</div>\`;
    if(i<N-1) h += \`<div class="step-line \${i<cur?'done':''}"></div>\`;
  }
  w.innerHTML = h;
  document.querySelectorAll('.step').forEach(s=>s.classList.toggle('on',+s.dataset.step===cur));
  document.getElementById('btn-back').style.visibility = cur===0||cur===N-1 ? 'hidden':'visible';
  document.getElementById('next-txt').textContent = cur===1?'Set password →':cur===2?'Finish setup':cur===N-1?'Open dashboard':'Continue →';
  hideErr();
}
function showErr(m){document.getElementById('err-msg').textContent=m;document.getElementById('err').classList.add('show');}
function hideErr(){document.getElementById('err').classList.remove('show');}
function validStep(){
  if(cur===1){
    const a=document.getElementById('pw').value, b=document.getElementById('pw2').value;
    if(a.length<4){showErr('Password must be at least 4 characters.');return false;}
    if(a!==b){showErr('Passwords do not match.');return false;}
  }
  if(cur===2){
    const d=document.getElementById('domain').value.trim().toLowerCase().replace(/^https?:\\/\\//,'').replace(/\\/\$/,'');
    if(!d){showErr('Domain is required.');return false;}
    if(!/^[a-z0-9\\-_.]+\$/.test(d)){showErr('Invalid domain format.');return false;}
    document.getElementById('domain').value=d;
  }
  return true;
}
async function finish(){
  const btn=document.getElementById('btn-next');
  btn.classList.add('loading');btn.disabled=true;hideErr();
  try{
    const r=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password:document.getElementById('pw').value,domain:document.getElementById('domain').value.trim()})});
    const d=await r.json();
    if(!r.ok){showErr(d.detail||'Setup failed');btn.classList.remove('loading');btn.disabled=false;cur=1;renderSteps();return;}
    document.getElementById('sum-domain').textContent=document.getElementById('domain').value.trim();
    cur=3;renderSteps();
  }catch(e){showErr('Connection error.');}
  btn.classList.remove('loading');btn.disabled=false;
}
function go(d){
  if(d>0){
    if(!validStep())return;
    if(cur===2){finish();return;}
    if(cur===N-1){window.location.href='/login';return;}
  }
  cur=Math.min(N-1,Math.max(0,cur+d));
  renderSteps();
}
document.getElementById('pw2').addEventListener('keydown',e=>{if(e.key==='Enter')go(1);});
document.getElementById('domain').addEventListener('keydown',e=>{if(e.key==='Enter')go(1);});
// prefill domain: existing proxy_host if set, else current hostname (no port)
try{
  fetch('/api/setup-info').then(r=>r.json()).then(d=>{
    if(d && d.domain) document.getElementById('domain').value=d.domain;
    else document.getElementById('domain').value=window.location.hostname;
  }).catch(()=>{document.getElementById('domain').value=window.location.hostname;});
}catch(e){}
renderSteps();
</script>
</body>
</html>
`;
const DEPLOY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>REN — Deploy your own panel</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0c0c0f;--panel:#13131a;--panel2:#18181f;--border:#1c1c28;--border-hi:#2a2a3e;--text:#e2e2f0;--muted:#6b6b8a;--dim:#2e2e42;--accent:#6366f1;--accent-glow:rgba(99,102,241,0.18);--accent-dim:rgba(99,102,241,0.08);--green:#10b981;--green-dim:rgba(16,185,129,0.08);--red:#f43f5e;--red-dim:rgba(244,63,94,0.08);--yellow:#f59e0b;--yellow-dim:rgba(245,158,11,0.08)}
html,body{height:100%;background:var(--bg);font-family:'Inter',system-ui,sans-serif;color:var(--text)}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;position:relative;overflow:hidden;padding:20px}
.bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(99,102,241,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.bg-glow{position:fixed;width:700px;height:700px;background:radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none}
.wrap{position:relative;z-index:1;width:100%;max-width:520px;max-height:94vh;overflow-y:auto}
.logo{text-align:center;margin-bottom:22px}
.logo-mark{width:52px;height:52px;background:var(--accent);border-radius:15px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff;margin-bottom:12px;box-shadow:0 0 44px var(--accent-glow)}
.logo h1{font-size:22px;font-weight:700;letter-spacing:-.5px}
.logo p{font-size:13px;color:var(--muted);margin-top:4px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:28px 30px;box-shadow:0 20px 60px rgba(0,0,0,0.4);overflow:hidden}
.steps{display:flex;align-items:center;margin-bottom:24px}
.step-dot{width:28px;height:28px;border-radius:50%;background:var(--panel2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted);flex-shrink:0;transition:all .3s}
.step-dot.done{background:var(--green-dim);border-color:var(--green);color:var(--green)}
.step-dot.now{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 0 16px var(--accent-glow)}
.step-line{flex:1;height:1px;background:var(--border);margin:0 8px}
.step-line.done{background:var(--green)}
.step{display:none;animation:fadeUp .35s ease}
.step.on{display:block}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.step h2{font-size:17px;font-weight:700;margin-bottom:8px;letter-spacing:-.3px}
.step .desc{font-size:13px;color:var(--muted);line-height:1.65;margin-bottom:18px}
.step .desc a{color:var(--accent);text-decoration:none}
.step .desc a:hover{text-decoration:underline}
.step .desc ol{margin:8px 0 0 18px}
.step .desc ol li{margin-bottom:4px}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.field input{width:100%;padding:11px 14px;background:#0a0a10;border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}
.field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.field input::placeholder{color:var(--dim)}
.field input.mono{font-family:ui-monospace,monospace;font-size:12px}
.field .hint{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5}
.err{background:var(--red-dim);border:1px solid rgba(244,63,94,0.2);color:var(--red);border-radius:9px;padding:10px 14px;font-size:13px;margin-bottom:14px;display:none;align-items:center;gap:8px}
.err.show{display:flex}
.okmsg{background:var(--green-dim);border:1px solid rgba(16,185,129,0.25);color:var(--green);border-radius:9px;padding:10px 14px;font-size:13px;margin-bottom:14px;display:none;align-items:center;gap:8px}
.okmsg.show{display:flex}
.nav{display:flex;justify-content:space-between;gap:10px;margin-top:22px}
.btn{font-family:inherit;font-size:13px;font-weight:600;border-radius:10px;padding:11px 22px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;border:none;transition:all .15s}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{filter:brightness(1.1);box-shadow:0 4px 18px var(--accent-glow)}
.btn-primary:disabled{opacity:.5;pointer-events:none}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}
.btn-ghost:hover{border-color:var(--border-hi);color:var(--text)}
.prog{margin:8px 0 4px}
.prog-row{display:flex;align-items:center;gap:10px;padding:9px 0;font-size:13px;color:var(--muted)}
.prog-row .st{width:20px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.prog-row.doing{color:var(--text)}
.prog-row.done{color:var(--green)}
.prog-sub{font-size:11px;color:var(--dim);margin-left:30px;margin-top:-4px;margin-bottom:4px}
.spin{width:15px;height:15px;border:2px solid var(--border-hi);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.done-ico{width:64px;height:64px;border-radius:50%;background:var(--green-dim);border:1px solid var(--green);color:var(--green);display:flex;align-items:center;justify-content:center;margin:6px auto 18px;animation:pop .5s cubic-bezier(.34,1.4,.64,1)}
@keyframes pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.center{text-align:center}
.big-url{display:inline-block;background:var(--panel2);border:1px solid var(--border-hi);border-radius:12px;padding:12px 20px;font-size:15px;font-weight:700;color:var(--accent);text-decoration:none;margin:14px 0;direction:ltr}
.big-url:hover{border-color:var(--accent)}
.note{font-size:11px;color:var(--muted);line-height:1.6;margin-top:14px;text-align:center}
.secure{display:flex;gap:8px;align-items:flex-start;background:var(--yellow-dim);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:10px 13px;font-size:12px;color:var(--yellow);margin-bottom:16px;line-height:1.55}
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="bg-glow"></div>
<div class="wrap">
  <div class="logo">
    <div class="logo-mark">R</div>
    <h1>Deploy your own panel</h1>
    <p>Two tokens in — your own REN Gateway comes out. Fully automatic.</p>
  </div>
  <div class="card">
    <div class="steps" id="steps"></div>
    <div class="err" id="err"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span id="err-msg"></span></div>
    <div class="okmsg" id="okmsg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span id="ok-msg"></span></div>

    <!-- STEP 1: wasmer token -->
    <div class="step on" data-step="0">
      <h2>Wasmer token</h2>
      <p class="desc">Sign in at <a href="https://wasmer.io" target="_blank" rel="noopener">wasmer.io</a>, open your avatar → <b>Settings → Tokens</b>, create a token and paste it here. It's only used for this deployment and never stored.</p>
      <div class="secure"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Your token travels over HTTPS and is used once to create your app. We never save it.</span></div>
      <div class="field"><label>Wasmer personal token</label><input type="password" id="d-token" class="mono" placeholder="wam_…" dir="ltr" autocomplete="off"></div>
    </div>

    <!-- STEP 2: database token -->
    <div class="step" data-step="1">
      <h2>Database token</h2>
      <p class="desc">The panel needs a database to remember your users and settings. We'll create a <b>free database for you automatically</b> — just give us a token:
        <ol>
          <li>Sign in at <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a></li>
          <li>Go to <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener">Account → Access Tokens</a></li>
          <li>Create a token and paste it here</li>
        </ol>
      </p>
      <div class="secure"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Used once to create your database. Never stored.</span></div>
      <div class="field"><label>Database access token</label><input type="password" id="d-sbtoken" class="mono" placeholder="sbp_…" dir="ltr" autocomplete="off"></div>
    </div>

    <!-- STEP 3: panel settings -->
    <div class="step" data-step="2">
      <h2>Panel settings</h2>
      <p class="desc">Name your panel and pick a password. That's all — the database and hosting are handled for you.</p>
      <div class="field"><label>App name</label><input type="text" id="d-app" placeholder="my-panel" dir="ltr" maxlength="40"><div class="hint">Lowercase letters, numbers and dashes. Your panel will live at <b id="app-preview" dir="ltr">my-panel.wasmer.app</b></div></div>
      <div class="field"><label>Panel password</label><input type="password" id="d-pass" placeholder="Choose an admin password" autocomplete="new-password"><div class="hint">Min 4 characters — you'll sign in with this.</div></div>
      <div class="field"><label>Proxy host <span style="text-transform:none;letter-spacing:0">(optional)</span></label><input type="text" id="d-proxy" placeholder="vless.example.com" dir="ltr"><div class="hint">Your VLESS server host. Can be set later in the Domain page.</div></div>
    </div>

    <!-- STEP 4: auto deploy -->
    <div class="step" data-step="3">
      <h2>Sit back — we're building everything</h2>
      <p class="desc">Creating your database, tables and panel automatically. This takes a few minutes.</p>
      <div class="prog" id="d-prog"></div>
    </div>

    <!-- STEP 5: done -->
    <div class="step" data-step="4">
      <div class="center">
        <div class="done-ico"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
        <h2>Your panel is live</h2>
        <p class="desc">Sign in with the password you chose and run the setup wizard.</p>
        <a class="big-url" id="d-url" href="#" target="_blank" rel="noopener">—</a>
        <p class="note">Tip: point your VLESS server's UUIDs at the users you create — new users need a proxy redeploy to take effect.</p>
      </div>
    </div>

    <div class="nav" id="d-nav">
      <button class="btn btn-ghost" id="btn-back" onclick="go(-1)" style="visibility:hidden">← Back</button>
      <button class="btn btn-primary" id="btn-next" onclick="go(1)"><span id="next-txt">Validate token →</span></button>
    </div>
  </div>
</div>
<script>
let cur = 0, D = {};
const N = 4;
document.getElementById('d-app').addEventListener('input', e=>{
  document.getElementById('app-preview').textContent = (e.target.value.trim()||'my-panel') + '.wasmer.app';
});
function renderSteps(){
  const w = document.getElementById('steps');
  let h = '';
  for(let i=0;i<N;i++){
    const cls = i<cur?'done':(i===cur?'now':'');
    const inner = i<cur
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
      : (i+1);
    h += \`<div class="step-dot \${cls}">\${inner}</div>\`;
    if(i<N-1) h += \`<div class="step-line \${i<cur?'done':''}"></div>\`;
  }
  w.innerHTML = h;
  document.querySelectorAll('.step').forEach(s=>s.classList.toggle('on',+s.dataset.step===cur));
  document.getElementById('btn-back').style.visibility = (cur===0||cur===N-1) ? 'hidden':'visible';
  const nx = document.getElementById('next-txt');
  nx.textContent = cur===0?'Validate token →':cur===1?'Validate token →':cur===2?'Deploy automatically →':'';
  document.getElementById('d-nav').style.display = cur>=3 ? 'none':'flex';
  hideErr(); hideOk();
}
function showErr(m){document.getElementById('err-msg').textContent=m;document.getElementById('err').classList.add('show');}
function hideErr(){document.getElementById('err').classList.remove('show');}
function showOk(m){document.getElementById('ok-msg').textContent=m;document.getElementById('okmsg').classList.add('show');}
function hideOk(){document.getElementById('okmsg').classList.remove('show');}
async function api(path, body){
  const r = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.detail||('HTTP '+r.status));
  return d;
}
async function validateWasmer(){
  const t = document.getElementById('d-token').value.trim();
  if(!t){showErr('Paste your Wasmer token first.');return false;}
  const btn=document.getElementById('btn-next');btn.disabled=true;hideErr();
  try{
    const d = await api('/api/deploy/validate-token',{wasmer_token:t});
    D.token=t; D.username=d.username;
    showOk('Signed in as '+d.username+' — token is valid.');
    return true;
  }catch(e){showErr(e.message);return false;}
  finally{btn.disabled=false;}
}
async function validateSb(){
  const t = document.getElementById('d-sbtoken').value.trim();
  if(!t){showErr('Paste your database token first.');return false;}
  const btn=document.getElementById('btn-next');btn.disabled=true;hideErr();
  try{
    const d = await api('/api/deploy/validate-sb-token',{supabase_token:t});
    D.sbToken=t; D.orgSlug=d.orgs[0].slug; D.orgName=d.orgs[0].name;
    showOk('Database connected'+(d.orgs.length>1?' — using organization "'+d.orgs[0].name+'"':'')+'. We\\'ll create your database automatically.');
    return true;
  }catch(e){showErr(e.message);return false;}
  finally{btn.disabled=false;}
}
function validConfig(){
  const app=document.getElementById('d-app').value.trim().toLowerCase();
  const pw=document.getElementById('d-pass').value;
  const proxy=document.getElementById('d-proxy').value.trim().toLowerCase().replace(/^https?:\\/\\//,'').replace(/\\/\$/,'');
  if(!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?\$/.test(app)){showErr('App name: lowercase letters, numbers and dashes only.');return false;}
  if(pw.length<4){showErr('Panel password must be at least 4 characters.');return false;}
  if(proxy && !/^[a-z0-9\\-_.]+\$/.test(proxy)){showErr('Invalid proxy host format.');return false;}
  Object.assign(D,{app,pw,proxy});
  document.getElementById('d-app').value=app;
  return true;
}
const PROG_STEPS=[
  {t:'Creating your database', s:'Free tier, set up automatically'},
  {t:'Waiting for the database to be ready', s:'Provisioning — usually 1–2 minutes'},
  {t:'Creating tables & reading API keys', s:'panel_users + panel_settings'},
  {t:'Deploying your panel to Wasmer Edge', s:'Publishing the app and saving secrets'},
];
function renderProg(activeIdx, sub){
  document.getElementById('d-prog').innerHTML = PROG_STEPS.map((p,i)=>{
    const cls = i<activeIdx?'done':(i===activeIdx?'doing':'');
    const ico = i<activeIdx
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
      : (i===activeIdx?'<div class="spin"></div>':'<div style="width:15px;height:15px;border-radius:50%;border:1px solid var(--border)"></div>');
    const subHtml = (i===activeIdx && sub) ? \`<div class="prog-sub">\${sub}</div>\` : '';
    return \`<div class="prog-row \${cls}"><span class="st">\${ico}</span>\${p.t}</div>\${subHtml}\`;
  }).join('');
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function doDeploy(){
  cur=3;renderSteps();
  try{
    // 1. create database project
    renderProg(0);
    const c = await api('/api/deploy/sb-create',{supabase_token:D.sbToken, org_slug:D.orgSlug, project_name:D.app+'-db'});
    const ref = c.ref;
    // 2. wait until ready
    renderProg(1);
    let ready=false, status='';
    for(let i=0;i<36;i++){
      await sleep(10000);
      try{
        const s = await api('/api/deploy/sb-status',{supabase_token:D.sbToken, ref});
        status=s.status;
        renderProg(1, 'Status: '+status);
        if(s.ready){ready=true;break;}
      }catch(e){ renderProg(1, 'Retrying…'); }
    }
    if(!ready) throw new Error('Database took too long to become ready (last status: '+status+'). Try again in a few minutes.');
    // 3. tables + keys
    renderProg(2);
    const sb = await api('/api/deploy/sb-setup',{supabase_token:D.sbToken, ref});
    // 4. wasmer deploy
    renderProg(3);
    const d = await api('/api/deploy/wasmer',{wasmer_token:D.token, app_name:D.app, supabase_url:sb.supabase_url, service_role_key:sb.service_role_key, panel_password:D.pw, proxy_host:D.proxy||''});
    renderProg(4);
    document.getElementById('d-url').textContent=d.url.replace('https://','');
    document.getElementById('d-url').href=d.url;
    setTimeout(()=>{cur=4;renderSteps();},700);
  }catch(e){
    renderProg(-1);
    showErr(e.message);
    document.getElementById('d-nav').style.display='flex';
    cur=2;renderSteps();
  }
}
async function go(d){
  if(d>0){
    if(cur===0){ if(!(await validateWasmer()))return; }
    if(cur===1){ if(!(await validateSb()))return; }
    if(cur===2){ if(!validConfig())return; await doDeploy(); return; }
  }
  cur=Math.min(N-1,Math.max(0,cur+d));
  renderSteps();
}
renderSteps();
</script>
</body>
</html>
`;

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
      if (e.status === 401 || e.status === 403) return err("Invalid database token — create one at supabase.com/dashboard/account/tokens", 401);
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
      return err("Could not create database: " + e.message, e.status || 500);
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
