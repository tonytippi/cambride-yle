import { spawn } from "node:child_process";
import https from "node:https";

const media = spawn(process.execPath, ["tests/e2e/media-test-server.mjs"], { stdio: "inherit" });
let next;

function stop(code = 0) {
  media.kill();
  next?.kill();
  process.exit(code);
}

function mediaReady() {
  return new Promise((resolve, reject) => {
    const request = https.request("https://127.0.0.1:3443/owned-e2e-image.png", { method: "HEAD" }, (response) => response.statusCode === 200 ? resolve() : reject(new Error(`Media server returned ${response.statusCode}`)));
    request.on("error", reject);
    request.end();
  });
}

for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    await mediaReady();
    break;
  } catch {
    if (attempt === 49) stop(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

next = spawn("npm", ["run", "dev", "--", "--port", "3100"], { stdio: "inherit" });
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
next.on("exit", (code) => stop(code ?? 1));
media.on("exit", (code) => stop(code ?? 1));
