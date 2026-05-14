import AppKit
import Foundation

private struct IconSpec {
    let points: Int
    let scale: Int

    var pixels: Int {
        points * scale
    }

    var filename: String {
        scale == 1 ? "icon_\(points)x\(points).png" : "icon_\(points)x\(points)@2x.png"
    }
}

private extension NSColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        let red = CGFloat((hex >> 16) & 0xff) / 255
        let green = CGFloat((hex >> 8) & 0xff) / 255
        let blue = CGFloat(hex & 0xff) / 255
        self.init(srgbRed: red, green: green, blue: blue, alpha: alpha)
    }
}

private func roundedRect(_ rect: CGRect, radius: CGFloat) -> NSBezierPath {
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
}

private func fill(_ rect: CGRect, radius: CGFloat, color: NSColor) {
    color.setFill()
    roundedRect(rect, radius: radius).fill()
}

private func stroke(_ rect: CGRect, radius: CGFloat, color: NSColor, width: CGFloat) {
    let path = roundedRect(rect.insetBy(dx: width / 2, dy: width / 2), radius: max(0, radius - width / 2))
    color.setStroke()
    path.lineWidth = width
    path.stroke()
}

private func drawText(_ text: String, in rect: CGRect, size: CGFloat, weight: NSFont.Weight, color: NSColor, alignment: NSTextAlignment = .left) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byClipping

    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: paragraph
    ]

    text.draw(in: rect, withAttributes: attributes)
}

private func drawSheetLayer(rect: CGRect, radius: CGFloat, alpha: CGFloat, accentColor: NSColor) {
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.18 * alpha)
    shadow.shadowBlurRadius = 32
    shadow.shadowOffset = CGSize(width: 0, height: -14)
    shadow.set()

    fill(rect, radius: radius, color: NSColor.white.withAlphaComponent(alpha))
    NSShadow().set()

    fill(
        CGRect(x: rect.minX + 34, y: rect.minY + rect.height - 100, width: rect.width - 68, height: 24),
        radius: 12,
        color: NSColor(hex: 0xC7D2FE, alpha: 0.75 * alpha)
    )
    fill(
        CGRect(x: rect.minX + 34, y: rect.minY + 52, width: 98, height: rect.height - 132),
        radius: 20,
        color: accentColor.withAlphaComponent(0.11 * alpha)
    )
}

private func drawGrid(origin: CGPoint, cell: CGSize, columns: Int, rows: Int) {
    let colors: [NSColor] = [
        NSColor(hex: 0x14B8A6, alpha: 0.88),
        NSColor(hex: 0xF59E0B, alpha: 0.86),
        NSColor(hex: 0x6366F1, alpha: 0.82)
    ]

    for row in 0..<rows {
        for column in 0..<columns {
            let rect = CGRect(
                x: origin.x + CGFloat(column) * (cell.width + 10),
                y: origin.y + CGFloat(row) * (cell.height + 10),
                width: cell.width,
                height: cell.height
            )
            let index = (row + column) % colors.count
            fill(rect, radius: 10, color: colors[index].withAlphaComponent(row == rows - 1 ? 0.72 : 0.46))
        }
    }
}

private func drawIcon(size: Int) throws -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    rep.size = NSSize(width: size, height: size)

    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = context
    context.cgContext.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
    context.cgContext.setShouldAntialias(true)
    context.cgContext.setAllowsAntialiasing(true)

    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()

    let baseRect = CGRect(x: 74, y: 74, width: 876, height: 876)
    let basePath = roundedRect(baseRect, radius: 206)
    let baseShadow = NSShadow()
    baseShadow.shadowColor = NSColor.black.withAlphaComponent(0.28)
    baseShadow.shadowBlurRadius = 42
    baseShadow.shadowOffset = CGSize(width: 0, height: -18)
    baseShadow.set()
    NSGradient(colors: [
        NSColor(hex: 0x2563EB),
        NSColor(hex: 0x0F766E)
    ])!.draw(in: basePath, angle: 92)
    NSShadow().set()

    stroke(baseRect, radius: 206, color: NSColor.white.withAlphaComponent(0.26), width: 8)

    NSGradient(colors: [
        NSColor.white.withAlphaComponent(0.28),
        NSColor.white.withAlphaComponent(0.04)
    ])!.draw(
        in: roundedRect(CGRect(x: 118, y: 594, width: 790, height: 278), radius: 156),
        angle: 90
    )

    drawSheetLayer(
        rect: CGRect(x: 214, y: 244, width: 532, height: 592),
        radius: 58,
        alpha: 0.58,
        accentColor: NSColor(hex: 0xF59E0B)
    )

    let mainRect = CGRect(x: 286, y: 172, width: 528, height: 668)
    let mainShadow = NSShadow()
    mainShadow.shadowColor = NSColor.black.withAlphaComponent(0.26)
    mainShadow.shadowBlurRadius = 36
    mainShadow.shadowOffset = CGSize(width: 0, height: -20)
    mainShadow.set()
    fill(mainRect, radius: 64, color: NSColor(hex: 0xF8FAFC))
    NSShadow().set()
    stroke(mainRect, radius: 64, color: NSColor.white.withAlphaComponent(0.62), width: 6)

    let fold = NSBezierPath()
    fold.move(to: CGPoint(x: mainRect.maxX - 128, y: mainRect.maxY))
    fold.line(to: CGPoint(x: mainRect.maxX, y: mainRect.maxY - 128))
    fold.line(to: CGPoint(x: mainRect.maxX - 128, y: mainRect.maxY - 128))
    fold.close()
    NSColor(hex: 0xDBEAFE).setFill()
    fold.fill()

    fill(CGRect(x: 336, y: 742, width: 224, height: 40), radius: 20, color: NSColor(hex: 0x0F172A, alpha: 0.16))
    fill(CGRect(x: 336, y: 680, width: 322, height: 26), radius: 13, color: NSColor(hex: 0x64748B, alpha: 0.23))
    fill(CGRect(x: 336, y: 630, width: 392, height: 26), radius: 13, color: NSColor(hex: 0x64748B, alpha: 0.18))
    fill(CGRect(x: 336, y: 580, width: 270, height: 26), radius: 13, color: NSColor(hex: 0x64748B, alpha: 0.18))

    drawText("#", in: CGRect(x: 336, y: 718, width: 86, height: 104), size: 82, weight: .black, color: NSColor(hex: 0x1D4ED8))
    drawText("M", in: CGRect(x: 430, y: 405, width: 250, height: 182), size: 154, weight: .black, color: NSColor(hex: 0x0F172A), alignment: .center)

    let arrow = NSBezierPath()
    arrow.move(to: CGPoint(x: 682, y: 518))
    arrow.line(to: CGPoint(x: 682, y: 390))
    arrow.move(to: CGPoint(x: 630, y: 438))
    arrow.line(to: CGPoint(x: 682, y: 382))
    arrow.line(to: CGPoint(x: 734, y: 438))
    NSColor(hex: 0x14B8A6).setStroke()
    arrow.lineWidth = 28
    arrow.lineCapStyle = .round
    arrow.lineJoinStyle = .round
    arrow.stroke()

    drawGrid(origin: CGPoint(x: 350, y: 248), cell: CGSize(width: 92, height: 48), columns: 4, rows: 3)

    fill(CGRect(x: 250, y: 342, width: 66, height: 268), radius: 30, color: NSColor(hex: 0xF59E0B))
    fill(CGRect(x: 270, y: 552, width: 26, height: 32), radius: 13, color: NSColor.white.withAlphaComponent(0.54))

    NSGraphicsContext.restoreGraphicsState()
    return rep
}

private func writePNG(size: Int, to url: URL) throws {
    let rep = try drawIcon(size: size)
    guard let png = rep.representation(using: .png, properties: [.compressionFactor: 1.0]) else {
        throw NSError(domain: "IconGenerator", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to encode PNG"])
    }
    try png.write(to: url, options: .atomic)
}

private func runIconutil(iconsetURL: URL, outputURL: URL) throws {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
    process.arguments = ["-c", "icns", "-o", outputURL.path, iconsetURL.path]
    try process.run()
    process.waitUntilExit()
    if process.terminationStatus != 0 {
        throw NSError(domain: "IconGenerator", code: Int(process.terminationStatus), userInfo: [NSLocalizedDescriptionKey: "iconutil failed"])
    }
}

private let specs = [
    IconSpec(points: 16, scale: 1),
    IconSpec(points: 16, scale: 2),
    IconSpec(points: 32, scale: 1),
    IconSpec(points: 32, scale: 2),
    IconSpec(points: 128, scale: 1),
    IconSpec(points: 128, scale: 2),
    IconSpec(points: 256, scale: 1),
    IconSpec(points: 256, scale: 2),
    IconSpec(points: 512, scale: 1),
    IconSpec(points: 512, scale: 2)
]

guard CommandLine.arguments.count == 2 else {
    fputs("Usage: swift generate-app-icon.swift /path/to/MarkdownReader.icns\n", stderr)
    exit(64)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputDirectory = outputURL.deletingLastPathComponent()
let iconsetURL = outputDirectory.appendingPathComponent("MarkdownReader.iconset", isDirectory: true)
let sourceURL = outputDirectory.appendingPathComponent("MarkdownReader-1024.png")
let fileManager = FileManager.default

try fileManager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
try? fileManager.removeItem(at: iconsetURL)
try fileManager.createDirectory(at: iconsetURL, withIntermediateDirectories: true)

for spec in specs {
    try writePNG(size: spec.pixels, to: iconsetURL.appendingPathComponent(spec.filename))
}

try writePNG(size: 1024, to: sourceURL)
try? fileManager.removeItem(at: outputURL)
try runIconutil(iconsetURL: iconsetURL, outputURL: outputURL)
try? fileManager.removeItem(at: iconsetURL)
