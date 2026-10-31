const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'famdt.com', 'www.famdt.com');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
};

function getMimeType(filePath) {
  // Check if file has an extension before an '@' or at the very end
  const cleanExt = path.extname(filePath.split('@')[0]).toLowerCase();
  const fullExt = path.extname(filePath).toLowerCase();
  
  if (MIME_TYPES[fullExt]) return MIME_TYPES[fullExt];
  if (MIME_TYPES[cleanExt]) return MIME_TYPES[cleanExt];
  
  // Specific patterns common in mirrored sites
  if (filePath.endsWith('.css') || filePath.includes('.css@')) return MIME_TYPES['.css'];
  if (filePath.endsWith('.js') || filePath.includes('.js@')) return MIME_TYPES['.js'];
  if (filePath.endsWith('.html') || filePath.includes('.html@')) return MIME_TYPES['.html'];
  
  return 'application/octet-stream';
}

function resolveFile(rawUrl) {
  let urlObj;
  try {
    urlObj = new URL(rawUrl, `http://localhost:${PORT}`);
  } catch (e) {
    return null;
  }

  let pathname = decodeURIComponent(urlObj.pathname);
  const search = urlObj.search ? urlObj.search.slice(1) : ''; // e.g. "p=11" or "ver=1.19.1"

  // Prevent path traversal
  const safeRelPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const basePath = path.join(PUBLIC_DIR, safeRelPath);

  const candidates = [];

  // 1. Direct match with search as @ if search exists
  if (search) {
    // e.g. /?p=11 -> index.html@p=11.html
    if (pathname === '/' || pathname === '/index.html') {
      candidates.push(path.join(PUBLIC_DIR, `index.html@${search}.html`));
      candidates.push(path.join(PUBLIC_DIR, `index.html@${search}`));
    }
    // e.g. /path/to/style.css?ver=123 -> style.css@ver=123.css or style.css@ver=123
    const ext = path.extname(basePath);
    if (ext) {
      candidates.push(`${basePath}@${search}${ext}`);
      candidates.push(`${basePath}@${search}`);
    } else {
      candidates.push(`${basePath}@${search}.html`);
      candidates.push(`${basePath}@${search}`);
    }
  }

  // 2. Direct exact path as-is (e.g. if the link already includes index.html@p=76.html)
  candidates.push(basePath);

  // 3. If it is a directory or path ends in slash
  if (pathname.endsWith('/') || !path.extname(pathname)) {
    candidates.push(path.join(basePath, 'index.html'));
  }

  // 4. Try adding .html
  if (!path.extname(basePath)) {
    candidates.push(`${basePath}.html`);
  }

  // 5. If query existed but no @ file, try the base file without query
  if (search) {
    candidates.push(basePath);
  }

  const expandedCandidates = [];
  for (const c of candidates) {
    expandedCandidates.push(c);
    if (c.includes('LMELB')) {
      expandedCandidates.push(c.replace(/LMELB/g, 'FAMDT'));
    }
    if (c.includes('FAMDT')) {
      expandedCandidates.push(c.replace(/FAMDT/g, 'LMELB'));
    }
  }

  for (const candidate of expandedCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          return candidate;
        } else if (stat.isDirectory()) {
          const indexFile = path.join(candidate, 'index.html');
          if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
            return indexFile;
          }
        }
      }
    } catch (e) {
      // Ignore filesystem permission or format errors
    }
  }

  return null;
}

const server = http.createServer((req, res) => {
  // Handle CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const resolved = resolveFile(req.url);

  if (!resolved) {
    console.warn(`[404] Not Found: ${req.url}`);
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><body><h1>404 Not Found</h1><p>The requested URL was not found on this server: <code>${req.url}</code></p><p><a href="/">Retour à l'accueil</a></p></body></html>`);
    return;
  }

  const mimeType = getMimeType(resolved);
  fs.readFile(resolved, (err, data) => {
    if (err) {
      console.error(`[500] Error reading ${resolved}:`, err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Internal Server Error: ${err.message}`);
      return;
    }

    // For HTML files, inject a CSS snippet to remove any residual top-bar spacing
    let finalData = data;
    if (mimeType.startsWith('text/html')) {
      const topbarKill = `<style id="topbar-override">#top-bar-wrap,#top-bar{display:none!important;height:0!important;margin:0!important;padding:0!important;}body.has-topbar{padding-top:0!important;}.top-announcement-banner{background:#252650;background:linear-gradient(90deg,#191b30 0%,#252650 50%,#191b30 100%);color:#fff;padding:10px 15px;text-align:center;border-bottom:2px solid #77c7ca;box-shadow:0 2px 10px rgba(0,0,0,0.15);position:relative;z-index:999;font-family:'Barlow',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.top-announcement-banner .top-banner-inner{display:flex;align-items:center;justify-content:center;gap:12px;margin:0 auto}.top-announcement-banner .top-banner-text{font-size:14px;font-weight:700;letter-spacing:1.5px;color:#fff;text-transform:uppercase}.top-announcement-banner .top-banner-code{font-size:12px;font-weight:700;letter-spacing:1px;color:#77c7ca;background:rgba(119,199,202,0.18);border:1px solid rgba(119,199,202,0.45);padding:2px 10px;border-radius:4px;display:inline-block}@media (max-width:768px){.top-announcement-banner{padding:8px 10px}.top-announcement-banner .top-banner-text{font-size:11px;letter-spacing:1px}.top-announcement-banner .top-banner-code{font-size:10px;padding:1px 6px}}</style>`;
      let html = data.toString('utf8');
      html = html.replace('</head>', topbarKill + '</head>');
      // Remove has-topbar from body class to avoid OceanWP top padding
      html = html.replace(/has-topbar\s?/g, '');
      finalData = Buffer.from(html, 'utf8');
    }

    console.log(`[200] ${req.url} -> ${path.relative(PUBLIC_DIR, resolved)} (${mimeType})`);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': finalData.length
    });
    res.end(finalData);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`FAMDT Website Server is running!`);
  console.log(`Local URL: http://localhost:${PORT}`);
  console.log(`Serving files from: ${PUBLIC_DIR}`);
  console.log(`====================================================`);
});
