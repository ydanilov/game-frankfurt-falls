// Shared test helpers: static server rooted at the repo, Chromium launch, error capture.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css' };
function serve(opts = {}) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/favicon.ico') { rsp.writeHead(204); return rsp.end(); }
      if (opts.block && opts.block.test(u)) { rsp.writeHead(404); return rsp.end(); }
      const f = path.join(ROOT, u === '/' ? 'tools/test.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      const send = () => { rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp); };
      opts.delay && /assets\//.test(u) ? setTimeout(send, opts.delay) : send();
    }).listen(0, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/tools/test.html` }));
  });
}
async function launch() {
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  return chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
}
function watch(page, errs, ignore404) {
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !(ignore404 && /Failed to load resource/.test(m.text())) && !/net::ERR_FAILED/.test(m.text()) && !/fonts\.g/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
}
async function open(browser, url, vp, o = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: !!o.touch, isMobile: !!o.touch, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  // block Google Fonts so tests stay offline and deterministic (fallback fonts are used)
  if (o.noFonts) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (o.init) await ctx.addInitScript(o.init);
  const page = await ctx.newPage(); const errs = []; watch(page, errs, o.ignore404);
  await page.goto(url, { waitUntil: 'commit' }); await page.waitForFunction(() => window.__ff, null, { timeout: 60000 });
  return { ctx, page, errs };
}
const shotDir = path.join(__dirname, 'shots'); fs.mkdirSync(shotDir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shotDir, name + '.png') });
let fails = 0, passes = 0;
function check(ok, msg) { if (ok) { passes++; console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function done(name) { console.log(`${name}: ${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0); }
const VP = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 }, phoneL: { width: 844, height: 390 }, tablet: { width: 768, height: 1024 } };
module.exports = { serve, launch, open, shot, check, done, VP, ROOT };
