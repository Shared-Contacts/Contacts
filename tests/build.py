#!/usr/bin/env python3
"""Build the two test pages from the real app.

boot.html is index.html with the CDN scripts swapped for stub.js, so the
suites drive the actual page rather than a copy of it that has drifted.
jotboot.html is the same for the Jotter. app.js and jotapp.js are the inline
scripts on their own, so `node --check` can see them.

Run this after every edit to index.html and before running any suite.
"""
import pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

SUPABASE = ('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
            '/dist/umd/supabase.min.js"></script>\n')
LEAFLET = ('<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4'
           '/leaflet.min.js"></script>\n')


def inline_script(html, where):
    """The one inline <script> at the end of the page, on its own."""
    m = re.search(r'<script>\n(.*)\n</script>\n</body>', html, re.S)
    if not m:
        sys.exit(f'could not find the inline script in {where}')
    return m.group(1)


def main():
    app = (ROOT / 'index.html').read_text()
    if app.count(SUPABASE + LEAFLET) != 1:
        sys.exit('the CDN script tags in index.html have moved - nothing built')
    (HERE / 'boot.html').write_text(
        app.replace(SUPABASE + LEAFLET, '<script src="stub.js"></script>\n\n', 1))
    script = inline_script(app, 'index.html')
    (HERE / 'app.js').write_text(script)
    print(f'boot.html and app.js built; {len(script.splitlines())} lines of script')

    jot = (ROOT / 'jot' / 'index.html').read_text()
    if jot.count(SUPABASE) != 1:
        sys.exit('the CDN script tag in jot/index.html has moved')
    (HERE / 'jotboot.html').write_text(
        jot.replace(SUPABASE, '<script src="stub.js"></script>\n', 1))
    (HERE / 'jotapp.js').write_text(inline_script(jot, 'jot/index.html'))
    print('jotboot.html and jotapp.js built')


if __name__ == '__main__':
    main()
