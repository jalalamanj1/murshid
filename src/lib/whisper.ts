/**
 * Browser/local Whisper via @huggingface/transformers (ONNX WebAssembly).
 *
 * The model and runtime run entirely inside the renderer — no audio ever
 * leaves the machine. Model weights are downloaded from Hugging Face on first
 * use (then cached in the browser cache), and the ONNX .wasm binaries ship
 * with the app under /ort so no CDN is required at runtime.
 *
 * The pipeline is created lazily and reused (module-level singleton), per the
 * "initialize efficiently and reuse" requirement.
 */

import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = false; // always fetch from Hugging Face Hub (never a stale ./ copy)
env.useBrowserCache = true; // cache downloaded model weights in the browser cache

// Serve the onnxruntime wasm + mjs glue through the app's murshid-res://
// protocol (registered in electron/main.cjs). Chromium's fetch() cannot read
// file:// URLs, so a plain ./ort/ path fails inside the packaged asar. The
// object form makes transformers pre-load both files via fetch (blob URL + wasm
// binary), which is exactly the path that works over a custom protocol.
env.backends.onnx.wasm.wasmPaths = {
  mjs: 'murshid-res://app/assets/ort/ort-wasm-simd-threaded.asyncify.mjs',
  wasm: 'murshid-res://app/assets/ort/ort-wasm-simd-threaded.asyncify.wasm',
};

const MODEL_ID = 'Xenova/whisper-base'; // multilingual: Arabic + English

let pipelinePromise: Promise<any> | null = null;

function getTranscriber() {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8',
    });
  }
  return pipelinePromise;
}

/**
 * Pre-warm Whisper so the first "Processing..." step is fast.
 * Safe to call anytime; resolves immediately once loaded.
 */
export function warmUpWhisper(): Promise<void> {
  return getTranscriber().then(() => undefined);
}

/**
 * Transcribe a 16 kHz mono Float32Array into text.
 * The app is Arabic-only, so the language is pinned to Arabic.
 */
export async function transcribeAudio(audio: Float32Array): Promise<string> {
  const transcriber = await getTranscriber();
  const out = await transcriber(audio, {
    language: 'arabic',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });
  const text = (out && (out.text || out[0]?.text)) || '';
  return String(text).trim();
}