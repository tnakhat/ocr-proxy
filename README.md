OCR Proxy package for Render / Node.js
-------------------------------------

What's included:
- server.js        : Express server that serves /public and a /proxy endpoint.
- package.json     : Node dependencies and start script.
- public/          : directory where tesseract.umd.min.js will be saved on first run
                     (server attempts to download it from CDN if missing).

How it works:
1. The server serves static files from /public (so /tesseract.umd.min.js will be available).
2. The /proxy endpoint fetches an image URL and returns JSON:
   { ok: true, contentType: "...", base64: "data:.../base64,..." }
   This can be used by Tampermonkey scripts to bypass CORS.

Deployment:
- Upload this folder to Render, ensure Node version supports ES modules (Node 18+).
- On first start the server will download tesseract.umd.min.js from the CDN into /public.
- You can also manually place tesseract.umd.min.js into /public if preferred.

Notes:
- If your environment blocks external CDN downloads, upload tesseract.umd.min.js manually to /public.
- The server intentionally does not perform OCR server-side (it provides the image proxy and serves the tesseract UMD file).