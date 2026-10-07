// Servidor local SOLO para probar el asistente de IA sin depender de `vercel dev`.
// Sirve dist/ (hay que compilar antes con `npm run build`) y reutiliza la misma
// función del endpoint /api/dotacion-chat.js que se usa en producción.
// ponytail: esto no reemplaza el deploy real en Vercel, es solo para probar localmente.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/dotacion-chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = 5174;

// Carga .env.local a mano (sin dependencias nuevas)
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.csv': 'text/csv', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/dotacion-chat')) {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', async () => {
      req.body = (() => { try { return JSON.parse(body || '{}'); } catch { return {}; } })();
      const shim = {
        status(code) {
          res.statusCode = code;
          return { json: obj => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); } };
        },
      };
      await handler(req, shim);
    });
    return;
  }
  let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => console.log(`Listo: http://localhost:${PORT} (con el asistente de IA activo)`));
