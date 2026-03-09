import { randomBytes } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ImageBackend, ImageOptions, GeneratedImage } from './image-backend.js'

const SDXL_TURBO_WORKFLOW = {
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 0,
      steps: 4,
      cfg: 1.0,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1.0,
      model: ['4', 0],
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: ['5', 0],
    },
  },
  '4': {
    class_type: 'CheckpointLoaderSimple',
    inputs: {
      ckpt_name: 'sd_xl_turbo_1.0_fp16.safetensors',
    },
  },
  '5': {
    class_type: 'EmptyLatentImage',
    inputs: {
      width: 512,
      height: 512,
      batch_size: 1,
    },
  },
  '6': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: '',
      clip: ['4', 1],
    },
  },
  '7': {
    class_type: 'CLIPTextEncode',
    inputs: {
      text: '',
      clip: ['4', 1],
    },
  },
  '8': {
    class_type: 'VAEDecode',
    inputs: {
      samples: ['3', 0],
      vae: ['4', 2],
    },
  },
  '9': {
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: 'agent',
      images: ['8', 0],
    },
  },
}

interface ComfyUIHistoryOutput {
  images: Array<{ filename: string; subfolder: string; type: string }>
}

interface ComfyUIHistoryEntry {
  outputs: Record<string, ComfyUIHistoryOutput>
}

export class StableDiffusionBackend implements ImageBackend {
  private comfyuiUrl: string
  private imagesDir: string
  private model: string
  private steps: number

  constructor(options: { comfyuiUrl: string; imagesDir: string; model?: string; steps?: number }) {
    this.comfyuiUrl = options.comfyuiUrl.replace(/\/$/, '')
    this.imagesDir = options.imagesDir
    this.model = options.model || 'sd_xl_turbo_1.0_fp16.safetensors'
    this.steps = options.steps || 4
  }

  async generate(prompt: string, options?: ImageOptions): Promise<GeneratedImage> {
    const width = options?.width ?? 512
    const height = options?.height ?? 512

    const workflow = JSON.parse(JSON.stringify(SDXL_TURBO_WORKFLOW))
    workflow['3'].inputs.seed = Math.floor(Math.random() * 2 ** 32)
    workflow['3'].inputs.steps = this.steps
    workflow['4'].inputs.ckpt_name = this.model
    workflow['5'].inputs.width = width
    workflow['5'].inputs.height = height
    workflow['6'].inputs.text = prompt

    const queueRes = await fetch(`${this.comfyuiUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    })

    if (!queueRes.ok) {
      const text = await queueRes.text()
      throw new Error(`ComfyUI queue failed (${queueRes.status}): ${text}`)
    }

    const { prompt_id } = (await queueRes.json()) as { prompt_id: string }
    console.log(`[SD] Queued prompt: ${prompt_id}`)

    const imageInfo = await this.waitForResult(prompt_id)

    const imageData = await this.downloadImage(
      imageInfo.filename,
      imageInfo.subfolder,
      imageInfo.type,
    )

    await mkdir(this.imagesDir, { recursive: true })
    const id = randomBytes(8).toString('hex')
    const filename = `img_${id}.png`
    const outputPath = join(this.imagesDir, filename)
    await writeFile(outputPath, imageData)

    console.log(`[SD] Generated: ${filename} (${width}x${height}, ${this.steps} steps)`)
    return { filename, path: outputPath }
  }

  private async waitForResult(
    promptId: string,
    timeoutMs = 60000,
  ): Promise<{ filename: string; subfolder: string; type: string }> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const res = await fetch(`${this.comfyuiUrl}/history/${promptId}`)
      if (!res.ok) {
        await this.sleep(500)
        continue
      }

      const history = (await res.json()) as Record<string, ComfyUIHistoryEntry>
      const entry = history[promptId]

      if (entry) {
        for (const nodeOutput of Object.values(entry.outputs)) {
          if (nodeOutput.images && nodeOutput.images.length > 0) {
            return nodeOutput.images[0]
          }
        }
      }

      await this.sleep(500)
    }

    throw new Error(`ComfyUI generation timed out after ${timeoutMs}ms`)
  }

  private async downloadImage(filename: string, subfolder: string, type: string): Promise<Buffer> {
    const params = new URLSearchParams({ filename, subfolder, type })
    const res = await fetch(`${this.comfyuiUrl}/view?${params}`)

    if (!res.ok) {
      throw new Error(`Failed to download image: ${res.status}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
