#!/usr/bin/env swift
// Generates build/icon.png — a full-bleed 1024×1024 dock icon (macOS applies
// the squircle mask). Run from the repo root, then rebuild the .icns with:
//   bash scripts/generate-icon.sh
import AppKit
import Foundation

let dimension = 1024
guard let rep = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: dimension,
  pixelsHigh: dimension,
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
) else {
  fputs("failed to create bitmap\n", stderr)
  exit(1)
}
rep.size = NSSize(width: dimension, height: dimension)

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

let rect = NSRect(x: 0, y: 0, width: dimension, height: dimension)
// Brand blues from the renderer (--color-accent / darker hover).
let top = NSColor(calibratedRed: 74 / 255, green: 120 / 255, blue: 235 / 255, alpha: 1)
let bottom = NSColor(calibratedRed: 42 / 255, green: 83 / 255, blue: 194 / 255, alpha: 1)
NSGradient(starting: top, ending: bottom)!.draw(in: rect, angle: 90)

func flip(_ y: CGFloat) -> CGFloat { CGFloat(dimension) - y }
let path = NSBezierPath()
path.move(to: NSPoint(x: 278, y: flip(528)))
path.line(to: NSPoint(x: 434, y: flip(686)))
path.line(to: NSPoint(x: 760, y: flip(318)))
path.lineWidth = 108
path.lineCapStyle = .round
path.lineJoinStyle = .round
NSColor.white.setStroke()
path.stroke()

NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
  fputs("failed to encode png\n", stderr)
  exit(1)
}

let repoRoot = URL(fileURLWithPath: #filePath)
  .deletingLastPathComponent()
  .deletingLastPathComponent()
let outDir = repoRoot.appendingPathComponent("build", isDirectory: true)
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let out = outDir.appendingPathComponent("icon.png")
try png.write(to: out)
print("wrote \(out.path)")
