import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const logFilePath = resolve('debug-logs/gimmick-debug.ndjson');

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolveBody(body));
    req.on('error', rejectBody);
  });
}

function gimmickDebugLogger() {
  return {
    name: 'wonder-land-gimmick-debug-logger',
    apply: 'serve',
    async configureServer(server) {
      await mkdir(dirname(logFilePath), { recursive: true });
      await appendFile(
        logFilePath,
        JSON.stringify({
          type: 'session-start',
          timestamp: new Date().toISOString()
        }) + '\n',
        'utf8'
      );

      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.originalUrl ?? req.url ?? '';
        if (!requestUrl.includes('__debug-log/gimmick')) {
          next();
          return;
        }

        if (req.method !== 'POST') {
          next();
          return;
        }

        try {
          const rawBody = await readRequestBody(req);
          const parsed = JSON.parse(rawBody);
          await appendFile(
            logFilePath,
            JSON.stringify({
              type: 'gimmick-frame',
              receivedAt: new Date().toISOString(),
              ...parsed
            }) + '\n',
            'utf8'
          );

          res.statusCode = 204;
          res.end();
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(error instanceof Error ? error.message : String(error));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [gimmickDebugLogger()],
  build: {
    rollupOptions: {
      input: {
        index: resolve('index.html'),
        game: resolve('game.html'),
        editor: resolve('editor.html')
      }
    }
  }
});
