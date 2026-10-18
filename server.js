#!/usr/bin/env node
/*
 * SHOONYA Web Server & Admin API
 * Serves the interactive 3D website and the Studio Admin Panel at /admin.
 */
"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "site-data.json");
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

const requestedPort = Number(option("--port") || process.env.PORT || 3000);
const host = option("--host") || process.env.HOST || undefined;
const openBrowser = args.includes("--open");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

function readSiteData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error reading site data:", err.message);
  }
  return { brand: {}, hero: {}, events: [], gallery: [], enquiries: [] };
}

function writeSiteData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing site data:", err.message);
    return false;
  }
}

function parseBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (e) {
      callback(e, null);
    }
  });
}

function serveFile(req, res, filePath, stat) {
  const headers = {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Last-Modified": stat.mtime.toUTCString(),
    "Cache-Control": "no-cache",
    "Accept-Ranges": "bytes"
  };

  const since = req.headers["if-modified-since"];
  if (since && Math.floor(stat.mtimeMs / 1000) <= Math.floor(Date.parse(since) / 1000)) {
    res.writeHead(304, headers);
    return res.end();
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range && (range[1] || range[2])) {
    const size = stat.size;
    let start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
    let end = range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1);
    if (start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": end - start + 1
    });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function sendNotFound(req, res, pathname) {
  const notFoundPage = path.join(ROOT, "404.html");
  if (fs.existsSync(notFoundPage)) {
    res.writeHead(404, { "Content-Type": MIME_TYPES[".html"], "Cache-Control": "no-cache" });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(notFoundPage).pipe(res);
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`404 Not Found: ${pathname}\n`);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }

  // --- Next.js Image Optimization Route Fallback ---
  if (pathname === "/_next/image") {
    try {
      const parsedUrl = new URL(req.url, "http://localhost");
      const origUrl = parsedUrl.searchParams.get("url");
      if (origUrl) {
        const rawPath = decodeURIComponent(origUrl).replace(/^\//, "");
        const targetFile = path.join(ROOT, rawPath);
        if (targetFile.startsWith(ROOT) && fs.existsSync(targetFile)) {
          return fs.stat(targetFile, (err, stat) => {
            if (!err && stat.isFile()) {
              return serveFile(req, res, targetFile, stat);
            }
            sendNotFound(req, res, pathname);
          });
        }
      }
    } catch (e) {
      console.error("Error in /_next/image:", e.message);
    }
  }

  // --- Enquiries CSV Export ---
  if (pathname === "/api/admin/enquiries/export" && (req.method === "GET" || req.method === "HEAD")) {
    const data = readSiteData();
    const enquiries = data.enquiries || [];
    let csv = "ID,Date,Name,Email,Phone,Intent,EventType,Guests,CityDate,Status,Notes,Message\n";
    for (const e of enquiries) {
      const clean = (val) => '"' + String(val || "").replace(/"/g, '""').replace(/[\r\n]+/g, " ") + '"';
      csv += [
        clean(e.id),
        clean((e.createdAt || "").slice(0, 10)),
        clean(e.name),
        clean(e.email),
        clean(e.phone),
        clean(e.intent),
        clean(e.eventType),
        clean(e.guests),
        clean(e.dateCity),
        clean(e.status),
        clean(e.notes || ""),
        clean(e.message)
      ].join(",") + "\n";
    }
    const csvBuffer = Buffer.from(csv, "utf-8");
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=shunya-enquiries-" + Date.now() + ".csv",
      "Content-Length": csvBuffer.length
    });
    if (req.method === "HEAD") return res.end();
    return res.end(csvBuffer);
  }

  // --- API Routes ---
  if (pathname === "/api/site-data" && (req.method === "GET" || req.method === "HEAD")) {
    const payload = JSON.stringify(readSiteData());
    const buf = Buffer.from(payload, "utf-8");
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
      "Content-Length": buf.length
    });
    if (req.method === "HEAD") return res.end();
    return res.end(buf);
  }

  function syncRemoteGalleryImages(data) {
    if (!data || !Array.isArray(data.gallery)) return;
    const galleryDir = path.join(ROOT, "uploads", "gallery");
    if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });

    data.gallery.forEach((item, index) => {
      const src = typeof item === "object" && item !== null ? item.src : item;
      if (typeof src === "string" && (src.startsWith("http://") || src.startsWith("https://"))) {
        const filename = `user_frame_${String(index + 1).padStart(2, "0")}_${Date.now()}.jpg`;
        const localFilePath = path.join(galleryDir, filename);
        const localUrl = `/uploads/gallery/${filename}`;

        const client = src.startsWith("https://") ? https : http;
        client.get(src, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const fileStream = fs.createWriteStream(localFilePath);
            res.pipe(fileStream);
            fileStream.on("finish", () => {
              try {
                const current = readSiteData();
                if (current && Array.isArray(current.gallery) && current.gallery[index]) {
                  if (typeof current.gallery[index] === "object") {
                    current.gallery[index].originalRemoteSrc = src;
                    current.gallery[index].src = localUrl;
                  } else {
                    current.gallery[index] = localUrl;
                  }
                  writeSiteData(current);
                  console.log(`[GALLERY AUTO-SYNC] Downloaded remote image to local ${localUrl}`);
                }
              } catch (e) {
                console.error("[GALLERY AUTO-SYNC ERROR]", e.message);
              }
            });
          }
        }).on("error", (e) => {
          console.warn("[GALLERY AUTO-SYNC FAIL]", e.message);
        });
      }
    });
  }

  if (pathname === "/api/site-data" && req.method === "POST") {
    return parseBody(req, (err, payload) => {
      if (err || !payload) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
      const existing = readSiteData();
      const updated = { ...existing, ...payload, updatedAt: new Date().toISOString() };
      writeSiteData(updated);
      syncRemoteGalleryImages(updated);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, data: updated }));
    });
  }

  if (pathname === "/api/enquiries" && (req.method === "GET" || req.method === "HEAD")) {
    const data = readSiteData();
    const payload = JSON.stringify(data.enquiries || []);
    const buf = Buffer.from(payload, "utf-8");
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": buf.length
    });
    if (req.method === "HEAD") return res.end();
    return res.end(buf);
  }

  if (pathname === "/api/enquiries" && req.method === "POST") {
    return parseBody(req, (err, payload) => {
      if (err || !payload) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid enquiry data" }));
      }
      // Honeypot spam check
      if (payload.shunya_hp || payload.hp) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, enquiry: { id: "ENQ-BLOCKED" } }));
      }
      const data = readSiteData();
      const enquiry = {
        id: "ENQ-" + Math.floor(100000 + Math.random() * 900000),
        createdAt: new Date().toISOString(),
        status: "New",
        ...payload
      };
      data.enquiries = [enquiry, ...(data.enquiries || [])];
      writeSiteData(data);
      console.log(`[ENQUIRY RECEIVED & DISPATCHED] ID: ${enquiry.id} | From: ${enquiry.name || "Guest"} <${enquiry.email}> | Sent to Admin: ${data.brand?.contactEmail || "admin@shunya.example"}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, enquiry }));
    });
  }

  // --- Contact Form API with Tabbed Email Routing & Spam Protection ---
  if (pathname === "/api/contact/send" && req.method === "POST") {
    return parseBody(req, (err, payload) => {
      if (err || !payload) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid contact submission" }));
      }
      // Honeypot spam protection
      if (payload.shunya_hp || payload.hp) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, enquiryId: "ENQ-FILTERED" }));
      }
      const data = readSiteData();
      const routeKey = payload.route || "general";
      const routing = (data.brand && data.brand.contactRouting) || {};
      const targetEmail = routing[routeKey] || data.brand?.contactEmail || "hello@shunya.example";

      const enquiry = {
        id: "ENQ-" + Math.floor(100000 + Math.random() * 900000),
        createdAt: new Date().toISOString(),
        route: routeKey,
        targetEmail: targetEmail,
        status: "New",
        ...payload
      };
      delete enquiry.shunya_hp;
      delete enquiry.hp;

      data.enquiries = [enquiry, ...(data.enquiries || [])];
      writeSiteData(data);

      console.log(`[EMAIL ROUTING DISPATCH] Route: ${routeKey} | Routed to: ${targetEmail} | Client: ${payload.name || "N/A"} (${payload.email || "N/A"}) | ID: ${enquiry.id}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, enquiryId: enquiry.id, targetEmail: targetEmail }));
    });
  }

  // --- Admin Password Authentication API ---
  if (pathname === "/api/admin/auth" && req.method === "POST") {
    return parseBody(req, (err, payload) => {
      if (err || !payload) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid request" }));
      }
      const data = readSiteData();
      const masterPassword = data.adminPassword || "shunya2026";
      if (payload.password === masterPassword) {
        const token = "shunya_token_" + Buffer.from(Date.now() + ":" + masterPassword).toString("base64");
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Set-Cookie": `shunya_admin_token=${token}; Path=/; HttpOnly; SameSite=Lax`
        });
        return res.end(JSON.stringify({ ok: true, token: token }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Incorrect password" }));
      }
    });
  }

  // --- Dynamic Sitemap XML Route ---
  if (pathname === "/sitemap.xml" && (req.method === "GET" || req.method === "HEAD")) {
    const data = readSiteData();
    const baseUrl = "https://www.shunya.example";
    const now = new Date().toISOString().split("T")[0];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/events", priority: "0.9", changefreq: "daily" },
      { loc: "/private-experiences", priority: "0.8", changefreq: "weekly" },
      { loc: "/about", priority: "0.8", changefreq: "monthly" },
      { loc: "/gallery", priority: "0.8", changefreq: "weekly" },
      { loc: "/contact", priority: "0.7", changefreq: "monthly" }
    ];
    for (const p of staticPages) {
      xml += `  <url>\n    <loc>${baseUrl}${p.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
    }
    const events = (data.events || []).filter(e => e.status === "published");
    for (const ev of events) {
      const slug = ev.slug || ev.id;
      xml += `  <url>\n    <loc>${baseUrl}/events/${slug}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>\n`;
    }
    xml += `</urlset>\n`;
    const xmlBuf = Buffer.from(xml, "utf-8");
    res.writeHead(200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Length": xmlBuf.length
    });
    if (req.method === "HEAD") return res.end();
    return res.end(xmlBuf);
  }

  // --- Dedicated Page Routes ---
  if (pathname === "/events" || pathname === "/events/") {
    const eventsFile = path.join(ROOT, "events.html");
    if (fs.existsSync(eventsFile)) {
      return fs.stat(eventsFile, (err, stat) => serveFile(req, res, eventsFile, stat));
    }
  }

  // Event Details Dynamic Route: /events/:slug and /event-detail
  if (pathname === "/event-detail" || pathname === "/event-detail/" || pathname === "/event-detail.html" || (pathname.startsWith("/events/") && pathname.length > 8)) {
    const detailFile = path.join(ROOT, "event-detail.html");
    if (fs.existsSync(detailFile)) {
      return fs.stat(detailFile, (err, stat) => serveFile(req, res, detailFile, stat));
    }
  }

  if (pathname === "/private-experiences" || pathname === "/private-experiences/") {
    const peFile = path.join(ROOT, "private-experiences.html");
    if (fs.existsSync(peFile)) {
      return fs.stat(peFile, (err, stat) => serveFile(req, res, peFile, stat));
    }
  }

  if (pathname === "/about" || pathname === "/about/") {
    const aboutFile = path.join(ROOT, "about.html");
    if (fs.existsSync(aboutFile)) {
      return fs.stat(aboutFile, (err, stat) => serveFile(req, res, aboutFile, stat));
    }
  }

  if (pathname === "/gallery" || pathname === "/gallery/") {
    const galleryFile = path.join(ROOT, "gallery.html");
    if (fs.existsSync(galleryFile)) {
      return fs.stat(galleryFile, (err, stat) => serveFile(req, res, galleryFile, stat));
    }
  }

  if (pathname === "/contact" || pathname === "/contact/") {
    const contactFile = path.join(ROOT, "contact.html");
    if (fs.existsSync(contactFile)) {
      return fs.stat(contactFile, (err, stat) => serveFile(req, res, contactFile, stat));
    }
  }

  if (pathname === "/api/upload" && req.method === "POST") {
    return parseBody(req, (err, payload) => {
      if (err || !payload || !payload.filename || !payload.base64) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Missing filename or base64" }));
      }
      try {
        const safeName = payload.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const outPath = path.join(ROOT, "uploads", safeName);
        const buffer = Buffer.from(payload.base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
        fs.writeFileSync(outPath, buffer);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, url: `/uploads/${safeName}` }));
      } catch (uploadErr) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: uploadErr.message }));
      }
    });
  }

  // --- /admin Route ---
  if (pathname === "/admin" || pathname === "/admin/") {
    const adminFile = path.join(ROOT, "admin.html");
    if (fs.existsSync(adminFile)) {
      return fs.stat(adminFile, (err, stat) => serveFile(req, res, adminFile, stat));
    }
  }

  // Only GET & HEAD for static files
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD, POST" });
    return res.end();
  }

  // File serving security
  const filePathRaw = path.join(ROOT, pathname);
  if (pathname.split("/").some((segment) => segment.startsWith(".")) ||
      (filePathRaw !== ROOT && !filePathRaw.startsWith(ROOT + path.sep))) {
    return sendNotFound(req, res, pathname);
  }

  fs.stat(filePathRaw, (err, stat) => {
    if (!err && stat.isDirectory()) {
      const indexFile = path.join(filePathRaw, "index.html");
      return fs.stat(indexFile, (indexErr, indexStat) =>
        indexErr ? sendNotFound(req, res, pathname) : serveFile(req, res, indexFile, indexStat));
    }
    if (err || !stat.isFile()) return sendNotFound(req, res, pathname);
    serveFile(req, res, filePathRaw, stat);
  });
});

function launchBrowser(url) {
  const command = process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(command, () => {});
}

function listen(port, attemptsLeft) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.log(`  Port ${port} is busy, trying ${port + 1}...`);
      return listen(port + 1, attemptsLeft - 1);
    }
    console.error(`  Could not start the server: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, host, () => {
    const url = `http://localhost:${port}`;
    console.log("");
    console.log("  =================================================");
    console.log("  SHOONYA Website & Studio Admin is running:");
    console.log(`    Website:  ${url}`);
    console.log(`    Admin:    ${url}/admin`);
    console.log("  =================================================");
    console.log("");
    console.log("  Press Ctrl+C to stop.");
    console.log("");
    if (openBrowser) launchBrowser(url);
  });
}

listen(requestedPort, 10);
