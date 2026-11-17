// Loxx asks its questions on the game sheet (ML219, 9 Nov 2026), not in the
// phone's own box, so a page.on('dialog') handler no longer sees them. This
// answers them the same way: each question's words go to onAsk, which says
// true (the yes button) or false (the no button), and that button is tapped.
// Call it once after page.goto.
//
// Save your turn? (ML292, 17 Nov 2026) pops up after the last number a roll
// allows. Unless opts.save is set (or the page sets window.__lkSaveAsks), it
// is put away by tapping beside it, which leaves the mark and Done as they
// were before that question existed, so the older suites play on unchanged.
// A page can also queue answers in window.__lkNext (true, false, or null to
// tap beside the question); each question still goes to onAsk first.
async function answerLkAsks(page, onAsk, opts = {}) {
  await page.exposeFunction('__lkAskSeen', onAsk);
  await page.evaluate(save => {
    new MutationObserver(() => {
      document.querySelectorAll('.lkask:not([data-seen])').forEach(async box => {
        box.dataset.seen = '1';
        if (box.dataset.kind === 'save' && !(save || window.__lkSaveAsks)) { box.click(); return; }
        let yes = await window.__lkAskSeen(box.querySelector('p').textContent);
        const q = window.__lkNext; if (Array.isArray(q) && q.length) yes = q.shift();
        if (yes === null) { if (box.isConnected) box.click(); return; }
        const b = box.querySelector('[data-ask="' + (yes ? 1 : 0) + '"]');
        if (b && b.isConnected) b.click();
      });
    }).observe(document.body, { childList: true, subtree: true });
  }, !!opts.save);
}
module.exports = { answerLkAsks };
