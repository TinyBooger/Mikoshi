import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Static shell only. The HTML is identical for every visitor and does not
// depend on the API being up, so a cold or broken backend can never stop the
// frontend from starting.
const frontendDir = fileURLToPath(new URL('.', import.meta.url));
const distDir = resolve(frontendDir, 'dist');
const indexPath = resolve(distDir, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');

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
    response.end(request.method === 'HEAD' ? undefined : indexHtml);
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
  response.end(request.method === 'HEAD' ? undefined : indexHtml);
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
