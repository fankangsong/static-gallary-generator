/* 临时验证脚本：用 headless Chrome + CDP 真实点击首页的定位链接，看是否新开标签页。
   用法：node .verify/check-loclink.mjs expect=popup|none        （跑完即删） */
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = 'd:/fankangsong/static-gallary-generator/web';
const PROFILE = path.join(process.cwd(), '.verify-profile');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8099;
const CDP = 9333;
const MODE = (process.argv.find((a) => a.startsWith('mode=')) || 'mode=click').split('=')[1];
const EXPECT = (process.argv.find((a) => a.startsWith('expect=')) || 'expect=popup').split('=')[1];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

mkdirSync(PROFILE, { recursive: true });
const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`,
  `http://127.0.0.1:${PORT}/index.html`
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = async () => {
  chrome.kill();
  server.close();
  await sleep(600);
  try { await rm(PROFILE, { recursive: true, force: true }); } catch {}
};

let ws;
try {
  let info;
  for (let i = 0; i < 40 && !info; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP}/json/version`);
      if (r.ok) info = await r.json();
    } catch {}
    if (!info) await sleep(250);
  }
  if (!info) throw new Error('CDP 未就绪');

  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const targetMap = new Map();          /* targetId → 最新 targetInfo */
  const errors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Target.targetCreated' && msg.params.targetInfo.type === 'page') {
      targetMap.set(msg.params.targetInfo.targetId, msg.params.targetInfo);
    }
    if (msg.method === 'Target.targetInfoChanged' && msg.params.targetInfo.type === 'page') {
      targetMap.set(msg.params.targetInfo.targetId, msg.params.targetInfo);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const msgId = ++id;
    pending.set(msgId, res);
    ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
  });

  await send('Target.setDiscoverTargets', { discover: true });
  await sleep(500);

  const page = [...targetMap.values()].find((t) => t.url.includes('127.0.0.1'));
  if (!page) throw new Error('未找到页面 target：' + JSON.stringify([...targetMap.values()].map((t) => t.url)));

  const attached = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const sessionId = attached.result.sessionId;
  await send('Runtime.enable', {}, sessionId);

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };

  /* 轮询等页面渲染完成（脚本在 body 末尾同步执行，但要等页面加载到那一步） */
  let diag = null;
  for (let i = 0; i < 40; i++) {
    diag = await evaluate(`({
      readyState: document.readyState,
      slides: document.querySelectorAll('.slide').length,
      links: document.querySelectorAll('.loc-link').length,
      bootHidden: document.getElementById('boot') ? document.getElementById('boot').hidden : null,
      dataLen: document.getElementById('tl-data') ? document.getElementById('tl-data').textContent.length : 0
    })`);
    if (diag && diag.links > 0) break;
    await sleep(250);
  }
  if (!diag || diag.links === 0) {
    console.log(JSON.stringify({ diag, errors }, null, 2));
    throw new Error('页面上没有找到 .loc-link');
  }

  const link = await evaluate(`(() => {
    const a = document.querySelector('.loc-link');
    a.scrollIntoView({ block: 'center' });
    const r = a.getBoundingClientRect();
    return { text: a.textContent.trim(), href: a.href, target: a.target,
             x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  await sleep(300);

  if (MODE === 'drag') {
    /* 回归：拖拽仍要能接管（指针捕获已推迟到拖拽真正开始时） */
    const start = await evaluate(`(() => { const r = document.getElementById('track').getBoundingClientRect(); return { x: r.left + 160, y: r.bottom - 24 }; })()`);
    const dragging = () => evaluate(`document.getElementById('track').classList.contains('dragging')`);
    const p = { x: start.x, y: start.y, button: 'left' };
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p, buttons: 0 }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, buttons: 1, clickCount: 1 }, sessionId);
    await sleep(50);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p, x: start.x + 80, buttons: 1 }, sessionId);
    await sleep(120);
    const during = await dragging();
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, x: start.x + 80, buttons: 0, clickCount: 1 }, sessionId);
    await sleep(250);
    const after = await dragging();
    const pass = during === true && after === false;
    console.log(JSON.stringify({ mode: MODE, start, draggingDuring: during, draggingAfter: after, pass, errors }, null, 2));
    ws.close();
    await cleanup();
    process.exit(pass ? 0 : 1);
  }

  const before = [...targetMap.keys()].length;
  const base = { x: link.x, y: link.y, button: 'left' };
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, buttons: 0 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, buttons: 1, clickCount: 1 }, sessionId);
  await sleep(60);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0, clickCount: 1 }, sessionId);
  await sleep(1800);

  const pages = [...targetMap.values()];
  const popup = pages.find((t) => t.targetId !== page.targetId);
  const ok = EXPECT === 'popup' ? !!popup : !popup;

  console.log(JSON.stringify({
    link, pageCountBefore: before, pageCountAfter: pages.length,
    popupUrl: popup ? popup.url : null, expect: EXPECT, pass: ok, errors
  }, null, 2));

  ws.close();
  await cleanup();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error('verify failed:', err.message);
  if (ws) ws.close();
  await cleanup();
  process.exit(2);
}
