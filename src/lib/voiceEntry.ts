/**
 * Microphone recording + audio decode helpers for Voice Entry.
 * Recording happens entirely in the renderer; audio never leaves the machine
 * (Whisper runs locally). We never store the recording.
 */

export class VoiceRecordingError extends Error {}

function getMediaDevices(): MediaDevices {
  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== 'function') {
    throw new VoiceRecordingError('الميكروفون غير متوفر في هذه البيئة.');
  }
  return md;
}

/** Resample a channel to 16 kHz mono (Whisper input format). */
export function resampleTo16k(buffer: AudioBuffer): Float32Array {
  const src = buffer.getChannelData(0);
  const srcRate = buffer.sampleRate;
  if (srcRate === 16000) return new Float32Array(src);
  const ratio = srcRate / 16000;
  const outLen = Math.max(1, Math.round(src.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = Math.min(src.length - 1, Math.floor(i * ratio));
    out[i] = src[idx];
  }
  return out;
}

/** Decode any audio blob (webm/opus, wav, etc.) into 16 kHz mono PCM. */
export async function blobTo16k(blob: Blob): Promise<Float32Array> {
  let audioCtx: AudioContext;
  try {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    audioCtx = new Ctor({ sampleRate: 16000 });
  } catch {
    throw new VoiceRecordingError('تعذر إنشاء مشغّل الصوت.');
  }
  try {
    const arrayBuf = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuf);
    return resampleTo16k(decoded);
  } catch {
    throw new VoiceRecordingError('تعذر فك ترميز التسجيل الصوتي.');
  } finally {
    audioCtx.close().catch(() => {});
  }
}

export interface RecordedAudio {
  blob: Blob;
  durationMs: number;
  float32: Float32Array;
}

export interface RecorderHandle {
  stop: () => Promise<RecordedAudio>;
  cancel: () => void;
  isActive: () => boolean;
}

/**
 * Start a recording session. The returned handle's stop() resolves with the
 * decoded 16 kHz PCM once the user stops recording. Throws VoiceRecordingError
 * for permission/unavailable cases.
 */
export async function startRecording(onTick?: (elapsedMs: number) => void): Promise<RecorderHandle> {
  let stream: MediaStream;
  try {
    stream = await getMediaDevices().getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: any) {
    const name = String(err?.name || '');
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw new VoiceRecordingError('تم رفض إذن الميكروفون. امنح البرنامج إذن الوصول إلى الميكروفون.');
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      throw new VoiceRecordingError('لم يُعثر على ميكروفون متصل.');
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      throw new VoiceRecordingError('تعذر تشغيل الميكروفون (قد يكون مستخدماً من تطبيق آخر).');
    }
    throw new VoiceRecordingError('تعذر الوصول إلى الميكروفون: ' + err?.message);
  }

  const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  let recorder: MediaRecorder;
  try {
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.onerror = () => {
    stream.getTracks().forEach((t) => t.stop());
  };

  const startedAt = Date.now();
  const ticker = onTick ? setInterval(() => onTick(Date.now() - startedAt), 200) : null;

  const cleanupTicker = () => {
    if (ticker) clearInterval(ticker);
  };

  recorder.start();

  return {
    stop: () =>
      new Promise<RecordedAudio>((resolve, reject) => {
        (async () => {
          try {
            if (recorder.state !== 'inactive') {
              await new Promise<void>((r) => {
                recorder.onstop = () => r();
                recorder.stop();
              });
            }
            cleanupTicker();
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
            const float32 = await blobTo16k(blob);
            resolve({ blob, durationMs: Date.now() - startedAt, float32 });
          } catch (err) {
            cleanupTicker();
            stream.getTracks().forEach((t) => t.stop());
            reject(err instanceof VoiceRecordingError ? err : new VoiceRecordingError('فشل إنهاء التسجيل.'));
          }
        })();
      }),
    cancel: () => {
      cleanupTicker();
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {}
      stream.getTracks().forEach((t) => t.stop());
    },
    isActive: () => recorder.state === 'recording',
  };
}