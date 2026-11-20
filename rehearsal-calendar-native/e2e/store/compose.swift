// The App Store's pictures, drawn (T-274). Called by compose.mjs, which says
// what to draw in a job file; nothing here reads captions.json or styles.css.
//
//   compose draw <job.json>                    the pictures; prints what it drew, as JSON
//   compose read [<top>:]<bottom> <lang> <picture.png>…  each picture's lines of text between top and bottom, as JSON
//   compose sheet <out.png> <height> <#bg> <picture.png>…  the pictures in a row, small, to look over
//   compose video <video.json>                 the preview video's overlays (T-285); prints them, as JSON
//
// Every picture is laid out on the 1320×2868 of the iPhone 17 Pro Max and drawn
// at each size the job asks for, scaled — not drawn once and resampled — so
// the 6.3" set's type is as sharp as the 6.9"'s. No alpha channel: App Store
// Connect refuses a screenshot that has one.
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

struct Size: Codable { let dir: String; let width: Int; let height: Int }
struct Colours: Codable { let background: String; let text: String; let accent: String; let line: String }
struct Job: Codable { let captions: [String]; let shots: [String]; let outputs: [Size]; let font: String; let colours: Colours }

// The layout, in the 1320×2868 frame.
let W: CGFloat = 1320, H: CGFloat = 2868
let textWidth: CGFloat = 1140            // 90 each side
let captionTop: CGFloat = 110, captionBottom: CGFloat = 420
let preferredSize: CGFloat = 104         // the type when every line fits at it
let lineHeight: CGFloat = 1.16           // of the type's size
let shotTop: CGFloat = 470, shotBottomMargin: CGFloat = 80
let cornerShare: CGFloat = 0.12          // the screenshot's corner radius, of its width

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

/** SF Pro from the system's own file, bold: its weight axis at 700. */
func boldFont(_ file: String, size: CGFloat) -> CTFont {
  guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: file) as CFURL) as? [CTFontDescriptor],
        let first = descriptors.first else { fail("no font in \(file)") }
  let bold = CTFontDescriptorCreateCopyWithVariation(first, NSNumber(value: 0x7767_6874) as CFNumber, 700)
  return CTFontCreateWithFontDescriptor(bold, size, nil)
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

/** One size of type for a language: the largest at which every line of every caption fits, never above the preferred one. */
func typeSize(_ captions: [String], font file: String, colour text: CGColor) -> CGFloat {
  let probe = boldFont(file, size: 100)
  let widest = captions.flatMap { $0.components(separatedBy: "\n") }
    .map { width(line($0, font: probe, colour: text)) }.max() ?? 1
  return min(preferredSize, floor(textWidth * 100 / widest))
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

/** The caption, its lines centred, the block centred in its band, the lines where the caption breaks them. */
func drawCaption(_ context: CGContext, _ lines: [String], font: CTFont, size: CGFloat, colour text: CGColor) {
  let lh = size * lineHeight
  let ascent = CTFontGetAscent(font), descent = CTFontGetDescent(font)
  let blockTop = captionTop + (captionBottom - captionTop - lh * CGFloat(lines.count)) / 2
  for (i, string) in lines.enumerated() {
    let l = line(string, font: font, colour: text)
    let baseline = blockTop + CGFloat(i) * lh + (lh - ascent - descent) / 2 + ascent
    context.saveGState()
    // Text the right way up in the flipped frame.
    context.translateBy(x: (W - width(l)) / 2, y: baseline)
    context.scaleBy(x: 1, y: -1)
    context.textPosition = .zero
    CTLineDraw(l, context)
    context.restoreGState()
  }
}

/**
 * The preview video's pictures (T-285), each `width`×`height` (886×1920), laid
 * out in the output's own pixels. Not the screenshots' look: the recording
 * fills the whole frame, and these go over it.
 *
 * - For every caption an overlay, clear but for the caption: its lines exactly
 *   as given (no line is ever broken here), bold SF Pro in white, one size for
 *   the language, at the top or the bottom of the frame as the shot asks, on a
 *   soft dark band only as tall as the text — solid under the lines, so white
 *   on it is at least 4.5:1 whatever the recording shows, fading out above and
 *   below.
 * - `dim.png`: the whole frame darkened, for the hook's shot to lift.
 * - `end.png`: the closing card, opaque: the landing's background and glow,
 *   its mark, the app's name and under it the sign-in line, and the last
 *   caption (the slogan) just where its overlay has it, without the band — to
 *   dissolve in over the last shot and its caption.
 */
struct VideoCaption: Codable { let text: String; let place: String }
struct VideoJob: Codable {
  let captions: [VideoCaption]; let signIn: String; let signInBreak: String
  let width: Int; let height: Int; let dir: String
  let font: String; let colours: Colours; let mark: String; let name: String
}

// The video's layout, in its own pixels (886 wide).
let videoMargin: CGFloat = 48             // the text's least distance from the frame's sides
let videoPreferred: CGFloat = 72          // the caption's type when every line fits at it
let videoTop: CGFloat = 150               // a top caption's first line starts here: under the status bar
let videoBottom: CGFloat = 1740           // a bottom caption's last line ends here: over the home indicator
let bandAlpha: CGFloat = 0.85             // the band under the lines: white on it ≥ 4.5:1 even over white
let signInPreferred: CGFloat = 46, signInLeast: CGFloat = 40

/**
 * The largest whole size, `most` at most, at which every one of `lines` fits
 * `width` — measured at that size: SF Pro's widths do not scale exactly with it.
 */
func fittingSize(_ lines: [String], font file: String, width limit: CGFloat, most: CGFloat) -> CGFloat {
  let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
  let widest = { (size: CGFloat) -> CGFloat in
    let font = boldFont(file, size: size)
    return lines.map { width(line($0, font: font, colour: white)) }.max() ?? 0
  }
  var size = min(most, floor(limit * 100 / max(widest(100), 1)))
  while size > 1 && widest(size) > limit { size -= 1 }
  return size
}

/** The band's solid part and its whole extent, for a block of text from `top` to `bottom`. */
func band(top: CGFloat, bottom: CGFloat, size: CGFloat) -> (core: ClosedRange<CGFloat>, all: ClosedRange<CGFloat>) {
  let pad = size * 0.35, feather = size * 1.0
  return ((top - pad)...(bottom + pad), (top - pad - feather)...(bottom + pad + feather))
}

func video(_ job: VideoJob) {
  let c = job.colours
  let w = CGFloat(job.width), h = CGFloat(job.height)
  let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
  let textWidth = w - 2 * videoMargin
  // One size for the language: the widest line of every caption sets it.
  let allLines = job.captions.flatMap { $0.text.components(separatedBy: "\n") }
  let size = fittingSize(allLines, font: job.font, width: textWidth, most: videoPreferred)
  let font = boldFont(job.font, size: size)
  let lh = size * lineHeight
  let ascent = CTFontGetAscent(font), descent = CTFontGetDescent(font)
  try? FileManager.default.createDirectory(atPath: job.dir, withIntermediateDirectories: true)

  func canvas() -> CGContext {
    guard let context = CGContext(data: nil, width: job.width, height: job.height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fail("no context") }
    // Top-down coordinates.
    context.translateBy(x: 0, y: h)
    context.scaleBy(x: 1, y: -1)
    context.interpolationQuality = .high
    return context
  }
  func save(_ context: CGContext, _ name: String) -> String {
    guard let picture = context.makeImage() else { fail("nothing drawn") }
    let file = (job.dir as NSString).appendingPathComponent(name)
    writePng(picture, to: file)
    return file
  }
  func drawLine(_ context: CGContext, _ l: CTLine, x: CGFloat, baseline: CGFloat) {
    context.saveGState()
    context.translateBy(x: x, y: baseline)
    context.scaleBy(x: 1, y: -1)
    context.textPosition = .zero
    CTLineDraw(l, context)
    context.restoreGState()
  }

  var overlays: [[String: Any]] = []
  var lastCaption: (lines: [String], top: CGFloat) = ([], 0)
  for (index, caption) in job.captions.enumerated() {
    guard caption.place == "top" || caption.place == "bottom" else { fail("a caption goes at the top or the bottom: \(caption.place)") }
    let lines = caption.text.components(separatedBy: "\n")
    let blockHeight = lh * CGFloat(lines.count)
    let top = caption.place == "top" ? videoTop : videoBottom - blockHeight
    let (core, all) = band(top: top, bottom: top + blockHeight, size: size)
    let context = canvas()
    // The band: clear, rising to bandAlpha under the lines, falling back to clear.
    let black = { (a: CGFloat) in CGColor(srgbRed: 0, green: 0, blue: 0, alpha: a) }
    let span = all.upperBound - all.lowerBound
    let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                              colors: [black(0), black(bandAlpha), black(bandAlpha), black(0)] as CFArray,
                              locations: [0, (core.lowerBound - all.lowerBound) / span, (core.upperBound - all.lowerBound) / span, 1])!
    context.saveGState()
    context.clip(to: CGRect(x: 0, y: all.lowerBound, width: w, height: span))
    context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: all.lowerBound), end: CGPoint(x: 0, y: all.upperBound), options: [])
    context.restoreGState()
    var widths: [CGFloat] = []
    for (i, string) in lines.enumerated() {
      let l = line(string, font: font, colour: white)
      widths.append(width(l))
      drawLine(context, l, x: (w - width(l)) / 2, baseline: top + CGFloat(i) * lh + (lh - ascent - descent) / 2 + ascent)
    }
    lastCaption = (lines, top)
    let file = save(context, String(format: "%02d.png", index + 1))
    overlays.append(["file": file, "place": caption.place, "lines": lines, "widths": widths,
                     "text": ["top": top, "bottom": top + blockHeight],
                     "band": ["top": all.lowerBound.rounded(.down), "bottom": all.upperBound.rounded(.up),
                              "coreTop": core.lowerBound.rounded(.up), "coreBottom": core.upperBound.rounded(.down)]])
  }

  // The hook's darkness.
  let dim = canvas()
  dim.setFillColor(CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 0.62))
  dim.fill(CGRect(x: 0, y: 0, width: w, height: h))
  let dimFile = save(dim, "dim.png")

  // The closing card. The sign-in line in one line if it fits at signInLeast
  // or more, else broken where signInBreak says (after its colon; ru after
  // «Нужен вход») — never anywhere else.
  let end = canvas()
  end.setFillColor(colour(c.background))
  end.fill(CGRect(x: 0, y: 0, width: w, height: h))
  let glow = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                        colors: [colour(c.accent).copy(alpha: 0.22)!, colour(c.accent).copy(alpha: 0)!] as CFArray, locations: [0, 1])!
  end.drawRadialGradient(glow, startCenter: CGPoint(x: w / 2, y: h * 0.38), startRadius: 0,
                         endCenter: CGPoint(x: w / 2, y: h * 0.38), endRadius: w * 0.85, options: [])
  let fits = { (lines: [String]) -> CGFloat in fittingSize(lines, font: job.font, width: textWidth, most: signInPreferred) }
  var signLines = [job.signIn]
  var signSize = fits(signLines)
  if signSize < signInLeast {
    guard let regex = try? NSRegularExpression(pattern: job.signInBreak),
          let match = regex.firstMatch(in: job.signIn, range: NSRange(job.signIn.startIndex..., in: job.signIn)),
          let at = Range(match.range, in: job.signIn) else { fail("the sign-in line does not fit and has no place to break: \(job.signIn)") }
    signLines = [String(job.signIn[..<at.upperBound]).trimmingCharacters(in: .whitespaces),
                 String(job.signIn[at.upperBound...]).trimmingCharacters(in: .whitespaces)]
    signSize = fits(signLines)
  }
  guard signSize >= signInLeast else { fail("the sign-in line is under \(signInLeast) px even broken: \(signLines)") }
  let signFont = boldFont(job.font, size: signSize)
  let mark = loadImage(job.mark)
  let markHeight: CGFloat = 220
  let markWidth = markHeight * CGFloat(mark.width) / CGFloat(mark.height)
  let nameSize: CGFloat = 96
  let nameFont = boldFont(job.font, size: nameSize)
  let nameLine = line(job.name, font: nameFont, colour: colour(c.text))
  let signLh = signSize * 1.25
  // Mark, name, sign-in: one block, its middle a little above the frame's.
  let blockHeight = markHeight + 36 + nameSize * 1.1 + 40 + signLh * CGFloat(signLines.count)
  var y = h * 0.42 - blockHeight / 2
  end.saveGState()
  end.translateBy(x: (w - markWidth) / 2, y: y + markHeight)
  end.scaleBy(x: 1, y: -1)
  end.draw(mark, in: CGRect(x: 0, y: 0, width: markWidth, height: markHeight))
  end.restoreGState()
  y += markHeight + 36
  drawLine(end, nameLine, x: (w - width(nameLine)) / 2, baseline: y + CTFontGetAscent(nameFont))
  y += nameSize * 1.1 + 40
  let signTop = y
  for string in signLines {
    let l = line(string, font: signFont, colour: colour(c.text))
    drawLine(end, l, x: (w - width(l)) / 2, baseline: y + CTFontGetAscent(signFont))
    y += signLh
  }
  // The slogan, the last caption, where its overlay has it — but on the
  // card's own background, without the band: the card dissolves in over it.
  for (i, string) in lastCaption.lines.enumerated() {
    let l = line(string, font: font, colour: white)
    drawLine(end, l, x: (w - width(l)) / 2, baseline: lastCaption.top + CGFloat(i) * lh + (lh - ascent - descent) / 2 + ascent)
  }
  let endFile = save(end, "end.png")

  let manifest: [String: Any] = [
    "fontSize": size, "overlays": overlays, "dim": dimFile, "end": endFile,
    "signIn": ["lines": signLines, "fontSize": signSize, "top": signTop, "bottom": y],
  ]
  let data = try! JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
  FileHandle.standardOutput.write(data)
}

func draw(_ job: Job) {
  guard job.captions.count == job.shots.count else { fail("captions and screenshots differ in number") }
  let c = job.colours
  // One size of type for the language: the largest at which every line of
  // every caption fits, never above the preferred one.
  let size = typeSize(job.captions, font: job.font, colour: colour(c.text))
  let font = boldFont(job.font, size: size)
  let shotHeight = H - shotTop - shotBottomMargin
  let shotWidth = (shotHeight * 1320 / 2868).rounded()
  let shot = CGRect(x: ((W - shotWidth) / 2).rounded(), y: shotTop, width: shotWidth, height: shotHeight)

  var pictures: [[String: Any]] = []
  for size in job.outputs { try? FileManager.default.createDirectory(atPath: size.dir, withIntermediateDirectories: true) }
  for (index, caption) in job.captions.enumerated() {
    let image = loadImage(job.shots[index])
    let lines = caption.components(separatedBy: "\n")
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
      drawCaption(context, lines, font: font, size: size, colour: colour(c.text))

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
        pictures.append(["file": file, "width": out.width, "height": out.height, "lines": lines, "fontSize": size,
                         "shot": ["left": shot.minX, "top": shot.minY, "width": shot.width, "height": shot.height]])
      }
    }
  }
  let manifest: [String: Any] = ["fontSize": size, "captionBottom": captionBottom, "pictures": pictures]
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
