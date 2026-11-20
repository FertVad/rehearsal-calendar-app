"""
Build landing-page assets from the raw simulator screenshots, one set per
language: `python screens/build-assets.py [ru en es de]`.

The landing shows each screen inside a phone frame whose top and bottom are
painted as fixed overlays, while the screen content scrolls underneath. So
each source shot is split: the chrome is lifted out, and the content is
cropped out of every frame and stitched into one tall strip.

- The status bar is the same in every shot (9:41, no words), so there is one
  `chrome-status.webp` for all languages.
- A header the screen pins while its list scrolls — the planner's title, a
  project's back bar — is cut from the first frame as `<screen>-top.webp`,
  status bar included. Left in the strip it would repeat down it, and two
  frames could never align.
- The tab bar has words and shows the screen's own tab as active, so each
  screen that has one gets its own `<screen>-tabs.webp`.

Frames of the same screen overlap on purpose — the overlap is what the stitch
aligns on. It is found by comparing per-row signatures rather than trusting a
hand-measured scroll distance.

Shots: iPhone 16 simulator, 1178×2556, iOS 26 (screens/shots/README.md).
"""
import os
import sys
from PIL import Image

SRC = 'screens/shots'
OUT = 'rehearsal-calendar-native/server/public/assets'
LANGS = ['ru', 'en', 'es', 'de']

STATUS_H = 177      # safe-area top; the clock and Dynamic Island live here
PINNED_H = 335      # a large title or a back bar the screen keeps while it scrolls
TAB_TOP = 2313      # first row of the tab bar's top border
HOME_BAR_H = 102    # bottom safe area; the home indicator is drawn in it

PAGE_BG = (13, 17, 23)
TAB_BG = (22, 27, 34)
TAB_BORDER = (46, 52, 59)

SAMPLE_STEP = 7     # columns sampled for the row signature
BAND = 400          # rows of frame B matched against frame A
MIN_ROWS = 40       # fewest sampled rows a match may rest on

# A phone frame renders around 300 CSS px wide, so a 1178 px shot is about
# four times what the page can show. 660 keeps a sharp 2x at a quarter of the
# weight.
OUT_W = 660


def near(c, ref, tol=4):
    return all(abs(a - b) < tol for a, b in zip(c, ref))


def load(name):
    return Image.open(f'{SRC}/{name}.png').convert('RGB')


def has_tab_bar(im):
    # Not the bar's colour alone: a sheet in iOS 26 is painted the same grey.
    px = im.load()
    return near(px[5, TAB_TOP + 1], TAB_BORDER) and near(px[5, TAB_TOP + 80], TAB_BG)


def is_modal(im):
    # A sheet leaves the strip above it darker than any screen's background.
    return sum(im.load()[5, 0]) < sum(PAGE_BG) - 12


def square_corners(im):
    """
    A sheet's top corners are rounded over a dark backdrop. Under the page's
    own status bar those corners read as two black notches, so the backdrop
    beside them takes the sheet's colour.
    """
    px = im.load()
    w, _ = im.size
    sheet = px[w // 4, 8]
    for y in range(0, 120):
        for side in (range(0, w // 6), range(w - 1, w - w // 6, -1)):
            for x in side:
                if sum(px[x, y]) >= sum(PAGE_BG) - 12:
                    break
                px[x, y] = sheet
    return im


def erase_scroll_indicator(im):
    """
    iOS draws a scroll indicator down the right edge for a moment after every
    swipe, and the shots catch it. Nothing else lives in the last 26 px — the
    content keeps a 16 pt margin — so each row there takes the colour just
    inside it.
    """
    px = im.load()
    w, h = im.size
    for y in range(h):
        c = px[w - 30, y]
        for x in range(w - 26, w):
            px[x, y] = c
    return im


def content_of(im, top):
    """The rows that scroll: below the status bar or pinned header, above the tab bar."""
    w, h = im.size
    bottom = TAB_TOP if has_tab_bar(im) else h - HOME_BAR_H
    part = erase_scroll_indicator(im.crop((0, top, w, bottom)))
    return square_corners(part) if is_modal(im) and top == STATUS_H else part


def cut_push_warning(im):
    """
    The profile says "This device cannot receive push notifications" on every
    simulator. It is true there and false on a phone, so the card goes: rows
    from its top to the next card's top, the gap below it with it. Cut from
    the stitched strip, not a frame, so the frames still overlap as shot.
    """
    px = im.load()
    w, h = im.size
    orange = [y for y in range(h)
              if any(px[x, y][0] > 200 and 120 < px[x, y][1] < 190 and px[x, y][2] < 80
                     for x in range(60, 160, 4))]
    if not orange:
        print('    !! no push warning found', file=sys.stderr)
        return im
    # The first orange icon down the strip is the warning; "Version" further
    # down has one too.
    first = [orange[0]]
    for y in orange[1:]:
        if y - first[-1] > 30:
            break
        first.append(y)
    orange = first
    is_gap = lambda y: near(px[60, y], PAGE_BG, 3) and near(px[w // 2, y], PAGE_BG, 3)
    top = orange[0]
    while top > 0 and not is_gap(top - 1):
        top -= 1
    end = orange[-1]
    while end < h and not is_gap(end):
        end += 1
    while end < h and is_gap(end):
        end += 1
    out = Image.new('RGB', (w, h - (end - top)))
    out.paste(im.crop((0, 0, w, top)), (0, 0))
    out.paste(im.crop((0, end, w, h)), (0, top))
    print(f'    push warning cut: rows {top}-{end}')
    return out


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
    return OUT_W, h


def stitch(frames, names):
    out = frames[0]
    for nxt, name in zip(frames[1:], names[1:]):
        d = overlap(out, nxt)
        if d is None:
            print(f'    !! {name}: no overlap found, appended whole', file=sys.stderr)
            d = out.size[1]
        # Keep what precedes the join from the earlier frame and everything from
        # the join on from the later one, rather than splicing the later frame's
        # tail onto the earlier frame whole: the shared rows then come from a
        # single frame, so a half-drawn row at the boundary cannot survive, and
        # anything that changed between shots reads consistently.
        w = out.size[0]
        head = out.crop((0, 0, w, min(d, out.size[1])))
        merged = Image.new('RGB', (w, head.size[1] + nxt.size[1]))
        merged.paste(head, (0, 0))
        merged.paste(nxt, (0, head.size[1]))
        print(f'    {name}: joins at {d}px -> {merged.size[1]}px tall')
        out = merged
    return out


# name -> (frames, pins a header of its own)
SCREENS = {
    # No title since T-249: its filter row scrolls with the list.
    'calendar':     (['01-calendar', '01b-calendar-upcoming'], False),
    'card':         (['02-rehearsal-card'], False),
    'availability': (['03-availability'], False),
    'create':       (['04-create-rehearsal', '04b-create-rehearsal'], True),
    'participants': (['04c-participants'], False),
    'planner':      (['05-smart-planner', '05b-smart-planner', '05c-smart-planner'], True),
    'projects':     (['06-projects'], False),
    'project':      (['07-project-detail', '07b-project-detail'], True),
    'invite':       (['08-invite'], False),
    'sync':         (['09-calendar-sync'], False),
    'profile':      (['10-profile', '10b-profile'], True),
}
# Shown whole on the cinematic page's phone rather than scrolled: the strip
# alone is a screen short by the home bar, so its foot is kept as well.
WHOLE = {'card'}


def build(lang):
    out = f'{OUT}/{lang}'
    os.makedirs(out, exist_ok=True)
    sizes = {}
    for name, (frames, pinned) in SCREENS.items():
        print(f'  {lang}/{name}')
        names = [f'{lang}-{f}' for f in frames]
        shots = [load(n) for n in names]
        first = shots[0]
        top = PINNED_H if pinned else STATUS_H
        if pinned:
            save(first.crop((0, 0, first.size[0], top)), f'{out}/{name}-top.webp')
        if has_tab_bar(first):
            save(first.crop((0, TAB_TOP, first.size[0], first.size[1])), f'{out}/{name}-tabs.webp')
        elif name in WHOLE:
            save(first.crop((0, first.size[1] - HOME_BAR_H, first.size[0], first.size[1])), f'{out}/{name}-home.webp')
        strip = stitch([content_of(s, top) for s in shots], names)
        if name == 'profile':
            strip = cut_push_warning(strip)
        sizes[name] = save(strip, f'{out}/{name}.webp')
    return sizes


if __name__ == '__main__':
    langs = sys.argv[1:] or LANGS
    os.makedirs(OUT, exist_ok=True)
    base = load('en-01-calendar')
    save(base.crop((0, 0, base.size[0], STATUS_H)), f'{OUT}/chrome-status.webp')
    for lang in langs:
        for name, (w, h) in build(lang).items():
            print(f'{lang}/{name}.webp {w}x{h}')
