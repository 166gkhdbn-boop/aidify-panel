/* Build: inline login.html + dashboard.html into the WinterJS app. */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

const login = esc(fs.readFileSync(path.join(root, "src/login.html"), "utf8"));
const dash = esc(fs.readFileSync(path.join(root, "src/dashboard.html"), "utf8"));
let backend = fs.readFileSync(path.join(root, "src/backend.js"), "utf8");

backend = backend.replace("__LOGIN_HTML__", "`" + login + "`");
backend = backend.replace("__DASHBOARD_HTML__", "`" + dash + "`");

fs.mkdirSync(path.join(root, "app"), { recursive: true });
fs.writeFileSync(path.join(root, "app/app.js"), backend);
console.log("built app/app.js", backend.length, "bytes");
