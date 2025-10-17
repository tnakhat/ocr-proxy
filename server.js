import express from "express";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PUBLIC_DIR = path.join(__dirname, "public");
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// If tesseract.umd.min.js missing, try to download from CDN on startup
const TESS_PATH = path.join(PUBLIC_DIR, "tesseract.umd.min.js");
const TESS_CDN = "https://unpkg.com/tesseract.js@5/dist/tesseract.umd.min.js";

async function ensureTesseract() {
  if (fs.existsSync(TESS_PATH)) {
    console.log("tesseract.umd.min.js already exists");
    return;
  }
  console.log("Downloading tesseract.umd.min.js from CDN...");
  try {
    const res = await fetch(TESS_CDN);
    if (!res.ok) {
      console.error("Failed to download Tesseract from CDN:", res.status);
      return;
    }
    const txt = await res.text();
    fs.writeFileSync(TESS_PATH, txt, "utf8");
    console.log("Saved tesseract.umd.min.js to public/");
  } catch (err) {
    console.error("Error fetching tesseract:", err);
  }
}

// serve static public files
app.use(express.static(PUBLIC_DIR, { index: false }));

// simple health
app.get("/", (req, res) => res.send("ocr-proxy ready"));

// proxy endpoint: /proxy?url=<image_url>&referer=<optional>
app.get("/proxy", async (req, res) => {
  try {
    const imageUrl = req.query.url;
    const referer = req.query.referer || "";
    if (!imageUrl) return res.status(400).json({ ok: false, error: "Missing ?url" });

    const headers = {
      "User-Agent": "Mozilla/5.0 (compatible)",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      ...(referer ? { Referer: referer } : {}),
    };

    const resp = await fetch(imageUrl, { headers, redirect: "follow" });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      return res.status(resp.status).json({ ok: false, status: resp.status, error: "Remote fetch failed", snippet: txt ? txt.slice(0, 300) : null });
    }
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/") && !contentType.startsWith("application/octet-stream")) {
      const txt = await resp.text().catch(() => null);
      return res.status(400).json({ ok: false, error: "Not an image", contentType, snippet: txt ? txt.slice(0, 300) : null });
    }

    const arrayBuffer = await resp.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${b64}`;
    res.json({ ok: true, contentType, base64: dataUrl });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// On start, ensure tesseract file exists (download if needed), then start server
const PORT = process.env.PORT || 3000;
ensureTesseract().finally(() => {
  app.listen(PORT, () => {
    console.log(`OCR proxy listening on port ${PORT}`);
    console.log(`Tesseract file available at /tesseract.umd.min.js (if downloaded)`);
  });
});