// The App Store's pictures, drawn (T-274). Called by compose.mjs, which says
// what to draw in a job file; nothing here reads captions.json or styles.css.
//
//   compose draw <job.json>                    the pictures; prints what it drew, as JSON
//   compose read <bottom> <lang> <picture.png>…  each picture's lines of text above `bottom`, as JSON
//   compose sheet <out.png> <height> <#bg> <picture.png>…  the pictures in a row, small, to look over
//   compose card <card.json>                   the preview video's overlays (T-275); prints them, as JSON
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
 * The preview video's pictures (T-275), each `width`×`height` (886×1920): for
 * every caption an overlay — the screenshots' look, its background, glow and
 * caption, with a hole where the screen recording shows through, its corners
 * rounded, a hairline round it — and the closing card: the landing's mark and
 * name filling that hole, to fade in over the last shot. The hole is in whole,
 * even pixels of the output, so the recording is scaled to it exactly.
 */
struct Card: Codable {
  let captions: [String]; let width: Int; let height: Int; let dir: String
  let font: String; let colours: Colours; let mark: String; let name: String
}

func card(_ job: Card) {
  let c = job.colours
  let size = typeSize(job.captions, font: job.font, colour: colour(c.text))
  let font = boldFont(job.font, size: size)
  let scale = CGFloat(job.width) / W
  // The screenshots' frame for the shot, in the output's even pixels.
  let even = { (v: CGFloat) -> CGFloat in (v / 2).rounded() * 2 }
  let shotHeight = H - shotTop - shotBottomMargin
  let holeH = even(shotHeight * scale), holeW = even(holeH * 1320 / 2868)
  let holeTop = even(shotTop * scale), holeLeft = even((CGFloat(job.width) - holeW) / 2)
  guard holeTop + holeH <= CGFloat(job.height) else { fail("no room for the recording in \(job.width)×\(job.height)") }
  // The hole back in the 1320-wide frame the drawing is laid out in.
  let hole = CGRect(x: holeLeft / scale, y: holeTop / scale, width: holeW / scale, height: holeH / scale)
  let radius = hole.width * cornerShare
  let rounded = CGPath(roundedRect: hole, cornerWidth: radius, cornerHeight: radius, transform: nil)
  try? FileManager.default.createDirectory(atPath: job.dir, withIntermediateDirectories: true)

  func canvas() -> CGContext {
    guard let context = CGContext(data: nil, width: job.width, height: job.height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fail("no context") }
    context.translateBy(x: 0, y: CGFloat(job.height))
    context.scaleBy(x: scale, y: -scale)
    context.interpolationQuality = .high
    return context
  }
  func save(_ context: CGContext, _ name: String) -> String {
    guard let picture = context.makeImage() else { fail("nothing drawn") }
    let file = (job.dir as NSString).appendingPathComponent(name)
    writePng(picture, to: file)
    return file
  }

  var overlays: [String] = []
  for (index, caption) in job.captions.enumerated() {
    let context = canvas()
    drawBackground(context, c)
    drawCaption(context, caption.components(separatedBy: "\n"), font: font, size: size, colour: colour(c.text))
    // The hole, cleared to nothing: the recording under it shows.
    context.saveGState()
    context.setBlendMode(.clear)
    context.addPath(rounded)
    context.fillPath()
    context.restoreGState()
    context.addPath(rounded)
    context.setStrokeColor(colour(c.line))
    context.setLineWidth(3)
    context.strokePath()
    overlays.append(save(context, String(format: "%02d.png", index + 1)))
  }

  // The closing card: the hole filled with the background, the landing's mark
  // and the app's name in the middle of it; clear around the hole.
  let end = canvas()
  end.saveGState()
  end.addPath(rounded)
  end.clip()
  drawBackground(end, c)
  let mark = loadImage(job.mark)
  let markHeight = hole.height * 0.2
  let markWidth = markHeight * CGFloat(mark.width) / CGFloat(mark.height)
  let nameSize = markHeight * 0.42
  let nameFont = boldFont(job.font, size: nameSize)
  let nameLine = line(job.name, font: nameFont, colour: colour(c.text))
  let gap = markHeight * 0.18
  let blockTop = hole.midY - (markHeight + gap + nameSize) / 2
  end.saveGState()
  end.translateBy(x: hole.midX - markWidth / 2, y: blockTop + markHeight)
  end.scaleBy(x: 1, y: -1)
  end.draw(mark, in: CGRect(x: 0, y: 0, width: markWidth, height: markHeight))
  end.restoreGState()
  end.saveGState()
  end.translateBy(x: hole.midX - width(nameLine) / 2, y: blockTop + markHeight + gap + CTFontGetAscent(nameFont))
  end.scaleBy(x: 1, y: -1)
  end.textPosition = .zero
  CTLineDraw(nameLine, end)
  end.restoreGState()
  end.restoreGState()
  end.addPath(rounded)
  end.setStrokeColor(colour(c.line))
  end.setLineWidth(3)
  end.strokePath()
  let endFile = save(end, "end.png")

  let manifest: [String: Any] = [
    "fontSize": size * scale, "captionBottom": (captionBottom * scale).rounded(.up), "overlays": overlays, "end": endFile,
    "hole": ["left": Int(holeLeft), "top": Int(holeTop), "width": Int(holeW), "height": Int(holeH)],
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

/** For each picture, the lines of text above `bottom` (px from the top), top first. */
func read(_ files: [String], bottom: CGFloat, language: String) {
  let all: [[String]] = files.map { file in
    let image = loadImage(file)
    guard let band = image.cropping(to: CGRect(x: 0, y: 0, width: CGFloat(image.width), height: bottom)) else { fail("cannot crop") }
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
case "card" where args.count == 3:
  guard let data = FileManager.default.contents(atPath: args[2]),
        let job = try? JSONDecoder().decode(Card.self, from: data) else { fail("cannot read the card job \(args[2])") }
  card(job)
case "sheet" where args.count >= 6:
  sheet(args[2], height: Int(args[3]) ?? 600, background: args[4], files: Array(args[5...]))
case "read" where args.count >= 5:
  read(Array(args[4...]), bottom: CGFloat(Double(args[2]) ?? 0), language: args[3])
default:
  fail("usage: compose draw <job.json> | compose card <card.json> | compose read <bottom> <language> <picture.png>… | compose sheet …")
}
