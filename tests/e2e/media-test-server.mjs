import { createServer } from "node:https";
import { readFile } from "node:fs/promises";

const port = Number(process.env.E2E_MEDIA_PORT ?? "3443");
const assetPath = "/owned-e2e-image.png";
const asset = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9qQAAAABJRU5ErkJggg==", "base64");

const server = createServer({
  key: await readFile(new URL("./media-test-key.pem", import.meta.url)),
  cert: await readFile(new URL("./media-test-cert.pem", import.meta.url)),
}, (request, response) => {
  if (request.url !== assetPath || !["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Length": asset.length,
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
  });
  response.end(request.method === "HEAD" ? undefined : asset);
});

server.listen(port, "127.0.0.1");
