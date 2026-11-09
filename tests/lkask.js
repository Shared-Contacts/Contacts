// Loxx asks its questions on the game sheet (ML219, 9 Nov 2026), not in the
// phone's own box, so a page.on('dialog') handler no longer sees them. This
// answers them the same way: each question's words go to onAsk, which says
// true (the yes button) or false (the no button), and that button is tapped.
// Call it once after page.goto.
async function answerLkAsks(page, onAsk) {
  await page.exposeFunction('__lkAskSeen', onAsk);
  await page.evaluate(() => {
    new MutationObserver(() => {
      document.querySelectorAll('.lkask:not([data-seen])').forEach(async box => {
        box.dataset.seen = '1';
        const yes = await window.__lkAskSeen(box.querySelector('p').textContent);
        const b = box.querySelector('[data-ask="' + (yes ? 1 : 0) + '"]');
        if (b && b.isConnected) b.click();
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
}
module.exports = { answerLkAsks };
