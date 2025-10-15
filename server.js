// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();

// ====== CONFIG ======
const FETCH_TIMEOUT_MS = 20000; // وقت انتظار جلب الصورة
const MAX_BYTES = 10 * 1024 * 1024; // حد أقصى 10MB (يمكن تعديل)
// ====================

// تمكين CORS عام
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

function isDataAnImage(contentType) {
  return typeof contentType === "string" && contentType.startsWith("image/");
}

// Helper: fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// /proxy?url=<image-url>&referer=<optional-referer>
app.get("/proxy", async (req, res) => {
  try {
    const imageUrl = req.query.url;
    const referer = req.query.referer; // optional

    if (!imageUrl) {
      return res.status(400).json({ ok: false, error: "Missing ?url parameter" });
    }

    // validate simple URL
    let parsed;
    try {
      parsed = new URL(imageUrl);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Invalid URL format" });
    }

    // Build headers to mimic a real browser (helps bypass some protections)
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36",
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      // Referrer is optional and only included if the client provided it
      ...(referer ? { Referer: referer } : {}),
    };

    // fetch the resource
    const response = await fetchWithTimeout(imageUrl, { headers, redirect: "follow" });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Remote fetch failed with status ${response.status} ${response.statusText}`,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!isDataAnImage(contentType)) {
      // guard: if the remote returned HTML or JSON instead of an image, return clear error
      const snippetBuffer = await response.arrayBuffer().catch(() => null);
      let snippet = "";
      try {
        if (snippetBuffer) {
          const view = new Uint8Array(snippetBuffer).subarray(0, 512);
          snippet = new TextDecoder("utf-8", { fatal: false }).decode(view);
        }
      } catch (e) {
        snippet = "";
      }
      return res.status(400).json({
        ok: false,
        error: "Remote URL did not return an image (content-type != image/*)",
        contentType,
        snippet: snippet ? snippet.slice(0, 300) : undefined,
      });
    }

    // read as buffer but limit size to MAX_BYTES
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: "Image too large" });
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.json({ ok: true, contentType, base64: dataUrl });
  } catch (err) {
    console.error("Proxy error:", err && err.message ? err.message : err);
    if (err.name === "AbortError") {
      return res.status(504).json({ ok: false, error: "Fetch timed out" });
    }
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ OCR Proxy running on port ${PORT}`);
});