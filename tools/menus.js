// menus: title -> story (4 panels) -> shop (tabs, denied buy, buy+equip, all owned) -> start -> pause -> resume -> end. Screenshots at desktop + phone, focus-ring checks.
const { serve, launch, open, shot, check, done, VP } = require('./lib');
const settle = p => p.waitForTimeout(450);
async function focusRing(page, label) {
  await page.waitForTimeout(250); // let the .12s box-shadow transition finish
  const st = await page.evaluate(() => { const a = document.activeElement; if (!a || a.tagName !== 'BUTTON') return null; const cs = getComputedStyle(a); return { id: a.id || a.className, outline: cs.outlineStyle, ow: parseFloat(cs.outlineWidth), shadow: cs.boxShadow }; });
  check(st && st.outline !== 'none' && st.ow >= 2 && /255, 194, 26/.test(st.shadow), `${label}: visible focus ring on ${st && st.id}`);
}
async function flow(b, url, vp, tag) {
  console.log(`-- ${tag} ${vp.width}x${vp.height}`);
  const { page, errs, ctx } = await open(b, url, vp, { touch: tag !== 'desktop' });
  await page.waitForFunction(() => window.__ff.ART.title !== 'loading' && window.__ff.lettersSettled(), null, { timeout: 60000 });
  await settle(page); await shot(page, `menu_${tag}_01_title`);
  // keyboard nav on title: arrows reach every button
  await page.keyboard.press('ArrowRight'); await settle(page);
  await focusRing(page, 'title');
  const reached = new Set();
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) { await page.keyboard.press(k); reached.add(await page.evaluate(() => document.activeElement.id)); }
  check(['bstart', 'bshop', 'bstory'].every(id => reached.has(id)), 'arrow keys reach Start / Shop / Story: ' + [...reached]);
  if (tag === 'desktop') await shot(page, `menu_${tag}_02_title_focus`);
  // story
  await page.evaluate(() => document.getElementById('bstory').focus()); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__ff.S.state === 'comic'); await page.waitForTimeout(1900);
  for (let i = 1; i <= 4; i++) {
    const info = await page.evaluate(() => ({ n: document.getElementById('cnum').textContent, cap: document.getElementById('ccap').textContent, art: document.querySelector('.cimg.cur') && document.querySelector('.cimg.cur').id, bubs: [...document.querySelectorAll('#cbubs .bub.show')].length, mode: window.__ff.drawMode() }));
    check(info.n === i + '/4' && info.art === 'ci-comic' + i && info.bubs >= 1 && info.mode === 'none', `panel ${i}: art ${info.art}, ${info.bubs} bubble(s), "${info.cap.slice(0, 40)}…"`);
    await shot(page, `menu_${tag}_03_comic${i}`);
    if (i < 4) { if (tag === 'desktop') await page.keyboard.press('Space'); else await page.tap('#cframe', { force: true }).catch(() => page.click('#comic', { position: { x: 20, y: vp.height / 2 } })); await page.waitForTimeout(1900); }
  }
  check(await page.evaluate(() => document.getElementById('cnext').textContent) === 'Play!', 'last panel button says Play!');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__ff.S.state === 'title'); await settle(page);
  check(true, 'Esc skips the story back to title');
  // shop with 0 coins
  await page.evaluate(() => { const f = window.__ff; f.save.coins = 0; }); await page.click('#bshop');
  await page.waitForFunction(() => window.__ff.S.state === 'shop'); await page.waitForTimeout(800);
  check(await page.evaluate(() => document.getElementById('bankbox').classList.contains('zero') && /No coins yet/.test(document.getElementById('smsg').textContent)), '0 coins: empty bank + hint message');
  await shot(page, `menu_${tag}_04_shop_zero`);
  const tabs = await page.$$eval('.tab', t => t.map(x => x.dataset.t));
  for (const t of tabs) { await page.click(`.tab[data-t="${t}"]`); check(await page.evaluate(t => document.querySelector(`.tab[data-t="${t}"]`).getAttribute('aria-selected') === 'true' && document.querySelectorAll('#sgrid .item').length > 0, t), `tab ${t} selected`); }
  await page.click('.tab[data-t="hat"]');
  await page.click('.item[data-id="crown"]', { force: true });
  check(await page.evaluate(() => document.querySelector('.item[data-id="crown"]').classList.contains('no') && document.getElementById('smsg').classList.contains('bad') && !window.__ff.save.owned.includes('hat:crown')), 'buying the crown with 0 coins is denied');
  await shot(page, `menu_${tag}_05_shop_denied`);
  // give coins, buy + equip
  await page.evaluate(() => { window.__ff.save.coins = 500; window.__ff.renderShop(); });
  await page.click('.item[data-id="crown"]'); await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__ff.save.owned.includes('hat:crown') && window.__ff.save.eq.hat === 'crown' && document.querySelector('.item[data-id="crown"]').classList.contains('eq') && window.__ff.save.coins === 410), 'crown bought (500 -> 410) and equipped');
  await shot(page, `menu_${tag}_06_shop_bought`);
  // keyboard / gamepad style nav in shop: Q/E switch tabs, arrows move between items
  await page.keyboard.press('KeyE'); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.querySelector('.tab[aria-selected="true"]').dataset.t) === 'bun', 'E (R1) switches to next tab');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await focusRing(page, 'shop item');
  if (tag === 'desktop') await shot(page, `menu_${tag}_07_shop_focus`);
  // all owned
  await page.evaluate(() => { const f = window.__ff; f.save.coins = 9999; for (const k of ['hat', 'bun', 'skin', 'trail']) document.querySelector('.tab[data-t="' + k + '"]').click(), document.querySelectorAll('#sgrid .item').forEach(i => { if (!i.classList.contains('eq') && !i.classList.contains('own')) i.click(); }); });
  await page.click('.tab[data-t="hat"]');
  check(await page.evaluate(() => document.querySelectorAll('.tab .cnt.all').length === 4 && /own every/.test(document.getElementById('smsg').textContent)), 'all items owned: ALL badges + message');
  await shot(page, `menu_${tag}_08_shop_allowned`);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__ff.S.state === 'title');
  // start (story already seen) -> pause -> resume
  await page.evaluate(() => { window.__ff.save.seenComic = true; }); await page.click('#bstart');
  await page.waitForFunction(() => window.__ff.S.state === 'play', null, { timeout: 10000 }); await page.waitForTimeout(2600);
  await shot(page, `menu_${tag}_09_play`);
  if (tag !== 'desktop') check(await page.isVisible('#pad .pb.jump'), 'touch pad visible in play');
  await page.click('#bpause'); await page.waitForFunction(() => window.__ff.S.state === 'pause'); await settle(page);
  await page.keyboard.press('ArrowRight'); await focusRing(page, 'pause');
  await shot(page, `menu_${tag}_10_pause`);
  await page.click('#bmute'); check(await page.evaluate(() => document.getElementById('bmute').getAttribute('aria-pressed')) === 'true', 'mute toggles aria-pressed');
  await page.click('#bmute');
  await page.click('#bresume'); await page.waitForFunction(() => window.__ff.S.state === 'play'); check(true, 'resume returns to play');
  // end screen
  await page.evaluate(() => { const f = window.__ff; f.S.time = 321; f.S.choices = [{ key: 'wind', floor: 0 }, { key: 'dog', floor: 1 }, { key: 'sticky', floor: 2 }]; f.finish(); });
  await page.waitForTimeout(1200);
  check(await page.evaluate(() => window.__ff.S.state === 'end' && document.getElementById('bg-victory').classList.contains('on') && window.__ff.drawMode() === 'none'), 'end screen over victory art');
  await shot(page, `menu_${tag}_11_end`);
  check(errs.length === 0, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await ctx.close();
}
(async () => {
  const { srv, url } = await serve(); const b = await launch();
  await flow(b, url, VP.desktop, 'desktop');
  await flow(b, url, VP.phone, 'phone');
  // reduced motion: transitions skipped, still works
  const { page, errs, ctx } = await open(b, url, VP.desktop, { reduced: true });
  await page.click('#bshop'); await page.waitForFunction(() => window.__ff.S.state === 'shop');
  check(await page.evaluate(() => !document.getElementById('shop').classList.contains('entering') && document.getElementById('title').hidden), 'reduced motion: instant screen switch');
  check(errs.length === 0, 'reduced motion: no errors'); await ctx.close();
  await b.close(); srv.close(); done('menus');
})().catch(e => { console.error(e); process.exit(1); });
