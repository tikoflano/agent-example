import { randomBytes } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface ImageOptions {
  width?: number
  height?: number
}

export interface GeneratedImage {
  filename: string
  path: string
}

export interface ImageBackend {
  generate(prompt: string, options?: ImageOptions): Promise<GeneratedImage>
}

const GRADIENTS: [string, string][] = [
  ['#ff6b6b', '#feca57'],
  ['#48dbfb', '#ff9ff3'],
  ['#0abde3', '#10ac84'],
  ['#5f27cd', '#341f97'],
  ['#ff9f43', '#ee5a24'],
  ['#01a3a4', '#00d2d3'],
  ['#6c5ce7', '#a29bfe'],
  ['#fd79a8', '#e84393'],
]

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars) {
      if (current) lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines
}

export class MockImageBackend implements ImageBackend {
  constructor(private imagesDir: string) {}

  async generate(prompt: string, options?: ImageOptions): Promise<GeneratedImage> {
    const w = options?.width ?? 512
    const h = options?.height ?? 512
    const id = randomBytes(8).toString('hex')
    const filename = `img_${id}.svg`
    const [c1, c2] = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)]

    const lines = wrapText(prompt, 30)
    const lineHeight = 28
    const startY = h / 2 - (lines.length * lineHeight) / 2

    const textElements = lines
      .map(
        (line, i) =>
          `<text x="${w / 2}" y="${startY + i * lineHeight}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="600" fill="white" opacity="0.95">${escapeXml(line)}</text>`,
      )
      .join('\n    ')

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}" />
      <stop offset="100%" style="stop-color:${c2}" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" rx="12" />
  <rect x="16" y="16" width="${w - 32}" height="${h - 32}" rx="8" fill="black" opacity="0.15" />
  <text x="${w / 2}" y="50" text-anchor="middle" font-family="monospace" font-size="13" fill="white" opacity="0.5">MOCK IMAGE</text>
  <line x1="40" y1="65" x2="${w - 40}" y2="65" stroke="white" stroke-opacity="0.15" />
  ${textElements}
  <text x="${w / 2}" y="${h - 30}" text-anchor="middle" font-family="monospace" font-size="11" fill="white" opacity="0.35">${w}×${h} • agent-example</text>
</svg>`

    await mkdir(this.imagesDir, { recursive: true })
    const path = join(this.imagesDir, filename)
    await writeFile(path, svg, 'utf-8')

    return { filename, path }
  }
}
