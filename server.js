import express from "express";
import fetch from "node-fetch";

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/proxy", async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ error: "Missing ?url parameter" });
    }

    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "RenderProxy/1.0" },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch image" });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const base64 = Buffer.from(buffer).toString("base64");

    res.json({
      ok: true,
      base64: `data:${contentType};base64,${base64}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Proxy running on port ${PORT}`));
