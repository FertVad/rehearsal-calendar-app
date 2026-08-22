"""
Build landing-page assets from the raw simulator screenshots.

The landing shows each screen inside a phone frame whose status bar and tab bar
are painted as fixed overlays, while the screen content scrolls underneath. So
each source shot is split: the chrome is lifted once, and the content is cropped
out of every frame and stitched into one tall strip.

Frames of the same screen overlap on purpose — the overlap is what the stitch
aligns on. It is found by comparing per-row signatures rather than trusting a
hand-measured scroll distance.
"""
import sys
from PIL import Image

SRC = 'screens/shots'
OUT = 'rehearsal-calendar-native/server/public/assets'

STATUS_H = 186      # safe-area top; the clock and Dynamic Island live here
PLANNER_TOP = 335   # Smart Planner pins its own header below the status bar
TAB_TOP = 2628      # first row of the tab bar's top border
MODAL_TOP = 230     # a modally presented sheet starts here, black above it
HOME_BAR_H = 102    # bottom safe area; the home indicator is drawn in it

SAMPLE_STEP = 33    # columns sampled for the row signature
BAND = 400          # rows of frame B matched against frame A
MIN_ROWS = 40       # fewest sampled rows a match may rest on

# The shots are 1320 wide but a phone frame renders around 300 CSS px, so the
# full-size strips are four times larger than anything the page can show.
# Halving them keeps a retina-sharp 2x and cuts the page weight to a quarter.
OUT_W = 660


def load(name):
    return Image.open(f'{SRC}/{name}.png').convert('RGB')


def has_tab_bar(im):
    r, g, b = im.load()[5, 2700]
    return abs(r - 22) < 4 and abs(g - 27) < 4 and abs(b - 34) < 4


def is_modal(im):
    return sum(im.load()[5, 0]) < 12


def content_of(im, top=None):
    """
    Crop away the chrome so only the scrolling area is left.

    `top` overrides the default for screens that pin a header of their own: it
    stays put while the list moves, so leaving it in would both duplicate it
    down the strip and stop consecutive frames from ever aligning.
    """
    w, h = im.size
    if top is None:
        top = MODAL_TOP if is_modal(im) else STATUS_H
    # Without a tab bar the shot runs to the home indicator. Left in, that pale
    # bar ends up baked into the middle of the stitched strip.
    bottom = TAB_TOP if has_tab_bar(im) else h - HOME_BAR_H
    return im.crop((0, top, w, bottom))


def signatures(im):
    px = im.load()
    w, h = im.size
    cols = range(0, w, SAMPLE_STEP)
    return [sum(sum(px[x, y]) for x in cols) for y in range(h)]


def overlap(a, b):
    """
    How far b is scrolled past a, in pixels.

    b[y] shows the same content as a[y + d]; we look for the d that lines the
    top of b up against a. The shared strip is often shorter than BAND — when
    the frames were taken a full screen apart only a sliver is common — so the
    score is averaged over the rows that actually fall inside a, and a match on
    too few rows is rejected rather than trusted.

    Returns None when nothing matches well: the frames do not overlap and must
    not be stitched.
    """
    sa, sb = signatures(a), signatures(b)
    ha, band = len(sa), min(BAND, len(sb))
    typical = sorted(sa)[len(sa) // 2]
    best, best_d = None, None
    for d in range(1, ha):
        rows = min(band, ha - d)
        if rows < MIN_ROWS:
            break
        n = score = 0
        for y in range(0, rows, 4):
            score += abs(sb[y] - sa[y + d])
            n += 1
        per_row = score / n
        if best is None or per_row < best:
            best, best_d = per_row, d
    if best_d is None:
        return None
    return best_d if best < typical * 0.06 else None


def save(im, path):
    """Write at OUT_W, preserving aspect. WebP is a third of PNG at this size."""
    h = round(im.size[1] * OUT_W / im.size[0])
    im.resize((OUT_W, h), Image.LANCZOS).save(path, 'WEBP', quality=90, method=6)


def stitch(names, top=None):
    frames = [content_of(load(n), top) for n in names]
    out = frames[0]
    for nxt, name in zip(frames[1:], names[1:]):
        d = overlap(out, nxt)
        if d is None:
            print(f'  !! {name}: no overlap found, appended whole', file=sys.stderr)
            d = out.size[1]
        # Keep what precedes the join from the earlier frame and everything from
        # the join on from the later one, rather than splicing the later frame's
        # tail onto the earlier frame whole: the shared rows then come from a
        # single frame, so a half-drawn row at the boundary cannot survive, and
        # anything the user changed between shots reads consistently.
        w = out.size[0]
        head = out.crop((0, 0, w, min(d, out.size[1])))
        merged = Image.new('RGB', (w, head.size[1] + nxt.size[1]))
        merged.paste(head, (0, 0))
        merged.paste(nxt, (0, head.size[1]))
        print(f'  {name}: joins at {d}px -> {merged.size[1]}px tall')
        out = merged
    return out


# screens whose content starts below a pinned header of their own
CUSTOM_TOP = {'scr-planner': PLANNER_TOP}

SCREENS = {
    'scr-calendar':     ['en-01-calendar', 'en-01b-calendar-upcoming'],
    'scr-card':         ['en-02-rehearsal-card'],
    'scr-availability': ['en-03-availability'],
    'scr-create':       ['en-04-create-rehearsal', 'en-04b-create-rehearsal'],
    'scr-planner':      ['en-05-smart-planner', 'en-05b-smart-planner', 'en-05c-smart-planner'],
    'scr-projects':     ['en-06-projects'],
    'scr-project':      ['en-07-project-detail', 'en-07b-project-detail'],
    'scr-invite':       ['en-08-invite'],
    'scr-sync':         ['en-09b-calendar-sync'],
    'scr-profile':      ['en-10-profile', 'en-10b-profile'],
}

if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)

    base = load('en-01-calendar')
    save(base.crop((0, 0, base.size[0], STATUS_H)), f'{OUT}/chrome-status.webp')
    save(base.crop((0, TAB_TOP, base.size[0], base.size[1])), f'{OUT}/chrome-tabs.webp')
    print(f'chrome-status {STATUS_H}px, chrome-tabs {base.size[1] - TAB_TOP}px')

    planner = load('en-05-smart-planner')
    save(planner.crop((0, 0, planner.size[0], PLANNER_TOP)), f'{OUT}/chrome-planner.webp')
    print(f'chrome-planner {PLANNER_TOP}px')

    for out_name, frames in SCREENS.items():
        print(out_name)
        save(stitch(frames, CUSTOM_TOP.get(out_name)), f'{OUT}/{out_name}.webp')
