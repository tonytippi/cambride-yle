import { createServer } from "node:https";
import { readFile } from "node:fs/promises";

const port = Number(process.env.E2E_MEDIA_PORT ?? "3443");
const asset = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9qQAAAABJRU5ErkJggg==", "base64");
/* A short silent PCM WAV, generated so the browser can preload and play a real audio asset. */
function silentWav(milliseconds = 300, sampleRate = 8000) {
  const samples = Math.round((sampleRate * milliseconds) / 1000);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write("WAVE", 8);
  wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
  return wav;
}
const assets = new Map([
  ["/owned-e2e-image.png", { body: asset, type: "image/png" }],
  ["/owned-e2e-audio.wav", { body: silentWav(), type: "audio/wav" }],
]);

const server = createServer({
  key: await readFile(new URL("./media-test-key.pem", import.meta.url)),
  cert: await readFile(new URL("./media-test-cert.pem", import.meta.url)),
}, (request, response) => {
  const served = assets.get(request.url ?? "");
  if (!served || !["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Length": served.body.length,
    "Content-Type": served.type,
    "Cache-Control": "no-store",
  });
  response.end(request.method === "HEAD" ? undefined : served.body);
});

server.listen(port, "127.0.0.1");
