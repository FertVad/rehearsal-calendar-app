// The App Store's pictures, drawn (T-274). Called by compose.mjs, which says
// what to draw in a job file; nothing here reads captions.json or styles.css.
//
//   compose draw <job.json>                    the pictures; prints what it drew, as JSON
//   compose read [<top>:]<bottom> <lang> <picture.png>…  each picture's lines of text between top and bottom, as JSON
//   compose sheet <out.png> <height> <#bg> <picture.png>…  the pictures in a row, small, to look over
//   compose video <video.json>                 the preview video's layer (T-289), frame by frame, RGBA to standard output
//
// Every picture is laid out on the 1320×2868 of the iPhone 17 Pro Max and drawn
// at each size the job asks for, scaled — not drawn once and resampled — so
// the 6.3" set's type is as sharp as the 6.9"'s. No alpha channel: App Store
// Connect refuses a screenshot that has one.
import Accelerate
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

struct Size: Codable { let dir: String; let width: Int; let height: Int }
/** The landing's colours, and `emphasis`: the main word's, the app's lilac. */
struct Colours: Codable { let background: String; let text: String; let accent: String; let line: String; let emphasis: String }
/** Literata's two files, upright and italic: variable, with `opsz` and `wght` axes (e2e/store/fonts). */
struct PlayFonts: Codable { let roman: String; let italic: String }
struct Job: Codable { let captions: [String]; let shots: [String]; let outputs: [Size]; let fonts: PlayFonts; let colours: Colours }

// The layout, in the 1320×2868 frame.
let W: CGFloat = 1320, H: CGFloat = 2868
let captionTop: CGFloat = 110, captionBottom: CGFloat = 420
let preferredSize: CGFloat = 104         // the type when every line fits at it
let lineHeight: CGFloat = 1.1            // of the type's size
let shotTop: CGFloat = 470, shotBottomMargin: CGFloat = 80
let cornerShare: CGFloat = 0.12          // the screenshot's corner radius, of its width

// The captions' type (T-288, «Пьеса»): Literata at 600, its italic at 600
// for the main word, the optical size as the type's, up to the font's 72.
let wghtAxis: UInt32 = 0x7767_6874, opszAxis: UInt32 = 0x6F70_737A
let playWeight: CGFloat = 600, opszMost: CGFloat = 72

func fail(_ text: String) -> Never {
  FileHandle.standardError.write((text + "\n").data(using: .utf8)!)
  exit(1)
}

func colour(_ css: String) -> CGColor {
  let s = css.trimmingCharacters(in: .whitespaces)
  if s.hasPrefix("#"), s.count == 7, let v = Int(s.dropFirst(), radix: 16) {
    return CGColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
  }
  // rgba(r, g, b, a)
  let parts = s.drop(while: { $0 != "(" }).dropFirst().prefix(while: { $0 != ")" })
    .split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
  guard parts.count >= 3 else { fail("not a colour: \(css)") }
  return CGColor(srgbRed: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255, alpha: parts.count > 3 ? parts[3] : 1)
}

/** A variable font from its file — the repository's, never the system's — its axes set as `axes` says. */
func variableFont(_ file: String, size: CGFloat, axes: [UInt32: CGFloat]) -> CTFont {
  guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: file) as CFURL) as? [CTFontDescriptor],
        var descriptor = descriptors.first else { fail("no font in \(file)") }
  for (tag, value) in axes.sorted(by: { $0.key < $1.key }) {
    descriptor = CTFontDescriptorCreateCopyWithVariation(descriptor, NSNumber(value: tag) as CFNumber, value)
  }
  return CTFontCreateWithFontDescriptor(descriptor, size, nil)
}

/** Literata (or its italic) at 600, its optical size the type's, 72 at most. */
func playFont(_ file: String, size: CGFloat) -> CTFont {
  variableFont(file, size: size, axes: [wghtAxis: playWeight, opszAxis: min(size, opszMost)])
}

/** The file a font was made from: what the manifest says was drawn with. */
func fontFile(_ font: CTFont) -> String {
  (CTFontCopyAttribute(font, kCTFontURLAttribute) as? URL)?.path ?? "?"
}

/**
 * A caption's line and its main word: `[` and `]` round the word in
 * captions.json, never printed. At most one pair a caption, within one line.
 */
func marked(_ caption: String) -> [(text: String, emphasis: NSRange?)] {
  let opens = caption.filter { $0 == "[" }.count, closes = caption.filter { $0 == "]" }.count
  guard opens == closes, opens <= 1 else { fail("a caption marks one main word at most, in one pair of brackets: \(caption)") }
  return caption.components(separatedBy: "\n").map { line in
    guard let open = line.firstIndex(of: "[") else {
      guard !line.contains("]") else { fail("a main word's brackets in one line: \(caption)") }
      return (line, nil)
    }
    guard let close = line.firstIndex(of: "]"), open < close else { fail("a main word's brackets in one line: \(caption)") }
    let before = String(line[..<open]), word = String(line[line.index(after: open)..<close])
    let text = before + word + String(line[line.index(after: close)...])
    return (text, NSRange(location: (before as NSString).length, length: (word as NSString).length))
  }
}

/** The ink of `character` in `font`: from its origin, and its advance. */
func ink(_ character: unichar, _ font: CTFont) -> (bounds: CGRect, advance: CGFloat) {
  var c = character, glyph: CGGlyph = 0
  guard CTFontGetGlyphsForCharacters(font, &c, &glyph, 1) else { return (.zero, 0) }
  var bounds = CGRect.zero, advance = CGSize.zero
  CTFontGetBoundingRectsForGlyphs(font, .horizontal, &glyph, &bounds, 1)
  CTFontGetAdvancesForGlyphs(font, .horizontal, &glyph, &advance, 1)
  return (bounds, advance.width)
}

/**
 * One line of a caption: upright in `text`, its main word italic in
 * `emphasis`. Where the slanted word meets upright type — «el martes?» — the
 * italic's overhang is given back as space (an italic correction), so the
 * "?" never runs into the "s"; never before a space, which has its own.
 */
func playLine(_ string: String, emphasis: NSRange?, roman: CTFont, italic: CTFont, text: CGColor, accent: CGColor) -> CTLine {
  let fontKey = NSAttributedString.Key(kCTFontAttributeName as String)
  let colourKey = NSAttributedString.Key(kCTForegroundColorAttributeName as String)
  let kernKey = NSAttributedString.Key(kCTKernAttributeName as String)
  let a = NSMutableAttributedString(string: string, attributes: [fontKey: roman, colourKey: text])
  if let r = emphasis, r.length > 0 {
    a.addAttributes([fontKey: italic, colourKey: accent], range: r)
    let s = string as NSString
    let isSpace = { (i: Int) in CharacterSet.whitespaces.contains(Unicode.Scalar(s.character(at: i)) ?? " ") }
    if r.upperBound < s.length, !isSpace(r.upperBound) {
      let last = ink(s.character(at: r.upperBound - 1), italic)
      let over = last.bounds.maxX - last.advance
      if over > 0 { a.addAttribute(kernKey, value: over, range: NSRange(location: r.upperBound - 1, length: 1)) }
    }
    if r.location > 0, !isSpace(r.location - 1) {
      let first = ink(s.character(at: r.location), italic)
      if first.bounds.minX < 0 { a.addAttribute(kernKey, value: -first.bounds.minX, range: NSRange(location: r.location - 1, length: 1)) }
    }
  }
  return CTLineCreateWithAttributedString(a)
}

/** Where a line's ink starts and ends, from its origin. */
func inkSpan(_ l: CTLine) -> (left: CGFloat, right: CGFloat) {
  let b = CTLineGetBoundsWithOptions(l, .useGlyphPathBounds)
  return (b.minX, b.maxX)
}

func line(_ text: String, font: CTFont, colour: CGColor) -> CTLine {
  let attributes: [NSAttributedString.Key: Any] = [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): colour,
  ]
  return CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
}

func width(_ l: CTLine) -> CGFloat { CGFloat(CTLineGetTypographicBounds(l, nil, nil, nil)) }

func loadImage(_ file: String) -> CGImage {
  guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: file) as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fail("cannot read \(file)") }
  return image
}

func writePng(_ image: CGImage, to file: String) {
  guard let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: file) as CFURL, UTType.png.identifier as CFString, 1, nil)
  else { fail("cannot write \(file)") }
  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else { fail("cannot write \(file)") }
}

/**
 * One size of type for a language: the largest whole one at which every line
 * of every caption — its main word italic — fits `limit` (the window's width),
 * never above `most`. Measured at that size: the optical size changes the
 * letters' widths with it.
 */
func typeSize(_ captions: [String], fonts: PlayFonts, limit: CGFloat, most: CGFloat = preferredSize) -> CGFloat {
  let lines = captions.flatMap(marked)
  let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
  let widest = { (size: CGFloat) -> CGFloat in
    let roman = playFont(fonts.roman, size: size), italic = playFont(fonts.italic, size: size)
    return lines.map { l -> CGFloat in
      let span = inkSpan(playLine(l.text, emphasis: l.emphasis, roman: roman, italic: italic, text: white, accent: white))
      return span.right - span.left
    }.max() ?? 0
  }
  var size = min(most, floor(limit * 100 / max(widest(100), 1)) + 2)
  while size > 1 && widest(size) > limit { size -= 1 }
  return size
}

/** The landing's background and its glow: its accent, faint, behind the top of the screenshot. In the 1320-wide frame. */
func drawBackground(_ context: CGContext, _ c: Colours) {
  context.setFillColor(colour(c.background))
  context.fill(CGRect(x: 0, y: 0, width: W, height: H + 2))
  let glow = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                        colors: [colour(c.accent).copy(alpha: 0.22)!, colour(c.accent).copy(alpha: 0)!] as CFArray,
                        locations: [0, 1])!
  context.drawRadialGradient(glow, startCenter: CGPoint(x: W / 2, y: shotTop + 200), startRadius: 0,
                             endCenter: CGPoint(x: W / 2, y: shotTop + 200), endRadius: 1100, options: [])
}

/**
 * The caption: its lines flush left, each one's first letter's ink on `left`
 * (the window's left edge), the block centred in its band, the lines where the
 * caption breaks them, the main word italic in the lilac. Returns each line's
 * box (cap height to baseline) and the main word's box, for the manifest.
 */
func drawCaption(_ context: CGContext, _ caption: String, fonts: PlayFonts, size: CGFloat, left: CGFloat, colours c: Colours)
  -> (lines: [[String: CGFloat]], emphasis: [String: CGFloat]?) {
  let roman = playFont(fonts.roman, size: size), italic = playFont(fonts.italic, size: size)
  let lines = marked(caption)
  let lh = size * lineHeight
  let ascent = CTFontGetAscent(roman), descent = CTFontGetDescent(roman)
  let blockTop = captionTop + (captionBottom - captionTop - lh * CGFloat(lines.count)) / 2
  var boxes: [[String: CGFloat]] = [], emphasis: [String: CGFloat]? = nil
  for (i, marked) in lines.enumerated() {
    let l = playLine(marked.text, emphasis: marked.emphasis, roman: roman, italic: italic,
                     text: colour(c.text), accent: colour(c.emphasis))
    let baseline = blockTop + CGFloat(i) * lh + (lh - ascent - descent) / 2 + ascent
    let x = left - inkSpan(l).left
    context.saveGState()
    // Text the right way up in the flipped frame.
    context.translateBy(x: x, y: baseline)
    context.scaleBy(x: 1, y: -1)
    context.textPosition = .zero
    CTLineDraw(l, context)
    context.restoreGState()
    // The line's rows: from its ink's top (an italic b's serif rises above the capitals) to its baseline.
    let inkTop = baseline - CTLineGetBoundsWithOptions(l, .useGlyphPathBounds).maxY
    boxes.append(["capTop": baseline - CTFontGetCapHeight(roman), "inkTop": inkTop, "baseline": baseline])
    if let r = marked.emphasis {
      // The word's advance, and the italic's ink beyond it at either end.
      let s = marked.text as NSString
      let first = ink(s.character(at: r.location), italic), last = ink(s.character(at: r.upperBound - 1), italic)
      emphasis = ["line": CGFloat(i),
                  "left": x + CTLineGetOffsetForStringIndex(l, r.location, nil) + min(0, first.bounds.minX),
                  "right": x + CTLineGetOffsetForStringIndex(l, r.upperBound, nil) + max(0, last.bounds.maxX - last.advance),
                  "top": baseline - ascent, "bottom": baseline + descent]
    }
  }
  return (boxes, emphasis)
}

/**
 * The preview video's layer (T-289, the storyboard «Свет на главном»): every
 * frame of it, `width`×`height` (886×1920) RGBA, premultiplied, written to
 * standard output one after another — montage.mjs pipes them into ffmpeg,
 * which lays them over the cut recording. What was drawn goes to `manifest`.
 * Times are the video's, in seconds; places its px.
 *
 * - The light: a shade (`shade`, `dim` of it) with up to two rounded holes,
 *   their edges soft (lightFeather), moving to their next place in lightMove.
 *   The holes are where montage.mjs says: the frames of elements read from
 *   the screen's hierarchy while it was recorded.
 * - The touch marks, where and when montage.mjs says the app reported them:
 *   pressed in, held, let go with a ripple.
 * - The captions, «Пьеса» as the screenshots' (T-288): Literata 600, the main
 *   word in its italic and the app's lilac, flush left on the app's margin,
 *   one size for the language; no band — round the lines the shade itself
 *   denser (captionDark), so the app's words do not read beside them, easing
 *   back to the shot's shade over a soft edge, never in a hole; each line in
 *   from below in turn, its main word after it. The hook typed out, a caret
 *   blinking after it.
 * - The finale: a line, a pencil stroke through its struck part, the right
 *   word written over it in Caveat.
 * - The closing card dissolving in over everything: the landing's ground and
 *   glow, the mark, the name, the sign-in line small at its foot.
 */
struct VLight: Codable { let t: Double; let holes: [[Double]]; let dim: Double; let instant: Bool }
struct VTap: Codable { let t: Double; let x: Double; let y: Double }
struct VCaption: Codable { let kind: String; let text: String; let start: Double; let end: Double; let centre: Double }
struct VFinale: Codable { let line: String; let struck: String; let insert: String; let start: Double; let end: Double; let centre: Double }
struct VCard: Codable { let start: Double; let dissolve: Double; let signIn: String }
struct VFonts: Codable { let roman: String; let italic: String; let hand: String; let brand: String }
struct VideoJob: Codable {
  let width: Int; let height: Int; let fps: Int; let frames: Int; let manifest: String
  let fonts: VFonts; let colours: Colours; let shade: String; let mark: String; let name: String
  let lights: [VLight]; let taps: [VTap]; let captions: [VCaption]; let finale: VFinale; let card: VCard
}

// The video's layout, in its own pixels (886 wide).
let videoMargin: CGFloat = 42            // the app's margin: every caption's ink starts here
let captionMost: CGFloat = 70            // the captions' type, one size for a language
let bigMost: CGFloat = 88                // the hook's and the finale's
let videoLineHeight: CGFloat = 1.08
let lightMove = 0.3                      // a hole moving to its next place
let lightFeather: CGFloat = 20           // a hole's soft edge, either side of it
// Round a caption the shade is denser (T-289, 21.11): the app's white comes
// through at 3 % — 8 of 255, with the shade's own colour some 15 — so no word
// of the app reads between or beside the caption's lines; from `darkPad`
// round the lines it eases back to the shot's shade over `darkFeather` — the
// wider to either side, where the app's rows run on past a short line ("…зал"
// after «Все в курсе:»). It is the shade's, so a hole lets the app through as
// it is: never darkened.
let captionDark: Double = 0.97
let darkPad = CGSize(width: 40, height: 16)
let darkFeather = CGSize(width: 180, height: 80)
let leastContrast: CGFloat = 4.5
let signInSize: CGFloat = 40             // the sign-in line: 40 px of 886, never smaller

/** CSS's cubic-bezier timing: progress at `x` (0…1). */
func bezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ x: Double) -> Double {
  if x <= 0 { return 0 }
  if x >= 1 { return 1 }
  var lo = 0.0, hi = 1.0, t = x
  for _ in 0..<40 {
    let cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t
    if cx < x { lo = t } else { hi = t }
    t = (lo + hi) / 2
  }
  return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t
}
func ease(_ x: Double) -> Double { bezier(0.25, 0.1, 0.25, 1, x) }
func easeOut(_ x: Double) -> Double { bezier(0, 0, 0.58, 1, x) }
func rise(_ x: Double) -> Double { bezier(0.2, 0.7, 0.2, 1, x) }
func clamp01(_ x: Double) -> Double { min(1, max(0, x)) }

/** sRGB's relative luminance of a colour 0…1 a channel. */
func luminance(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> CGFloat {
  let lin = { (c: CGFloat) -> CGFloat in c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
func components(_ c: CGColor) -> [CGFloat] { c.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)!.components! }

/** A hole of light: where it is, and how open (0 when it has closed to a point). */
struct Hole { var x, y, w, h, r: Double }
struct LightState { var holes: [Hole]; var dim: Double }

/** The light at `t`: the last keyframe's, or on its way there from the one before. */
func lightAt(_ lights: [VLight], _ t: Double) -> LightState {
  let hole = { (a: [Double]) in Hole(x: a[0], y: a[1], w: a[2], h: a[3], r: a[4]) }
  let state = { (l: VLight) in LightState(holes: l.holes.map(hole), dim: l.dim) }
  guard let k = lights.lastIndex(where: { $0.t <= t + 1e-9 }) else { return lights.first.map(state) ?? LightState(holes: [], dim: 0) }
  let to = state(lights[k])
  if lights[k].instant || k == 0 { return to }
  let p = ease(clamp01((t - lights[k].t) / lightMove))
  if p >= 1 { return to }
  let from = state(lights[k - 1])
  let mix = { (a: Double, b: Double) in a + (b - a) * p }
  var holes: [Hole] = []
  for i in 0..<max(from.holes.count, to.holes.count) {
    // A hole that comes or goes opens from, or closes to, the middle of the other.
    let b = i < to.holes.count ? to.holes[i] : nil, a = i < from.holes.count ? from.holes[i] : nil
    let a1 = a ?? Hole(x: b!.x + b!.w / 2, y: b!.y + b!.h / 2, w: 0, h: 0, r: b!.r)
    let b1 = b ?? Hole(x: a!.x + a!.w / 2, y: a!.y + a!.h / 2, w: 0, h: 0, r: a!.r)
    holes.append(Hole(x: mix(a1.x, b1.x), y: mix(a1.y, b1.y), w: mix(a1.w, b1.w), h: mix(a1.h, b1.h), r: mix(a1.r, b1.r)))
  }
  return LightState(holes: holes, dim: mix(from.dim, to.dim))
}

/** How much of a hole's light reaches (x, y): 1 well inside, 0 well outside, soft across its edge. */
func lit(_ h: Hole, _ x: Double, _ y: Double) -> Double {
  let open = min(1, min(h.w, h.h) / Double(2 * lightFeather))
  if open <= 0 { return 0 }
  let r = min(h.r, h.w / 2, h.h / 2)
  let qx = abs(x - (h.x + h.w / 2)) - (h.w / 2 - r), qy = abs(y - (h.y + h.h / 2)) - (h.h / 2 - r)
  let d = hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r
  let f = Double(lightFeather)
  let s = clamp01((d + f) / (2 * f))
  return open * (1 - s * s * (3 - 2 * s))
}

/** The darkness round a caption: its lines' rectangle `rect`, and how far in it has faded (0…1). */
struct Dark { let rect: CGRect; let on: Double }

/** How much of a caption's darkness reaches (x, y): 1 in its rectangle and `darkPad` round it, easing to 0 over `darkFeather`. */
func darkness(_ d: Dark, _ x: Double, _ y: Double) -> Double {
  let r = d.rect.insetBy(dx: -darkPad.width, dy: -darkPad.height)
  let dx = max(Double(r.minX) - x, 0, x - Double(r.maxX)), dy = max(Double(r.minY) - y, 0, y - Double(r.maxY))
  let s = clamp01(hypot(dx / Double(darkFeather.width), dy / Double(darkFeather.height)))
  return d.on * (1 - s * s * (3 - 2 * s))
}

/** The shade's alpha at (x, y) in a light state, the captions' darkness `darks` in it; none in a hole. */
func shadeAlpha(_ s: LightState, _ darks: [Dark], _ x: Double, _ y: Double) -> Double {
  var through = 1.0
  for h in s.holes { through *= 1 - lit(h, x, y) }
  let dark = darks.map { darkness($0, x, y) }.max() ?? 0
  return through * (s.dim + max(0, captionDark - s.dim) * dark)
}

/** A caption's lines, laid out: each twice — the upright part alone, the main word alone — so each fades on its own. */
struct LaidLine { let upright: CTLine; let key: CTLine; let x: CGFloat; let baseline: CGFloat; let text: String; let emphasis: NSRange?; let ink: CGRect }
struct LaidCaption {
  let job: VCaption; let size: CGFloat; let lines: [LaidLine]; let box: CGRect
  var contrast: (white: CGFloat, lilac: CGFloat) = (0, 0); var samples: [CGPoint] = []
  /** The brightest the app's white comes through in its rectangle, outside the holes, of 255. */
  var under: CGFloat = 255
}

func video(_ job: VideoJob) {
  signal(SIGPIPE, SIG_IGN)
  let c = job.colours
  let w = job.width, h = job.height
  let W = CGFloat(w), H = CGFloat(h)
  let clear = CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 0)
  let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
  let lilac = colour(c.emphasis)
  let shade = colour(job.shade)
  let shadeRGB = components(shade)
  let fonts = PlayFonts(roman: job.fonts.roman, italic: job.fonts.italic)
  let textWidth = W - 2 * videoMargin

  // One size for the captions, one for the hook, one for the finale: the largest whole one their widest line fits, at most as the storyboard has it.
  let plays = job.captions.filter { $0.kind == "play" }.map(\.text)
  let size = typeSize(plays, fonts: fonts, limit: textWidth, most: captionMost)
  let hookSize = typeSize(job.captions.filter { $0.kind == "typed" }.map(\.text), fonts: fonts, limit: textWidth, most: bigMost)
  let finaleSize = typeSize([job.finale.line], fonts: fonts, limit: textWidth, most: bigMost)

  func lay(_ caption: VCaption, size: CGFloat) -> LaidCaption {
    let roman = playFont(fonts.roman, size: size), italic = playFont(fonts.italic, size: size)
    let marks = marked(caption.text)
    let lh = size * videoLineHeight
    let ascent = CTFontGetAscent(roman), descent = CTFontGetDescent(roman)
    let top = H * CGFloat(caption.centre) - lh * CGFloat(marks.count) / 2
    var lines: [LaidLine] = []
    var box = CGRect.null
    for (i, m) in marks.enumerated() {
      let upright = playLine(m.text, emphasis: m.emphasis, roman: roman, italic: italic, text: white, accent: clear)
      let key = playLine(m.text, emphasis: m.emphasis, roman: roman, italic: italic, text: clear, accent: lilac)
      let baseline = top + CGFloat(i) * lh + (lh - ascent - descent) / 2 + ascent
      let bounds = CTLineGetBoundsWithOptions(upright, .useGlyphPathBounds)
      let x = videoMargin - bounds.minX
      // The line's ink, top-down.
      let ink = CGRect(x: videoMargin, y: baseline - bounds.maxY, width: bounds.width, height: bounds.height)
      lines.append(LaidLine(upright: upright, key: key, x: x, baseline: baseline, text: m.text, emphasis: m.emphasis, ink: ink))
      box = box.union(CGRect(x: videoMargin, y: baseline - ascent, width: bounds.width, height: ascent + descent))
    }
    return LaidCaption(job: caption, size: size, lines: lines, box: box)
  }

  /**
   * What the darkness round `laid` makes of a white recording, with the light
   * as it is under the caption while it is on (each state it comes to, and the
   * one it starts in): white and lilac at 4.5:1 or more where the darkness is
   * weakest under any line's ink, or it fails; and the brightest the app's
   * white comes through in the lines' rectangle outside the holes (`under`).
   */
  let lilacL = { () -> CGFloat in let k = components(lilac); return luminance(k[0], k[1], k[2]) }()
  func settle(_ laid: inout LaidCaption, until end: Double) {
    let dark = [Dark(rect: laid.box, on: 1)]
    // Where a line's ink is least covered: its corners; and, for the test to
    // read, just beside its first and last letters, where no letter is.
    var corners: [CGPoint] = []
    var samples: [CGPoint] = []
    for l in laid.lines {
      corners += [CGPoint(x: l.ink.minX, y: l.ink.minY), CGPoint(x: l.ink.maxX, y: l.ink.minY),
                  CGPoint(x: l.ink.minX, y: l.ink.maxY), CGPoint(x: l.ink.maxX, y: l.ink.maxY)]
      samples += [CGPoint(x: l.ink.minX - 6, y: l.ink.midY), CGPoint(x: l.ink.maxX + 6, y: l.ink.midY)]
    }
    var states = [lightAt(job.lights, laid.job.start)]
    for l in job.lights where l.t > laid.job.start && l.t < end { states.append(lightAt(job.lights, l.t + lightMove)) }
    let worst = { (points: [CGPoint]) -> (white: CGFloat, lilac: CGFloat) in
      var through: CGFloat = 0
      for p in points {
        for s in states { through = max(through, 1 - CGFloat(shadeAlpha(s, dark, Double(p.x), Double(p.y)))) }
      }
      // White under the shade: what comes through of it, and the shade's colour for the rest.
      let k = (0..<3).map { through + (1 - through) * shadeRGB[$0] }
      let L = luminance(k[0], k[1], k[2])
      return (1.05 / (L + 0.05), (lilacL + 0.05) / (L + 0.05))
    }
    let got = worst(corners + samples)
    guard got.lilac >= leastContrast else { fail("a hole lets too much through under the caption for \(leastContrast):1: \(laid.job.text)") }
    laid.contrast = got
    // The test's points: the weakest of them.
    laid.samples = samples.sorted { worst([$0]).lilac < worst([$1]).lilac }
    // The app's white in the rectangle, outside the holes: its brightest channel, of 255.
    var under: CGFloat = 0
    for s in states {
      var y = laid.box.minY
      while y <= laid.box.maxY {
        var x = laid.box.minX
        while x <= laid.box.maxX {
          let free = s.holes.allSatisfy { lit($0, Double(x), Double(y)) == 0 }
          if free {
            let a = CGFloat(shadeAlpha(s, dark, Double(x), Double(y)))
            under = max(under, (0..<3).map { 255 * ((1 - a) + a * shadeRGB[$0]) }.max()!)
          }
          x += 4
        }
        y += 4
      }
    }
    laid.under = under
  }

  var captions = job.captions.map { lay($0, size: $0.kind == "typed" ? hookSize : size) }
  for i in captions.indices { settle(&captions[i], until: captions[i].job.end) }

  // The finale: one line, its struck part, the word over it.
  let f = job.finale
  guard let struckRange = f.line.range(of: f.struck) else { fail("the finale's line has no \(f.struck)") }
  var finaleLaid = lay(VCaption(kind: "play", text: f.line, start: f.start, end: f.end, centre: f.centre), size: finaleSize)
  let fl = finaleLaid.lines[0]
  let ns = NSRange(struckRange, in: f.line)
  // The line upright throughout: its struck part apart only to fade on its own.
  let froman = playFont(fonts.roman, size: finaleSize)
  let beforeLine = playLine(f.line, emphasis: ns, roman: froman, italic: froman, text: white, accent: clear)
  let struckLine = playLine(f.line, emphasis: ns, roman: froman, italic: froman, text: clear, accent: white)
  let struckLeft = fl.x + CTLineGetOffsetForStringIndex(beforeLine, ns.location, nil)
  let struckRight = fl.x + CTLineGetOffsetForStringIndex(beforeLine, ns.location + ns.length, nil)
  let lineTop = fl.baseline - CTFontGetAscent(froman), lineH = finaleSize * videoLineHeight
  let handSize = (finaleSize * 1.22).rounded()
  let hand = variableFont(job.fonts.hand, size: handSize, axes: [wghtAxis: 700])
  let insertLine = line(f.insert, font: hand, colour: lilac)
  let insertWidth = width(insertLine)
  let insertBottom = lineTop + lineH - 0.92 * lineH
  let insertBaseline = insertBottom - CTFontGetDescent(hand)
  let insertCentre = CGPoint(x: (struckLeft + struckRight) / 2, y: insertBaseline - CTFontGetAscent(hand) / 2)
  guard insertCentre.x + insertWidth / 2 <= W - 8 else { fail("the finale's \(f.insert) runs off the frame") }
  // The darkness round the line and the word over it.
  finaleLaid = LaidCaption(job: finaleLaid.job, size: finaleSize, lines: finaleLaid.lines,
                           box: finaleLaid.box.union(CGRect(x: insertCentre.x - insertWidth / 2, y: insertBaseline - CTFontGetAscent(hand),
                                                            width: insertWidth, height: CTFontGetAscent(hand))))
  settle(&finaleLaid, until: f.end)
  // The pencil: the storyboard's stroke, in a box over the struck part (100 × 24 of it).
  let pen: [CGPoint] = {
    let segments: [[(Double, Double)]] = [[(2, 15), (14, 9), (24, 18), (36, 12)], [(36, 12), (48, 6), (58, 8), (70, 13)], [(70, 13), (82, 18), (90, 16), (98, 9)]]
    let span = struckRight - struckLeft
    let bx = struckLeft - 0.04 * span, bw = 1.08 * span, by = lineTop + 0.30 * lineH, bh = 0.46 * lineH
    var points: [CGPoint] = []
    for s in segments {
      for i in 0...40 {
        let t = Double(i) / 40, u = 1 - t
        let x = u * u * u * s[0].0 + 3 * u * u * t * s[1].0 + 3 * u * t * t * s[2].0 + t * t * t * s[3].0
        let y = u * u * u * s[0].1 + 3 * u * u * t * s[1].1 + 3 * u * t * t * s[2].1 + t * t * t * s[3].1
        points.append(CGPoint(x: bx + CGFloat(x) / 100 * bw, y: by + CGFloat(y) / 24 * bh))
      }
    }
    return points
  }()
  let penLengths: [CGFloat] = pen.indices.map { i in i == 0 ? 0 : hypot(pen[i].x - pen[i - 1].x, pen[i].y - pen[i - 1].y) }
  let penTotal = penLengths.reduce(0, +)

  // The closing card, drawn once.
  func canvas(_ data: UnsafeMutableRawPointer? = nil) -> CGContext {
    guard let context = CGContext(data: data, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fail("no context") }
    context.translateBy(x: 0, y: H)
    context.scaleBy(x: 1, y: -1)
    context.interpolationQuality = .high
    return context
  }
  func drawLine(_ context: CGContext, _ l: CTLine, x: CGFloat, baseline: CGFloat) {
    context.saveGState()
    context.translateBy(x: x, y: baseline)
    context.scaleBy(x: 1, y: -1)
    context.textPosition = .zero
    CTLineDraw(l, context)
    context.restoreGState()
  }
  let cardContext = canvas()
  cardContext.setFillColor(colour(c.background))
  cardContext.fill(CGRect(x: 0, y: 0, width: W, height: H))
  let glow = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                        colors: [colour(c.accent).copy(alpha: 0.22)!, colour(c.accent).copy(alpha: 0)!] as CFArray, locations: [0, 1])!
  cardContext.drawRadialGradient(glow, startCenter: CGPoint(x: W / 2, y: H * 0.38), startRadius: 0,
                                 endCenter: CGPoint(x: W / 2, y: H * 0.38), endRadius: W * 0.85, options: [])
  let mark = loadImage(job.mark)
  let markHeight: CGFloat = 220
  let markWidth = markHeight * CGFloat(mark.width) / CGFloat(mark.height)
  let markTop = (H * 0.326).rounded()
  cardContext.saveGState()
  cardContext.translateBy(x: (W - markWidth) / 2, y: markTop + markHeight)
  cardContext.scaleBy(x: 1, y: -1)
  cardContext.draw(mark, in: CGRect(x: 0, y: 0, width: markWidth, height: markHeight))
  cardContext.restoreGState()
  let nameFont = variableFont(job.fonts.brand, size: 96, axes: [wghtAxis: 700])
  let nameLine = line(job.name, font: nameFont, colour: colour(c.text))
  let nameBaseline = markTop + markHeight + 35 + CTFontGetAscent(nameFont)
  drawLine(cardContext, nameLine, x: (W - width(nameLine)) / 2, baseline: nameBaseline)
  // The sign-in line: Inter Tight 500, 40 px, the text's colour at 72 %, broken only where captions.json breaks it.
  let signFont = variableFont(job.fonts.brand, size: signInSize, axes: [wghtAxis: 500])
  let signLines = job.card.signIn.components(separatedBy: "\n")
  let signColour = colour(c.text).copy(alpha: 0.72)!
  let signLh = signInSize * 1.25
  let signTop = H * 0.89 - signLh * CGFloat(signLines.count) / 2
  var signWidths: [CGFloat] = []
  for (i, string) in signLines.enumerated() {
    let l = line(string, font: signFont, colour: signColour)
    signWidths.append(width(l))
    guard width(l) <= textWidth else { fail("the sign-in line does not fit at \(signInSize) px: \(string)") }
    drawLine(cardContext, l, x: (W - width(l)) / 2,
             baseline: signTop + CGFloat(i) * signLh + (signLh - CTFontGetAscent(signFont) - CTFontGetDescent(signFont)) / 2 + CTFontGetAscent(signFont))
  }
  guard let cardImage = cardContext.makeImage() else { fail("no card") }

  // One frame after another.
  let bytes = w * h * 4
  let frame = UnsafeMutableRawPointer.allocate(byteCount: bytes, alignment: 16)
  let shadeBuffer = UnsafeMutableRawPointer.allocate(byteCount: bytes, alignment: 16)
  let output = UnsafeMutableRawPointer.allocate(byteCount: bytes, alignment: 16)
  var shadeKey = ""
  let context = canvas(frame)
  let plainRow = [UInt8](repeating: 0, count: w * 4)

  /** The shade of a frame: its light state, the captions' darkness in it — worked out pixel by pixel only round the holes and the captions. */
  func drawShade(_ s: LightState, _ darks: [Dark]) {
    let key = s.holes.map { String(format: "%.1f,%.1f,%.1f,%.1f,%.1f", $0.x, $0.y, $0.w, $0.h, $0.r) }.joined(separator: ";") + String(format: "|%.4f", s.dim)
      + darks.map { String(format: "|%.1f,%.1f,%.1f,%.1f,%.3f", $0.rect.minX, $0.rect.minY, $0.rect.width, $0.rect.height, $0.on) }.joined()
    if key == shadeKey { return }
    shadeKey = key
    let a = s.dim
    var row = plainRow
    for x in 0..<w {
      row[x * 4] = UInt8((shadeRGB[0] * CGFloat(a) * 255).rounded()); row[x * 4 + 1] = UInt8((shadeRGB[1] * CGFloat(a) * 255).rounded())
      row[x * 4 + 2] = UInt8((shadeRGB[2] * CGFloat(a) * 255).rounded()); row[x * 4 + 3] = UInt8((a * 255).rounded())
    }
    let p = shadeBuffer.assumingMemoryBound(to: UInt8.self)
    row.withUnsafeBufferPointer { r in for y in 0..<h { (p + y * w * 4).update(from: r.baseAddress!, count: w * 4) } }
    let f = Double(lightFeather)
    let reachX = Double(darkPad.width + darkFeather.width), reachY = Double(darkPad.height + darkFeather.height)
    let regions = s.holes.filter { min($0.w, $0.h) > 0 }.map { (x: $0.x - f, y: $0.y - f, r: $0.x + $0.w + f, b: $0.y + $0.h + f) }
      + darks.filter { $0.on > 0 }.map { (x: Double($0.rect.minX) - reachX, y: Double($0.rect.minY) - reachY, r: Double($0.rect.maxX) + reachX, b: Double($0.rect.maxY) + reachY) }
    for region in regions {
      let x0 = max(0, Int(region.x)), x1 = min(w - 1, Int(region.r))
      let y0 = max(0, Int(region.y)), y1 = min(h - 1, Int(region.b))
      guard x0 <= x1, y0 <= y1 else { continue }
      for y in y0...y1 {
        for x in x0...x1 {
          let alpha = shadeAlpha(s, darks, Double(x) + 0.5, Double(y) + 0.5)
          let o = (y * w + x) * 4
          p[o] = UInt8((shadeRGB[0] * CGFloat(alpha) * 255).rounded()); p[o + 1] = UInt8((shadeRGB[1] * CGFloat(alpha) * 255).rounded())
          p[o + 2] = UInt8((shadeRGB[2] * CGFloat(alpha) * 255).rounded()); p[o + 3] = UInt8((alpha * 255).rounded())
        }
      }
    }
  }

  func drawTap(_ tap: VTap, _ t: Double) {
    let tau = t - tap.t
    guard tau >= 0 && tau < 0.62 else { return }
    var op = 1.0, sc = 0.94, ripple = 0.0, rippleAlpha = 0.0
    if tau < 0.09 { op = tau / 0.09; sc = 1.3 - 0.36 * op }
    else if tau >= 0.24 { let q = (tau - 0.24) / 0.38; op = 1 - q; sc = 0.94 + 0.16 * q; ripple = 44 + 31 * q; rippleAlpha = 0.8 * (1 - q) }
    let centre = CGPoint(x: tap.x, y: tap.y)
    let r = CGFloat(44 * sc)
    context.saveGState()
    if rippleAlpha > 0 {
      context.setStrokeColor(white.copy(alpha: CGFloat(rippleAlpha))!)
      context.setLineWidth(4)
      context.strokeEllipse(in: CGRect(x: centre.x - CGFloat(ripple), y: centre.y - CGFloat(ripple), width: CGFloat(2 * ripple), height: CGFloat(2 * ripple)))
    }
    // A thin dark ring outside, so it shows on white too; the circle: white at 30 %, its edge at 95 %, 5 px.
    context.setStrokeColor(shade.copy(alpha: CGFloat(0.4 * op))!)
    context.setLineWidth(3)
    context.strokeEllipse(in: CGRect(x: centre.x - r - 1.5, y: centre.y - r - 1.5, width: 2 * r + 3, height: 2 * r + 3))
    let inner = CGRect(x: centre.x - r + 2.5, y: centre.y - r + 2.5, width: 2 * r - 5, height: 2 * r - 5)
    context.setFillColor(white.copy(alpha: CGFloat(0.3 * op))!)
    context.fillEllipse(in: inner)
    context.setStrokeColor(white.copy(alpha: CGFloat(0.95 * op))!)
    context.setLineWidth(5)
    context.strokeEllipse(in: inner)
    context.restoreGState()
  }

  /** A caption at `t` (its darkness is the shade's, drawShade): each line rising in, its main word after it; the hook typed. */
  func drawCaption(_ laid: LaidCaption, _ t: Double) {
    let local = t - laid.job.start
    guard local >= 0 && t < laid.job.end else { return }
    let em = Double(laid.size)
    context.saveGState()
    context.setShadow(offset: .zero, blur: 0.35 * laid.size, color: shade.copy(alpha: 0.7))
    if laid.job.kind == "typed" {
      // Letter by letter from 0.15 s, in about 0.95 s; a lilac caret blinking after the last.
      let total = laid.lines.reduce(laid.lines.count - 1) { $0 + ($1.text as NSString).length }
      var left = max(0, min(total, Int(((local - 0.15) / 0.95 * Double(total)).rounded(.down))))
      var caret: CGPoint? = nil
      for l in laid.lines {
        let n = (l.text as NSString).length
        let shown = min(n, left)
        if shown > 0 || caret == nil {
          context.saveGState()
          let end = CTLineGetOffsetForStringIndex(l.upright, shown, nil)
          context.clip(to: CGRect(x: l.x - 40, y: l.baseline - laid.size * 1.5, width: end + 40 + (shown == n ? 80 : 0), height: laid.size * 2.2))
          drawLine(context, l.upright, x: l.x, baseline: l.baseline)
          drawLine(context, l.key, x: l.x, baseline: l.baseline)
          context.restoreGState()
          caret = CGPoint(x: l.x + end, y: l.baseline)
        }
        left -= n + 1
        if left < 0 { break }
      }
      if let at = caret, local.truncatingRemainder(dividingBy: 1) < 0.5 {
        context.setShadow(offset: .zero, blur: 0, color: nil)
        context.setFillColor(lilac)
        context.fill(CGRect(x: at.x + 0.05 * laid.size, y: at.y - 0.80 * laid.size, width: 0.06 * laid.size, height: 0.86 * laid.size))
      }
    } else {
      for (i, l) in laid.lines.enumerated() {
        let a = local - 0.14 * Double(i)
        let lineAlpha = ease(clamp01(a / 0.5)), lineRise = (1 - rise(clamp01(a / 0.55))) * 0.25 * em
        let k = a - 0.22
        let keyAlpha = ease(clamp01(k / 0.45)), keyRise = (1 - rise(clamp01(k / 0.5))) * 0.14 * em
        context.setAlpha(CGFloat(lineAlpha))
        drawLine(context, l.upright, x: l.x, baseline: l.baseline + CGFloat(lineRise))
        context.setAlpha(CGFloat(lineAlpha * keyAlpha))
        drawLine(context, l.key, x: l.x, baseline: l.baseline + CGFloat(lineRise + keyRise))
      }
    }
    context.restoreGState()
  }

  /** The finale at `t`: the line in, the pencil through its struck part, the word over it. */
  func drawFinale(_ t: Double) {
    let local = t - f.start
    guard local >= 0.15 && t < f.end else { return }
    let em = Double(finaleSize)
    let on = local - 0.15
    let lineAlpha = ease(clamp01(on / 0.5)), lineRise = (1 - rise(clamp01(on / 0.55))) * 0.25 * em
    let after = local - 1.35
    let struckAlpha = 1 - 0.55 * ease(clamp01(after / 0.3))
    context.saveGState()
    context.setShadow(offset: .zero, blur: 0.35 * finaleSize, color: shade.copy(alpha: 0.7))
    context.setAlpha(CGFloat(lineAlpha))
    drawLine(context, beforeLine, x: fl.x, baseline: fl.baseline + CGFloat(lineRise))
    context.setAlpha(CGFloat(lineAlpha * struckAlpha))
    drawLine(context, struckLine, x: fl.x, baseline: fl.baseline + CGFloat(lineRise))
    context.restoreGState()
    // The pencil, from 0.8 s, in 0.45 s.
    let drawn = easeOut(clamp01((local - 0.8) / 0.45))
    if drawn > 0 {
      context.saveGState()
      context.setStrokeColor(lilac)
      context.setLineWidth(9.7)
      context.setLineCap(.round)
      context.setLineJoin(.round)
      let goal = CGFloat(drawn) * penTotal
      var gone: CGFloat = 0
      context.move(to: pen[0])
      for i in 1..<pen.count {
        if gone + penLengths[i] >= goal {
          let part = penLengths[i] > 0 ? (goal - gone) / penLengths[i] : 0
          context.addLine(to: CGPoint(x: pen[i - 1].x + (pen[i].x - pen[i - 1].x) * part, y: pen[i - 1].y + (pen[i].y - pen[i - 1].y) * part))
          break
        }
        gone += penLengths[i]
        context.addLine(to: pen[i])
      }
      context.strokePath()
      context.restoreGState()
    }
    // The word over it, in hand, tilted −5°, from 1.35 s in 0.3 s.
    if after > 0 {
      let p = ease(clamp01(after / 0.3))
      context.saveGState()
      context.setShadow(offset: .zero, blur: 0.35 * finaleSize, color: shade.copy(alpha: 0.7))
      context.setAlpha(CGFloat(p))
      context.translateBy(x: insertCentre.x, y: insertCentre.y + CGFloat((1 - p) * 0.25) * handSize)
      context.rotate(by: -5 * .pi / 180)
      drawLine(context, insertLine, x: -insertWidth / 2, baseline: insertBaseline - insertCentre.y)
      context.restoreGState()
    }
  }

  for n in 0..<job.frames {
    let t = Double(n) / Double(job.fps)
    // The darkness round each caption on screen, fading in with it; the finale's with its line.
    var darks: [Dark] = []
    for laid in captions where t >= laid.job.start && t < laid.job.end {
      darks.append(Dark(rect: laid.box, on: ease(clamp01((t - laid.job.start) / 0.25))))
    }
    if t >= f.start + 0.15 && t < f.end { darks.append(Dark(rect: finaleLaid.box, on: ease(clamp01((t - f.start - 0.15) / 0.25)))) }
    drawShade(lightAt(job.lights, t), darks)
    frame.copyMemory(from: shadeBuffer, byteCount: bytes)
    for tap in job.taps { drawTap(tap, t) }
    for laid in captions { drawCaption(laid, t) }
    drawFinale(t)
    let cardAlpha = clamp01((t - job.card.start) / job.card.dissolve)
    if cardAlpha > 0 {
      context.saveGState()
      context.setAlpha(CGFloat(cardAlpha))
      context.translateBy(x: 0, y: H)
      context.scaleBy(x: 1, y: -1)
      context.draw(cardImage, in: CGRect(x: 0, y: 0, width: W, height: H))
      context.restoreGState()
    }
    context.flush()
    // Straight alpha for ffmpeg's blend (montage.mjs): Core Graphics draws premultiplied.
    var buffer = vImage_Buffer(data: frame, height: vImagePixelCount(h), width: vImagePixelCount(w), rowBytes: w * 4)
    var straight = vImage_Buffer(data: output, height: vImagePixelCount(h), width: vImagePixelCount(w), rowBytes: w * 4)
    guard vImageUnpremultiplyData_RGBA8888(&buffer, &straight, vImage_Flags(kvImageNoFlags)) == kvImageNoError else { fail("cannot unpremultiply") }
    if fwrite(output, 1, bytes, stdout) != bytes { fail("the encoder stopped taking frames at \(n) of \(job.frames)") }
  }
  fflush(stdout)

  func box(_ r: CGRect) -> [String: CGFloat] { ["left": r.minX, "top": r.minY, "right": r.maxX, "bottom": r.maxY] }
  func described(_ laid: LaidCaption) -> [String: Any] {
    ["text": laid.job.text, "kind": laid.job.kind, "start": laid.job.start, "end": laid.job.end, "size": laid.size,
     "lines": laid.lines.map(\.text), "box": box(laid.box), "inks": laid.lines.map { box($0.ink) },
     "emphasis": laid.lines.compactMap { l -> [String: CGFloat]? in
       guard let r = l.emphasis else { return nil }
       let a = l.x + CTLineGetOffsetForStringIndex(l.upright, r.location, nil), b = l.x + CTLineGetOffsetForStringIndex(l.upright, r.upperBound, nil)
       return ["left": a, "right": b, "top": l.ink.minY, "bottom": l.ink.maxY]
     },
     "dark": captionDark, "under": laid.under, "contrast": ["white": laid.contrast.white, "lilac": laid.contrast.lilac],
     "samples": laid.samples.map { ["x": $0.x, "y": $0.y] }]
  }
  let all = captions + [finaleLaid]
  let manifest: [String: Any] = [
    "frames": job.frames, "fontSize": size, "hookSize": hookSize,
    "fonts": [playFont(fonts.roman, size: size), playFont(fonts.italic, size: size), hand, signFont].map(fontFile),
    "captions": captions.map(described),
    "finale": described(finaleLaid).merging(["fontSize": finaleSize, "insertSize": handSize,
                                             "struck": ["left": struckLeft, "right": struckRight],
                                             "insert": ["x": insertCentre.x, "y": insertCentre.y, "width": insertWidth]]) { a, _ in a },
    "contrast": ["white": all.map(\.contrast.white).min()!, "lilac": all.map(\.contrast.lilac).min()!],
    "signIn": ["lines": signLines, "fontSize": signInSize, "widths": signWidths, "top": signTop, "bottom": signTop + signLh * CGFloat(signLines.count)],
    "card": ["markTop": markTop, "markHeight": markHeight, "nameBaseline": nameBaseline],
  ]
  let data = try! JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
  FileManager.default.createFile(atPath: job.manifest, contents: data)
}

func draw(_ job: Job) {
  guard job.captions.count == job.shots.count else { fail("captions and screenshots differ in number") }
  let c = job.colours
  let shotHeight = H - shotTop - shotBottomMargin
  let shotWidth = (shotHeight * 1320 / 2868).rounded()
  let shot = CGRect(x: ((W - shotWidth) / 2).rounded(), y: shotTop, width: shotWidth, height: shotHeight)
  // One size of type for the language: the largest at which every line of
  // every caption fits the window's width, never above the preferred one.
  let size = typeSize(job.captions, fonts: job.fonts, limit: shot.width)
  let drawnWith = [playFont(job.fonts.roman, size: size), playFont(job.fonts.italic, size: size)].map(fontFile)

  var pictures: [[String: Any]] = []
  for size in job.outputs { try? FileManager.default.createDirectory(atPath: size.dir, withIntermediateDirectories: true) }
  for (index, caption) in job.captions.enumerated() {
    let image = loadImage(job.shots[index])
    let lines = marked(caption).map(\.text)
    for (n, out) in job.outputs.enumerated() {
      guard let context = CGContext(data: nil, width: out.width, height: out.height, bitsPerComponent: 8, bytesPerRow: 0,
                                    space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fail("no context") }
      let scale = CGFloat(out.width) / W
      // Top-down coordinates of the 1320×2868 frame.
      context.translateBy(x: 0, y: CGFloat(out.height))
      context.scaleBy(x: scale, y: -scale)
      context.interpolationQuality = .high

      drawBackground(context, c)
      let laid = drawCaption(context, caption, fonts: job.fonts, size: size, left: shot.minX, colours: c)

      // The screenshot, whole, its corners rounded, a hairline round it.
      let radius = shot.width * cornerShare
      let rounded = CGPath(roundedRect: shot, cornerWidth: radius, cornerHeight: radius, transform: nil)
      context.saveGState()
      context.addPath(rounded)
      context.clip()
      context.translateBy(x: shot.minX, y: shot.maxY)
      context.scaleBy(x: 1, y: -1)
      context.draw(image, in: CGRect(origin: .zero, size: shot.size))
      context.restoreGState()
      context.addPath(rounded)
      context.setStrokeColor(colour(c.line))
      context.setLineWidth(3)
      context.strokePath()

      guard let picture = context.makeImage() else { fail("nothing drawn") }
      let file = (out.dir as NSString).appendingPathComponent(String(format: "%02d.png", index + 1))
      writePng(picture, to: file)
      if n == 0 {
        var picture: [String: Any] = ["file": file, "width": out.width, "height": out.height, "lines": lines, "fontSize": size,
                                      "lineBoxes": laid.lines,
                                      "shot": ["left": shot.minX, "top": shot.minY, "width": shot.width, "height": shot.height]]
        if let emphasis = laid.emphasis { picture["emphasis"] = emphasis }
        pictures.append(picture)
      }
    }
  }
  let manifest: [String: Any] = ["fontSize": size, "lineHeight": lineHeight, "fonts": drawnWith,
                                 "captionBottom": captionBottom, "pictures": pictures]
  let data = try! JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
  FileHandle.standardOutput.write(data)
}

/** For each picture, the lines of text between `top` and `bottom` (px from the top), top first. */
func read(_ files: [String], top: CGFloat, bottom: CGFloat, language: String) {
  let all: [[String]] = files.map { file in
    let image = loadImage(file)
    guard let band = image.cropping(to: CGRect(x: 0, y: top, width: CGFloat(image.width), height: bottom - top)) else { fail("cannot crop") }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = [language]
    request.usesLanguageCorrection = false
    do { try VNImageRequestHandler(cgImage: band).perform([request]) } catch { fail("\(error)") }
    return (request.results ?? [])
      .sorted { $0.boundingBox.minY > $1.boundingBox.minY }
      .compactMap { $0.topCandidates(1).first?.string }
  }
  let data = try! JSONSerialization.data(withJSONObject: all)
  FileHandle.standardOutput.write(data)
}

/** The pictures side by side, each `height` px tall, 24 px apart, on the background: a preview to look over. */
func sheet(_ out: String, height: Int, background: String, files: [String]) {
  let images = files.map(loadImage)
  let widths = images.map { Int((CGFloat($0.width) * CGFloat(height) / CGFloat($0.height)).rounded()) }
  let gap = 24
  let width = widths.reduce(0, +) + gap * (images.count + 1)
  guard let context = CGContext(data: nil, width: width, height: height + 2 * gap, bitsPerComponent: 8, bytesPerRow: 0,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fail("no context") }
  context.interpolationQuality = .high
  context.setFillColor(colour(background))
  context.fill(CGRect(x: 0, y: 0, width: width, height: height + 2 * gap))
  var x = gap
  for (image, w) in zip(images, widths) {
    context.draw(image, in: CGRect(x: x, y: gap, width: w, height: height))
    x += w + gap
  }
  guard let picture = context.makeImage() else { fail("nothing drawn") }
  writePng(picture, to: out)
}

let args = CommandLine.arguments
switch args.count > 1 ? args[1] : "" {
case "draw" where args.count == 3:
  guard let data = FileManager.default.contents(atPath: args[2]),
        let job = try? JSONDecoder().decode(Job.self, from: data) else { fail("cannot read the job \(args[2])") }
  draw(job)
case "video" where args.count == 3:
  guard let data = FileManager.default.contents(atPath: args[2]),
        let job = try? JSONDecoder().decode(VideoJob.self, from: data) else { fail("cannot read the video job \(args[2])") }
  video(job)
case "sheet" where args.count >= 6:
  sheet(args[2], height: Int(args[3]) ?? 600, background: args[4], files: Array(args[5...]))
case "read" where args.count >= 5:
  // <bottom>, or <top>:<bottom>
  let edges = args[2].split(separator: ":").map { CGFloat(Double($0) ?? 0) }
  read(Array(args[4...]), top: edges.count > 1 ? edges[0] : 0, bottom: edges.last ?? 0, language: args[3])
default:
  fail("usage: compose draw <job.json> | compose video <video.json> | compose read [<top>:]<bottom> <language> <picture.png>… | compose sheet …")
}
