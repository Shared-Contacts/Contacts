# The tests

About 700 checks across 21 suites, plus two sweeps. They drive **the real
`index.html`** in a real browser — opening the actual screens, clicking the
actual buttons and reading what comes up — with only Supabase and Leaflet
replaced. They are not unit tests of extracted functions, because the thing
being protected is the page, not a function.

## Running them

```bash
bash tests/run.sh
```

That builds the test pages from the current `index.html`, checks the syntax of
both inline scripts, runs every suite, then sweeps every screen for console
errors and measures the page at five phone widths. It prints `All green.` or
says what failed.

One suite on its own:

```bash
cd tests
python3 build.py        # after any edit to index.html
node money.test.js
```

### What you need

- **Node 18 or newer.**
- **Playwright and a Chromium**: `npm install playwright` then
  `npx playwright install chromium`.
- The suites look for Chromium at `/opt/pw-browsers/chromium`. Anywhere else,
  say so: `CHROMIUM=/path/to/chromium bash tests/run.sh`.

## How it works

`build.py` makes two pages and two scripts, none of which are committed:

| Built file | What it is |
| --- | --- |
| `boot.html` | `index.html` with the CDN scripts swapped for `stub.js` |
| `jotboot.html` | the same for `jot/index.html` |
| `app.js`, `jotapp.js` | each page's inline script on its own, so `node --check` can see it |

`stub.js` is a small fake Supabase: it honours `eq`, `in`, `or`, `ilike` and
the rest, so a test can tell a query scoped to one account from one that
quietly returns everybody's, and it hands back deep copies so a test cannot
pass by mutating the store. Every write the page attempts lands in
`window.__writes`, which is how the suites check what would have been saved
without saving anything. It also fakes Leaflet and the photo storage.

Seed data lives in `window.__rows` at the top of `stub.js`. Most suites
rewrite the bits they need and call `loadAll()` or `loadMoney()` again.

## The suites

| Suite | What it covers |
| --- | --- |
| `money` | the cashbook screen, balances, filtering, settings, help |
| `split` | splitting an imported transaction across several lines |
| `todo` | flagging transactions that still need a category |
| `dupe` | spotting a transaction already in the books |
| `pair` | joining two halves of a transfer |
| `pick` | choosing several transactions and deleting them |
| `rate` | the exchange rate worked out from a transfer's two amounts |
| `cur` | adding and editing currencies |
| `revolut` | the bank CSV import, its column mapping and its oddities |
| `priv` | accounts belonging to people, sharing, receipts, statement files |
| `code` | the category code deciding the order of the list |
| `batch` | account groups, the typed date, swiping the log, backgrounds |
| `fixes` | the location map, contact icons, overwritable amounts |
| `detail` | a contact's own page |
| `face` | making a gallery photo the profile photo |
| `nav` | the menu, the arrow home, screen stacking, one refresh |
| `brief` | Today, and the band that appears when a load fails |
| `jot` | MY Jotter: saving, queueing without a signal, taking one back |
| `offer` | the offer to install the Jotter, on Android and on iPhone |
| `install` | the install flow and what each phone is told |
| `manifests` | the two manifests, their scopes, ids and icons |
| `regress.js` | opens every screen; fails on any console error |
| `fit.js` | measures the page at 320, 360, 390, 414 and 768px |

## Adding to them

Put a check where somebody would notice it breaking. The style throughout is a
sentence a person would say — `ok('a swipe to the left goes forward a day', …)`
— so a failure reads as a complaint about the app rather than about a variable.

Two habits worth keeping:

- **Test the behaviour, not the implementation.** When the date box stopped
  being an `<input type="date">`, the suite that asserted its type failed and
  the one that typed `4/7/19` and checked where it landed kept working.
- **A suite that needs a settings card open must open it**, as a person would.
  The cards start folded.

## When a suite fails after a deliberate change

It is usually the test that is now wrong, not the app — but check which before
you edit it. Several of the assertions in here were written to lock in
behaviour we have since deliberately changed, and the commit message is the
record of why.
