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
env.backends.onnx.wasm.wasmPaths = './ort/';

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
 * Language is auto-detected (Arabic/English/mixed).
 */
export async function transcribeAudio(audio: Float32Array): Promise<string> {
  const transcriber = await getTranscriber();
  const out = await transcriber(audio, {
    language: 'auto',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false,
  });
  const text = (out && (out.text || out[0]?.text)) || '';
  return String(text).trim();
}