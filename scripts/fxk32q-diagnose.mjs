#!/usr/bin/env node
/**
 * ─── FXK32Q CLI Diagnostic ────────────────────────────────────────
 *
 * Envia a sequência canônica de handshake + comandos operacionais
 * (VERSION → STATUS → ARM → FIRE:<ch>:<ms> → BATCH:<mask>:<ms> →
 *  STATUS → DISARM) por CADA transporte e imprime a resposta crua.
 *
 *   node scripts/fxk32q-diagnose.mjs --transport=usb     --port=/dev/ttyACM0
 *   node scripts/fxk32q-diagnose.mjs --transport=rs485   --port=/dev/ttyUSB0 --addr=1
 *   node scripts/fxk32q-diagnose.mjs --transport=wifi    --host=192.168.4.1 --tcp=23
 *   node scripts/fxk32q-diagnose.mjs --transport=ws      --url=ws://192.168.4.1:81
 *   node scripts/fxk32q-diagnose.mjs --transport=artnet  --host=192.168.4.1 --universe=0 --start=1
 *   node scripts/fxk32q-diagnose.mjs --transport=ble     # requer @abandonware/noble (opcional)
 *   node scripts/fxk32q-diagnose.mjs --transport=all     ...
 *
 * Flags comuns:
 *   --channel=<1..32>   canal de teste (default 1)
 *   --duration=<ms>     pulso (default 100)
 *   --mask=<hex|dec>    máscara 32-bit p/ BATCH (default 0x3 = ch1+ch2)
 *   --no-fire           pula FIRE/BATCH; só faz handshake
 *
 * Não é safety-critical: este script é para BANCADA / DIAGNÓSTICO.
 * O firmware FXK32Q v1.1+ tem ARM gate próprio; sem ARM o FIRE retorna
 * `ERR:NOT_ARMED`. NUNCA use isso em show real — use o app.
 */

import { argv, exit, stdout } from 'node:process';
import dgram from 'node:dgram';
import net from 'node:net';

// ── arg parser minimalista ───────────────────────────────────────
const args = Object.fromEntries(
  argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.length ? rest.join('=') : 'true'];
    }),
);

const TRANSPORT = (args.transport ?? 'usb').toLowerCase();
const CHANNEL   = Number(args.channel ?? 1);
const DURATION  = Number(args.duration ?? 100);
const MASK      = args.mask ? Number(args.mask) : 0x3;
const NO_FIRE   = args['no-fire'] === 'true';

const COMMANDS_BASE   = ['VERSION', 'STATUS', 'ARM'];
const COMMANDS_FIRE   = NO_FIRE
  ? []
  : [`FIRE:${CHANNEL}:${DURATION}`, `BATCH:${MASK}:${DURATION}`];
const COMMANDS_TAIL   = ['STATUS', 'DISARM'];
const COMMANDS_ASCII  = [...COMMANDS_BASE, ...COMMANDS_FIRE, ...COMMANDS_TAIL];

const HR = '─'.repeat(64);
const log     = (...a) => stdout.write(a.join(' ') + '\n');
const section = (title) => log(`\n${HR}\n  ${title}\n${HR}`);
const tx      = (cmd) => log(`  TX › ${cmd}`);
const rx      = (line) => log(`  RX ‹ ${line}`);
const warn    = (msg) => log(`  ! ${msg}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────
// Helper: roda uma sequência ASCII contra um par (write, onLine)
// ─────────────────────────────────────────────────────────────────
async function runAsciiSequence({ write, awaitLine, perCmdTimeoutMs = 800 }) {
  for (const cmd of COMMANDS_ASCII) {
    tx(cmd);
    await write(cmd + '\n');
    const reply = await awaitLine(perCmdTimeoutMs).catch(() => null);
    if (reply == null) warn('timeout (sem resposta)');
    else                rx(reply);
    await sleep(60);
  }
}

// ─────────────────────────────────────────────────────────────────
// SerialPort lazy loader (USB-CDC e RS-485 usam o mesmo driver)
// ─────────────────────────────────────────────────────────────────
async function openSerial(port, baud) {
  let SerialPort;
  try {
    ({ SerialPort } = await import('serialport'));
  } catch {
    throw new Error(
      'Pacote `serialport` não instalado. Rode `npm i -D serialport` antes do USB/RS-485.',
    );
  }
  const sp = new SerialPort({ path: port, baudRate: baud, autoOpen: false });
  await new Promise((res, rej) => sp.open((err) => (err ? rej(err) : res())));

  let buf = '';
  const queue = [];
  const waiters = [];
  sp.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, '');
      buf = buf.slice(nl + 1);
      if (waiters.length) waiters.shift()(line);
      else                queue.push(line);
    }
  });

  return {
    write: (s) => new Promise((res, rej) => sp.write(s, (e) => (e ? rej(e) : res()))),
    awaitLine: (timeoutMs) => new Promise((res, rej) => {
      if (queue.length) return res(queue.shift());
      const t = setTimeout(() => {
        const i = waiters.indexOf(resolver);
        if (i >= 0) waiters.splice(i, 1);
        rej(new Error('timeout'));
      }, timeoutMs);
      const resolver = (line) => { clearTimeout(t); res(line); };
      waiters.push(resolver);
    }),
    close: () => new Promise((res) => sp.close(() => res())),
  };
}

// ─────────────────────────────────────────────────────────────────
// USB-CDC (115200 8N1)
// ─────────────────────────────────────────────────────────────────
async function diagnoseUSB() {
  section(`USB-CDC › ${args.port ?? '(missing --port)'}`);
  if (!args.port) { warn('faltou --port=/dev/ttyACM0'); return; }
  const link = await openSerial(args.port, Number(args.baud ?? 115200));
  try { await runAsciiSequence(link); }
  finally { await link.close(); }
}

// ─────────────────────────────────────────────────────────────────
// RS-485 — XLII+ frame binário; aqui usamos o mesmo ASCII parser
// que o firmware expõe via UART2 quando NÃO endereçado, mas o modo
// nativo é binário. Imprimimos os bytes crus e decodificamos
// ACK/NAK. (Frame: STX ADDR CMD ... CKSUM ETX)
// ─────────────────────────────────────────────────────────────────
async function diagnoseRS485() {
  section(`RS-485 XLII+ › ${args.port ?? '(missing --port)'} addr=${args.addr ?? 1}`);
  if (!args.port) { warn('faltou --port=/dev/ttyUSB0'); return; }

  let SerialPort;
  try { ({ SerialPort } = await import('serialport')); }
  catch { warn('npm i -D serialport'); return; }

  const sp = new SerialPort({ path: args.port, baudRate: 9600, autoOpen: false });
  await new Promise((res, rej) => sp.open((e) => (e ? rej(e) : res())));

  const ADDR = Number(args.addr ?? 1) & 0xFF;
  const STX = 0x02, ETX = 0x03;
  const CMD = { ARM: 0x41, DISARM: 0x44, FIRE: 0x46, ESTOP: 0x58, STATUS: 0x53,
                CONT: 0x43, HEARTBEAT: 0x48, IDENTIFY: 0x49, RESET: 0x52 };

  const xor = (bytes) => bytes.reduce((s, b) => s ^ b, 0);
  const send = (cmd, payload = []) => new Promise((res, rej) => {
    const inner = [ADDR, cmd, ...payload];
    const frame = Buffer.from([STX, ...inner, xor(inner), ETX]);
    tx(`[${cmd.toString(16).padStart(2,'0')}] ${frame.toString('hex')}`);
    sp.write(frame, (e) => (e ? rej(e) : res()));
  });

  let acc = Buffer.alloc(0);
  sp.on('data', (chunk) => {
    acc = Buffer.concat([acc, chunk]);
    let i;
    while ((i = acc.indexOf(ETX)) >= 0) {
      const frame = acc.slice(0, i + 1);
      acc = acc.slice(i + 1);
      rx(frame.toString('hex'));
    }
  });

  const seq = [
    [CMD.IDENTIFY], [CMD.STATUS], [CMD.ARM],
    ...(NO_FIRE ? [] : [[CMD.FIRE, [CHANNEL & 0xFF, (DURATION >> 8) & 0xFF, DURATION & 0xFF]]]),
    [CMD.STATUS], [CMD.DISARM],
  ];
  for (const [cmd, payload] of seq) { await send(cmd, payload); await sleep(150); }
  await sleep(300);
  await new Promise((res) => sp.close(() => res()));
}

// ─────────────────────────────────────────────────────────────────
// Wi-Fi — TCP raw (default porta 23)
// ─────────────────────────────────────────────────────────────────
async function diagnoseWiFiTCP() {
  section(`Wi-Fi TCP › ${args.host}:${args.tcp ?? 23}`);
  if (!args.host) { warn('faltou --host=192.168.4.1'); return; }
  const sock = net.createConnection({ host: args.host, port: Number(args.tcp ?? 23) });
  await new Promise((res, rej) => { sock.once('connect', res); sock.once('error', rej); });

  let buf = '';
  const queue = [], waiters = [];
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, '');
      buf = buf.slice(nl + 1);
      if (waiters.length) waiters.shift()(line); else queue.push(line);
    }
  });

  await runAsciiSequence({
    write: (s) => new Promise((res) => sock.write(s, () => res())),
    awaitLine: (timeoutMs) => new Promise((res, rej) => {
      if (queue.length) return res(queue.shift());
      const t = setTimeout(() => rej(new Error('timeout')), timeoutMs);
      waiters.push((line) => { clearTimeout(t); res(line); });
    }),
  });
  sock.end();
}

// ─────────────────────────────────────────────────────────────────
// WebSocket (firmware exposto via porta 81)
// ─────────────────────────────────────────────────────────────────
async function diagnoseWebSocket() {
  section(`WebSocket › ${args.url ?? '(missing --url)'}`);
  if (!args.url) { warn('faltou --url=ws://192.168.4.1:81'); return; }
  let WebSocket;
  try { ({ WebSocket } = await import('ws')); }
  catch { warn('npm i -D ws'); return; }

  const ws = new WebSocket(args.url);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

  const queue = [], waiters = [];
  ws.on('message', (data) => {
    const line = data.toString('utf8').replace(/\r?\n$/, '');
    if (waiters.length) waiters.shift()(line); else queue.push(line);
  });

  await runAsciiSequence({
    write: (s) => new Promise((res) => ws.send(s, () => res())),
    awaitLine: (timeoutMs) => new Promise((res, rej) => {
      if (queue.length) return res(queue.shift());
      const t = setTimeout(() => rej(new Error('timeout')), timeoutMs);
      waiters.push((line) => { clearTimeout(t); res(line); });
    }),
  });
  ws.close();
}

// ─────────────────────────────────────────────────────────────────
// Art-Net — UDP unidirecional. Não há resposta ASCII; emitimos um
// ArtDmx que aciona o canal alvo e logamos o pacote enviado.
// ─────────────────────────────────────────────────────────────────
async function diagnoseArtNet() {
  section(`Art-Net UDP › ${args.host}:6454 univ=${args.universe ?? 0} start=${args.start ?? 1}`);
  if (!args.host) { warn('faltou --host=192.168.4.1'); return; }
  const universe = Number(args.universe ?? 0);
  const startCh  = Number(args.start ?? 1);

  const HEADER = Buffer.from('Art-Net\0', 'ascii'); // 8 bytes
  const OP_DMX = 0x5000;
  const dmx = Buffer.alloc(512, 0);
  // Canal alvo full
  if (CHANNEL >= 1 && CHANNEL <= 32) dmx[startCh - 1 + (CHANNEL - 1)] = 255;

  const len = dmx.length;
  const pkt = Buffer.concat([
    HEADER,
    Buffer.from([OP_DMX & 0xFF, (OP_DMX >> 8) & 0xFF]), // OpCode LE
    Buffer.from([0x00, 0x0E]),                          // Protocol v14 BE
    Buffer.from([0x00, 0x00]),                          // Sequence + Physical
    Buffer.from([universe & 0xFF, (universe >> 8) & 0xFF]), // SubUni + Net
    Buffer.from([(len >> 8) & 0xFF, len & 0xFF]),       // Length BE
    dmx,
  ]);

  const sock = dgram.createSocket('udp4');
  await new Promise((res) => sock.bind(0, res));
  tx(`ArtDmx ch=${CHANNEL}@255 (${pkt.length} bytes)`);
  await new Promise((res, rej) => sock.send(pkt, 0, pkt.length, 6454, args.host, (e) => e ? rej(e) : res()));
  await sleep(DURATION + 50);
  // Zera o canal (release)
  dmx[startCh - 1 + (CHANNEL - 1)] = 0;
  pkt.fill(0, pkt.length - 512); dmx.copy(pkt, pkt.length - 512);
  tx(`ArtDmx ch=${CHANNEL}@0 (release)`);
  await new Promise((res, rej) => sock.send(pkt, 0, pkt.length, 6454, args.host, (e) => e ? rej(e) : res()));
  sock.close();
  warn('Art-Net é unidirecional — sem reply ASCII (use --transport=usb p/ STATUS).');
}

// ─────────────────────────────────────────────────────────────────
// BLE — opcional via @abandonware/noble (não obrigatório no CI).
// ─────────────────────────────────────────────────────────────────
async function diagnoseBLE() {
  section('BLE › (requer @abandonware/noble)');
  let noble;
  try { noble = (await import('@abandonware/noble')).default; }
  catch { warn('npm i -D @abandonware/noble  (Linux: requer libcap)'); return; }

  await new Promise((res) => {
    if (noble.state === 'poweredOn') return res();
    noble.once('stateChange', (s) => s === 'poweredOn' && res());
  });

  warn('Scaneando 5s por dispositivo "FXK32Q"...');
  const targetName = (args.name ?? 'FXK32Q').toUpperCase();
  let peripheral = null;
  noble.on('discover', (p) => {
    const adv = (p.advertisement?.localName ?? '').toUpperCase();
    if (adv.includes(targetName) && !peripheral) peripheral = p;
  });
  await noble.startScanningAsync([], false);
  await sleep(5000);
  await noble.stopScanningAsync();
  if (!peripheral) { warn('FXK32Q BLE não encontrado.'); return; }

  log(`  ✓ encontrado ${peripheral.address} ${peripheral.advertisement.localName}`);
  await peripheral.connectAsync();
  const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
    ['ffe0'], ['ffe1'],
  );
  const ch = characteristics[0];
  if (!ch) { warn('characteristic ffe1 ausente'); return; }

  const queue = [], waiters = [];
  await ch.subscribeAsync();
  ch.on('data', (data) => {
    const line = data.toString('utf8').replace(/\r?\n$/, '');
    if (waiters.length) waiters.shift()(line); else queue.push(line);
  });

  await runAsciiSequence({
    write: (s) => ch.writeAsync(Buffer.from(s, 'utf8'), false),
    awaitLine: (timeoutMs) => new Promise((res, rej) => {
      if (queue.length) return res(queue.shift());
      const t = setTimeout(() => rej(new Error('timeout')), timeoutMs);
      waiters.push((line) => { clearTimeout(t); res(line); });
    }),
  });
  await peripheral.disconnectAsync();
}

// ─────────────────────────────────────────────────────────────────
const RUNNERS = {
  usb: diagnoseUSB,
  ble: diagnoseBLE,
  wifi: diagnoseWiFiTCP,
  ws: diagnoseWebSocket,
  artnet: diagnoseArtNet,
  rs485: diagnoseRS485,
};

async function main() {
  log(`\nFXK32Q Diagnostic — transport=${TRANSPORT}  ch=${CHANNEL}  dur=${DURATION}ms  mask=0x${MASK.toString(16)}`);
  const transports = TRANSPORT === 'all' ? Object.keys(RUNNERS) : [TRANSPORT];
  for (const t of transports) {
    const fn = RUNNERS[t];
    if (!fn) { warn(`transport desconhecido: ${t}`); continue; }
    try { await fn(); }
    catch (err) { warn(`falha em ${t}: ${err?.message ?? err}`); }
  }
  log('\n✓ done.\n');
}

main().catch((e) => { console.error(e); exit(1); });
