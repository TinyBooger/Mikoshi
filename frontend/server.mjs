import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLandingPage } from './dist/server/entry-server.mjs';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(frontendDir, 'dist');
const indexPath = resolve(distDir, 'index.html');
const indexTemplate = await readFile(indexPath, 'utf8');
const apiBaseUrl = process.env.PRERENDER_API_BASE_URL || 'http://localhost:8000';
const response = await fetch(
  `${apiBaseUrl.replace(/\/$/, '')}/api/characters/popular?short=false&page=1&page_size=20`,
  { signal: AbortSignal.timeout(15000) }
);

if (!response.ok) {
  throw new Error(`Landing-page data request failed with HTTP ${response.status}`);
}

const popularCharacters = await response.json();
if (!popularCharacters || !Array.isArray(popularCharacters.items)) {
  throw new Error('Landing-page data request returned an invalid character list');
}
if (
  !Number.isFinite(popularCharacters.total) ||
  !Number.isFinite(popularCharacters.page_size)
) {
  throw new Error('Landing-page data response is missing pagination metadata');
}

const initialBrowseData = {
  items: popularCharacters.items,
  total: popularCharacters.total,
  page: popularCharacters.page,
  page_size: popularCharacters.page_size,
  short: popularCharacters.short,
};
const serializedData = JSON.stringify(initialBrowseData)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
const renderedRoot = renderLandingPage(initialBrowseData);
if (!indexTemplate.includes('<div id="root"></div>')) {
  throw new Error('Built HTML does not contain the expected React root');
}
const renderedTemplate = indexTemplate.replace(
  '<div id="root"></div>',
  `<div id="root">${renderedRoot}</div>`
);
if (renderedTemplate === indexTemplate) {
  throw new Error('Could not insert the pre-rendered landing page into the built HTML');
}
const landingPage = renderedTemplate.replace(
  '</head>',
  `<script id="prerender-data" type="application/json">${serializedData}</script>\n</head>`
);

const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

async function handleRequest(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid request path');
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html; charset=utf-8',
    });
    response.end(request.method === 'HEAD' ? undefined : landingPage);
    return;
  }

  if (pathname === '/server' || pathname.startsWith('/server/')) {
    response.writeHead(404).end();
    return;
  }

  const filePath = resolve(distDir, `.${pathname}`);
  const relativePath = relative(distDir, filePath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..') {
    response.writeHead(400).end('Invalid request path');
    return;
  }

  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }

  if (fileInfo?.isFile()) {
    response.writeHead(200, {
      'Cache-Control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
      'Content-Length': fileInfo.size,
      'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const assetStream = createReadStream(filePath);
    assetStream.on('error', (error) => {
      console.error('Frontend asset read failed:', error);
      response.destroy(error);
    });
    assetStream.pipe(response);
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/html; charset=utf-8',
  });
  response.end(request.method === 'HEAD' ? undefined : indexTemplate);
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    console.error('Frontend request failed:', error);
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    response.end('Internal server error');
  });
});

server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log(`Frontend listening on port ${process.env.PORT || 3000}`);
});

server.on('error', (error) => {
  console.error('Frontend server failed:', error);
  process.exitCode = 1;
});
