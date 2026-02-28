import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "dist");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";

function contentType(p) {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    let reqPath = decodeURIComponent(url.pathname);
    if (reqPath === "/") reqPath = "/index.html";

    // Serve static files from dist.
    const fullPath = safeJoin(distDir, reqPath);
    if (!fullPath) {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const data = fs.readFileSync(fullPath);
      res.writeHead(200, {
        "Content-Type": contentType(fullPath),
        "Cache-Control": fullPath.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      });
      res.end(data);
      return;
    }

    // SPA fallback
    const indexPath = path.join(distDir, "index.html");
    const html = fs.readFileSync(indexPath);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(html);
  } catch (e) {
    res.writeHead(500);
    res.end("Internal error");
  }
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Mission Control server listening on http://${host}:${port}`);
});
