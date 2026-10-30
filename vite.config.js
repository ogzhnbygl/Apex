import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Buffer } from 'buffer';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to handle Vercel serverless functions locally (matching spoke modules)
function vercelServerless() {
  return {
    name: 'vercel-serverless',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const apiPath = url.pathname.replace('/api/', '');
        let filePath = path.join(__dirname, 'api', apiPath + '.js');

        if (!fs.existsSync(filePath)) {
          filePath = path.join(__dirname, 'api', apiPath, 'index.js');
          if (!fs.existsSync(filePath)) {
            return next();
          }
        }

        try {
          let body = null;
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const data = Buffer.concat(buffers).toString();
            if (data) {
              try {
                body = JSON.parse(data);
              } catch {
                body = data;
              }
            }
          }

          const vReq = {
            method: req.method,
            headers: req.headers,
            query: Object.fromEntries(url.searchParams),
            body: body ?? {},
          };

          const vRes = {
            status: (code) => {
              res.statusCode = code;
              return vRes;
            },
            json: (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return vRes;
            },
            send: (data) => {
              res.end(data);
              return vRes;
            },
            setHeader: (name, value) => {
              res.setHeader(name, value);
              return vRes;
            },
            end: (data) => {
              res.end(data);
              return vRes;
            }
          };

          const importedModule = await import(filePath + '?t=' + Date.now());
          await importedModule.default(vReq, vRes);
        } catch (err) {
          console.error('API Error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), vercelServerless()],
});
