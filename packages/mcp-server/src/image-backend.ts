import { randomBytes } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { StableDiffusionBackend } from './sd-backend.js'

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

export function createImageBackend(imagesDir: string): ImageBackend {
  const backend = process.env.IMAGE_BACKEND || 'mock'

  switch (backend) {
    case 'comfyui':
    case 'stable-diffusion': {
      const comfyuiUrl = process.env.COMFYUI_URL || 'http://localhost:8188'
      const model = process.env.SD_MODEL || 'sd_xl_turbo_1.0_fp16.safetensors'
      const steps = parseInt(process.env.SD_STEPS || '4', 10)
      console.log(
        `[Image] Using Stable Diffusion backend (${comfyuiUrl}, ${model}, ${steps} steps)`,
      )
      return new StableDiffusionBackend({ comfyuiUrl, imagesDir, model, steps })
    }
    case 'mock':
    default:
      console.log('[Image] Using mock backend')
      return new MockImageBackend(imagesDir)
  }
}

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

    const lines = wrapText(prompt, 35)
    const lineHeight = 26
    const startY = h / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2

    const textElements = lines
      .map(
        (line, i) =>
          `<text x="${w / 2}" y="${startY + i * lineHeight}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="white">${escapeXml(line)}</text>`,
      )
      .join('\n  ')

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="black" />
  ${textElements}
</svg>`

    await mkdir(this.imagesDir, { recursive: true })
    const path = join(this.imagesDir, filename)
    await writeFile(path, svg, 'utf-8')

    return { filename, path }
  }
}
