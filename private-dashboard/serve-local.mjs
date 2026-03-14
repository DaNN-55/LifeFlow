import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 8000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function resolveRequestPath(urlPath = "/") {
  const relativePath = decodeURIComponent(urlPath.split("?")[0] || "/");
  if (relativePath === "/" || relativePath === "") {
    return path.join(__dirname, "login.html");
  }
  return path.join(__dirname, relativePath.replace(/^\/+/, ""));
}

function getMimeType(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

const server = http.createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      response.writeHead(302, { Location: `${request.url?.replace(/\/?$/, "/") || "/"}login.html` });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": getMimeType(filePath), "Cache-Control": "no-store" });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`LifeFlow dashboard static server running at http://localhost:${port}/login.html`);
});
