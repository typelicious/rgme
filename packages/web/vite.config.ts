import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

function archiveProxyPlugin(): Plugin {
  return {
    name: "archive-download-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/archive-download/")) {
          return next();
        }
        // Subpath is e.g. "Amiga-Arquivista/Oil%20Imperium%20(EU).zip"
        const subPath = req.url.slice("/api/archive-download/".length);
        if (!subPath) {
          res.statusCode = 400;
          res.end("Missing target archive identifier/path");
          return;
        }
        const targetUrl = `https://archive.org/download/${subPath}`;
        try {
          const upstream = await fetch(targetUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) RGME/0.7.0",
              Accept: "*/*"
            },
            redirect: "follow"
          });
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end(`Archive.org upstream returned HTTP ${upstream.status}`);
            return;
          }
          const buffer = await upstream.arrayBuffer();
          res.statusCode = 200;
          res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(Buffer.from(buffer));
        } catch (err) {
          res.statusCode = 502;
          res.end(`Archive proxy error: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [archiveProxyPlugin(), react(), tailwindcss()],
  resolve: { alias: { "@rgme/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) } }
});
