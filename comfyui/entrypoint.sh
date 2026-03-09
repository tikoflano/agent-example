#!/bin/bash
set -e

MODEL_DIR="/app/models/checkpoints"
MODEL_NAME="${SD_MODEL:-sd_xl_turbo_1.0_fp16.safetensors}"
MODEL_PATH="${MODEL_DIR}/${MODEL_NAME}"

if [ ! -f "$MODEL_PATH" ]; then
  echo "[ComfyUI] Model not found: ${MODEL_NAME}"
  echo "[ComfyUI] Downloading SDXL Turbo (fp16, ~6.9GB)..."
  mkdir -p "$MODEL_DIR"
  curl -L --progress-bar \
    "https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/${MODEL_NAME}" \
    -o "$MODEL_PATH"
  echo "[ComfyUI] Download complete."
fi

echo "[ComfyUI] Starting server..."
exec python main.py --listen 0.0.0.0 --port 8188 "$@"
