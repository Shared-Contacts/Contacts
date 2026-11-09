// Hold a row still until it lifts, then slide it past another and let go,
// the way a thumb does it. Used wherever a list is put in order by holding
// (the up and down arrows went on 4 Nov 2026).
//   from  the row to move (or something inside it to hold, such as its grip)
//   to    the row it should end up just after (below) or just before
async function holdSlide(page, from, to, { below = true, hold = 650 } = {}) {
  const at = sel => page.$eval(sel, e => {
    const g = e.matches('[data-hm]') ? (e.querySelector(':scope > .grip, :scope > summary .grip, :scope > summary') || e) : e;
    const r = g.getBoundingClientRect();
    return { x: r.left + Math.min(r.width / 2, 14), y: r.top + r.height / 2 };
  });
  await page.$eval(from, e => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(150);
  const a = await at(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(hold);
  // Where to go is measured once the row has lifted: some lists (the accounts,
  // since 9 Nov 2026) fold down to their names when one is held.
  const t = await page.$eval(to, e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  const y = below ? t.bottom + 6 : t.top - 6;
  await page.mouse.move(a.x, (a.y + y) / 2, { steps: 6 });
  await page.mouse.move(a.x, y, { steps: 6 });
  // Where the screen was when the finger came off: dragging near the top or
  // bottom edge creeps the screen along, which is meant to happen.
  const scrolled = await page.$eval(from, e => {
    for (let p = e.parentElement; p; p = p.parentElement)
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) return p.scrollTop;
    return scrollY; }).catch(() => null);
  await page.mouse.up();
  await page.waitForTimeout(600);
  return scrolled;
}
module.exports = { holdSlide };
