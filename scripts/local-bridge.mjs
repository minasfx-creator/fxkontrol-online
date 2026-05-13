import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const certDir = path.join(rootDir, '.certs', 'bridge');

const host = process.env.FXK_BRIDGE_HOST || '0.0.0.0';
const publicHost = process.env.FXK_BRIDGE_PUBLIC_HOST || getLanAddress() || 'localhost';
const securePort = Number(process.env.FXK_BRIDGE_HTTPS_PORT || 9443);
const insecurePort = Number(process.env.FXK_BRIDGE_HTTP_PORT || 9001);
const pwaUrl = process.env.FXK_PWA_URL || 'http://localhost:8080/pairing';
const key = process.env.FXK_BRIDGE_KEY || readOrCreateBridgeKey();

const pfxPath = process.env.FXK_BRIDGE_PFX || path.join(certDir, 'fxk-local-bridge.pfx');
const rootCerPath = process.env.FXK_BRIDGE_ROOT_CER || path.join(certDir, 'fxk-local-root.cer');
const passphrasePath = path.join(certDir, 'pfx-passphrase.txt');
const passphrase = process.env.FXK_BRIDGE_PFX_PASSPHRASE || readText(passphrasePath);
const realityScanPath = process.env.FXK_REALITYSCAN_EXE || 'C:\\Program Files\\Epic Games\\RealityScan_2.1\\RealityScan.exe';

if (!fs.existsSync(pfxPath)) {
  fail(`Missing bridge certificate: ${pfxPath}
Run: npm run bridge:cert:windows`);
}

const tlsOptions = {
  pfx: fs.readFileSync(pfxPath),
  passphrase,
};

const httpsServer = https.createServer(tlsOptions, routeHttps);
const wsServer = new WebSocketServer({ server: httpsServer, path: '/ws' });

wsServer.on('connection', (socket, request) => {
  if (!isAuthorized(request.headers['sec-websocket-protocol'])) {
    socket.close(1008, 'Bridge key required');
    return;
  }

  socket.on('message', (raw) => {
    const text = raw.toString();
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      socket.send(JSON.stringify({ type: 'ack', ok: true, raw: text, ts: Date.now() }));
      return;
    }

    if (message?.type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', ok: true, ts: Date.now(), bridge: 'fxk-local-bridge' }));
      return;
    }

    socket.send(JSON.stringify({
      type: 'ack',
      ok: true,
      receivedType: message?.type ?? 'unknown',
      ts: Date.now(),
    }));
  });
});

httpsServer.listen(securePort, host, () => {
  const origin = `https://${publicHost}:${securePort}`;
  const pairUrl = buildPairUrl();
  console.log(`FXK local bridge HTTPS/WSS listening on ${origin}`);
  console.log(`WebSocket endpoint: wss://${publicHost}:${securePort}/ws`);
  console.log(`Root certificate: ${origin}/fxk-local-root.cer`);
  console.log(`Pairing URL: ${pairUrl}`);
  console.log(`Bridge key: ${key}`);
});

const httpServer = http.createServer((request, response) => {
  const target = `https://${publicHost}:${securePort}${request.url || '/'}`;
  response.writeHead(307, { Location: target });
  response.end(`Redirecting to ${target}`);
});

httpServer.listen(insecurePort, host, () => {
  console.log(`HTTP compatibility redirect listening on http://${publicHost}:${insecurePort}`);
});

function routeHttps(request, response) {
  const url = new URL(request.url || '/', `https://${publicHost}:${securePort}`);
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === '/' || url.pathname === '/health') {
    sendJson(response, {
      ok: true,
      bridge: 'fxk-local-bridge',
      secure: true,
      websocket: `wss://${publicHost}:${securePort}/ws`,
      host: publicHost,
      securePort,
      insecurePort,
      paired: true,
    });
    return;
  }

  if (url.pathname === '/api/realityscan/status') {
    if (!isAuthorizedHttp(request)) {
      sendJson(response, { ok: false, error: 'Bridge key required' }, 401);
      return;
    }
    const version = getRealityScanVersion();
    sendJson(response, {
      ok: true,
      installed: fs.existsSync(realityScanPath),
      realityScanPath,
      realityScanVersion: version,
    });
    return;
  }

  if (url.pathname === '/api/realityscan/run' && request.method === 'POST') {
    if (!isAuthorizedHttp(request)) {
      sendJson(response, { ok: false, error: 'Bridge key required' }, 401);
      return;
    }
    handleRealityScanRun(request, response);
    return;
  }

  if (url.pathname === '/pairing-info') {
    sendJson(response, pairingPayload());
    return;
  }

  if (url.pathname === '/pair') {
    response.writeHead(302, { Location: buildPairUrl(url.searchParams.get('app') || pwaUrl) });
    response.end();
    return;
  }

  if (url.pathname === '/fxk-local-root.cer' && fs.existsSync(rootCerPath)) {
    response.writeHead(200, {
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="fxk-local-root.cer"',
    });
    fs.createReadStream(rootCerPath).pipe(response);
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
}

function pairingPayload() {
  return {
    bridgeKey: key,
    bridgeHost: publicHost,
    bridgeSecure: true,
    bridgeSecurePort: securePort,
    bridgePath: '/ws',
    websocket: `wss://${publicHost}:${securePort}/ws`,
  };
}

function buildPairUrl(app = pwaUrl) {
  const target = new URL(app);
  const payload = pairingPayload();
  target.searchParams.set('bridgeKey', payload.bridgeKey);
  target.searchParams.set('bridgeHost', payload.bridgeHost);
  target.searchParams.set('bridgeSecure', '1');
  target.searchParams.set('bridgeSecurePort', String(payload.bridgeSecurePort));
  target.searchParams.set('bridgePath', payload.bridgePath);
  return target.toString();
}

function isAuthorized(protocolHeader) {
  if (!key) return false;
  const protocols = String(protocolHeader || '').split(',').map((part) => part.trim());
  const expected = `fxk-key.${base64UrlEncode(key)}`;
  return protocols.includes('fxk-bridge.v1') && protocols.includes(expected);
}

function readOrCreateBridgeKey() {
  const keyPath = path.join(certDir, 'bridge-key.txt');
  const existing = readText(keyPath).trim();
  if (/^fxkb_[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing;

  fs.mkdirSync(certDir, { recursive: true });
  const bytes = cryptoRandomUrl(32);
  const next = `fxkb_${bytes}`;
  fs.writeFileSync(keyPath, `${next}\n`, { mode: 0o600 });
  return next;
}

function cryptoRandomUrl(byteLength) {
  return randomBytes(byteLength)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}

function handleRealityScanRun(request, response) {
  readJsonBody(request, 128 * 1024)
    .then(async (body) => {
      try {
        const config = normalizeRealityScanBody(body);
        const outputFolder = config.outputFolder;
        fs.mkdirSync(outputFolder, { recursive: true });

        if (!fs.existsSync(realityScanPath)) {
          sendJson(response, { ok: false, error: `RealityScan.exe not found at ${realityScanPath}` }, 404);
          return;
        }

        const imageCount = countImages(config.photosFolder);
        if (imageCount < 3) {
          sendJson(response, { ok: false, error: 'RealityScan requires at least 3 photos in the selected folder' }, 400);
          return;
        }

        const commandScript = typeof body.commandScript === 'string' && body.commandScript.trim()
          ? body.commandScript
          : buildRealityScanCommandScript(config);
        const commandPath = path.join(outputFolder, 'fxkontrol-realityscan.rscmd');
        const modelPath = path.join(outputFolder, 'fxkontrol-realityscan.obj');
        const projectPath = path.join(outputFolder, 'fxkontrol-realityscan.rsproj');

        fs.writeFileSync(commandPath, commandScript, 'utf8');
        const startedAt = Date.now();
        const execution = await runRealityScan(commandPath);

        if (!fs.existsSync(modelPath)) {
          sendJson(response, {
            ok: false,
            error: 'RealityScan finished but did not create the expected OBJ export',
            commandPath,
            logs: execution.logs,
            warnings: execution.warnings,
          }, 500);
          return;
        }

        const modelText = fs.readFileSync(modelPath, 'utf8');
        sendJson(response, {
          ok: true,
          modelPath,
          projectPath,
          commandPath,
          modelName: path.basename(modelPath),
          modelText,
          realityScanVersion: getRealityScanVersion(),
          logs: [
            `Photos: ${imageCount}`,
            `Runtime: ${Math.round((Date.now() - startedAt) / 1000)}s`,
            ...execution.logs,
          ],
          warnings: execution.warnings,
        });
      } catch (error) {
        sendJson(response, { ok: false, error: error?.message || 'RealityScan job failed' }, 500);
      }
    })
    .catch((error) => {
      sendJson(response, { ok: false, error: error?.message || 'Invalid request body' }, 400);
    });
}

function normalizeRealityScanBody(body) {
  const photosFolder = normalizeFolder(body.photosFolder, 'photosFolder');
  const outputFolder = normalizeFolder(body.outputFolder, 'outputFolder');
  if (!fs.existsSync(photosFolder) || !fs.statSync(photosFolder).isDirectory()) {
    throw new Error(`Photo folder does not exist: ${photosFolder}`);
  }
  return {
    photosFolder,
    outputFolder,
    simplifyTarget: Number.isInteger(body.simplifyTarget) ? body.simplifyTarget : undefined,
    textureMode: typeof body.textureMode === 'string' ? body.textureMode : 'vertex-color',
  };
}

function normalizeFolder(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return path.resolve(value.trim());
}

function buildRealityScanCommandScript(config) {
  const modelPath = path.join(config.outputFolder, 'fxkontrol-realityscan.obj');
  const projectPath = path.join(config.outputFolder, 'fxkontrol-realityscan.rsproj');
  const commands = [
    '-newScene',
    `-addFolder "${config.photosFolder}"`,
    '-align',
    '-selectMaximalComponent',
    '-setReconstructionRegionAuto',
    '-calculateNormalModel',
  ];
  if (config.simplifyTarget) commands.push(`-simplify ${config.simplifyTarget}`);
  if (config.textureMode === 'texture') commands.push('-unwrap', '-calculateTexture');
  else if (config.textureMode === 'vertex-color') commands.push('-calculateVertexColors');
  commands.push(`-exportModel "${modelPath}"`, `-save "${projectPath}"`, '-quit');
  return `${commands.join('\n')}\n`;
}

function runRealityScan(commandPath) {
  return new Promise((resolve) => {
    execFile(realityScanPath, ['-headless', '-execRSCMD', commandPath], {
      windowsHide: true,
      timeout: Number(process.env.FXK_REALITYSCAN_TIMEOUT_MS || 45 * 60 * 1000),
      maxBuffer: 16 * 1024 * 1024,
    }, (error, stdout = '', stderr = '') => {
      const logs = [stdout, stderr].filter(Boolean).join('\n').split(/\r?\n/).filter(Boolean).slice(-200);
      const warnings = [];
      if (error) warnings.push(error.message);
      resolve({ logs, warnings });
    });
  });
}

function getRealityScanVersion() {
  if (!fs.existsSync(realityScanPath)) return null;
  try {
    const stat = fs.statSync(realityScanPath);
    return `RealityScan_2.1 (${stat.mtime.toISOString().slice(0, 10)})`;
  } catch {
    return 'RealityScan_2.1';
  }
}

function countImages(folder) {
  const exts = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.heif', '.heic']);
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter(entry => entry.isFile() && exts.has(path.extname(entry.name).toLowerCase()))
    .length;
}

function readJsonBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

function isAuthorizedHttp(request) {
  return request.headers['x-fxk-bridge-key'] === key;
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-FXK-Bridge-Key');
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body, null, 2));
}

function getLanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
