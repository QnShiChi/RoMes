import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface SpeechGenerationInput {
  script: string;
  campaignSlug: string;
  outputDir: string;
  language?: string;
  voice?: string;
  timeoutMs?: number;
  apiKey?: string;
}

export interface SpeechGenerationOutput {
  audioPath: string;
  durationMs: number;
  format: "wav" | "mp3";
  bytes: number;
  model: string;
}

export interface SpeechEngineOptions {
  probeAudioDuration?: (filePath: string) => number;
  synthesizer?: (input: SpeechGenerationInput) => Promise<Buffer>;
}

export const DEFAULT_SPEECH_MODEL = "gemini-3.8-flash-tts";
export const DEFAULT_VOICE = "Puck";

export function probeAudioDurationMs(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    const hasAudio = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { timeout: 5000, encoding: "utf-8" },
    ).trim();

    if (!hasAudio.includes("audio")) {
      return 0;
    }

    const raw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { timeout: 5000, encoding: "utf-8" },
    );
    const secs = Number.parseFloat(raw.trim());
    if (Number.isFinite(secs) && secs > 0) {
      return Math.round(secs * 1000);
    }
  } catch {
    // ffprobe unavailable or non-audio file
  }
  return 0;
}

export function detectAudioFormat(buffer: Buffer): "wav" | "mp3" {
  if (buffer.length >= 12) {
    if (
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x41 && // A
      buffer[10] === 0x56 && // V
      buffer[11] === 0x45 // E
    ) {
      return "wav";
    }
  }
  if (buffer.length >= 3) {
    // MP3 frame sync (0xFF 0xFB/FA/F3/F2) or ID3 tag (ID3)
    if (
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) ||
      (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
    ) {
      return "mp3";
    }
  }
  return "wav";
}

async function synthesizeViaGeminiApi(
  apiKey: string,
  script: string,
  voice: string,
  timeoutMs: number,
): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_SPEECH_MODEL}:generateSpeech?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: script,
      voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gemini Speech API failed HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { audioContent?: string };
  if (!data.audioContent) {
    throw new Error("No audioContent in Gemini Speech API response");
  }

  return Buffer.from(data.audioContent, "base64");
}

export async function generateMarketingSpeech(
  input: SpeechGenerationInput,
  options?: SpeechEngineOptions,
): Promise<SpeechGenerationOutput> {
  const script = input.script?.trim();
  if (!script) {
    throw new Error("Speech script cannot be empty");
  }

  if (!existsSync(input.outputDir)) {
    mkdirSync(input.outputDir, { recursive: true });
  }

  const voice = input.voice?.trim() || DEFAULT_VOICE;
  const timeoutMs = input.timeoutMs ?? 60_000;
  let audioBuffer: Buffer;

  if (options?.synthesizer) {
    audioBuffer = await options.synthesizer(input);
  } else if (input.apiKey || process.env.GEMINI_API_KEY) {
    const key = input.apiKey || process.env.GEMINI_API_KEY || "";
    audioBuffer = await synthesizeViaGeminiApi(key, script, voice, timeoutMs);
  } else {
    // Headless browser automation placeholder or local mock generator
    // In production, agent_browser opens https://aistudio.google.com/generate-speech?model=gemini-3.8-flash-tts
    audioBuffer = Buffer.from(
      `RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00`,
    );
  }

  const format = detectAudioFormat(audioBuffer);
  const audioPath = join(input.outputDir, `${input.campaignSlug}-speech.${format}`);
  writeFileSync(audioPath, audioBuffer);

  const durationMs = options?.probeAudioDuration
    ? options.probeAudioDuration(audioPath)
    : probeAudioDurationMs(audioPath);

  return {
    audioPath,
    durationMs,
    format,
    bytes: audioBuffer.byteLength,
    model: DEFAULT_SPEECH_MODEL,
  };
}
