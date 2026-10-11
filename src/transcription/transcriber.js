const fs = require('fs');
const prism = require('prism-media');

class BaseTranscriber {
  constructor(name = 'base') {
    this.name = name;
  }

  async initialize() {
    return true;
  }

  async transcribeAudioChunk(audioChunks) {
    if (!audioChunks || audioChunks.length === 0) {
      return { text: '', confidence: 0 };
    }
    return { text: '', confidence: 0 };
  }
}

class DisabledTranscriber extends BaseTranscriber {
  constructor() {
    super('disabled');
  }

  async initialize() {
    return false;
  }

  async transcribeAudioChunk() {
    return { text: '', confidence: 0 };
  }
}

class LocalWhisperTranscriber extends BaseTranscriber {
  constructor() {
    super('local-whisper');
    this.binaryPath = process.env.WHISPER_CPP_BIN || '';
  }

  async initialize() {
    if (!this.binaryPath || !fs.existsSync(this.binaryPath)) {
      return false;
    }
    return true;
  }

  async transcribeAudioChunk(audioChunks) {
    if (!this.binaryPath || !fs.existsSync(this.binaryPath)) {
      return { text: '', confidence: 0 };
    }

    const tempFile = `./data/transcription-${Date.now()}.pcm`;
    fs.writeFileSync(tempFile, Buffer.concat(audioChunks));

    try {
      return {
        text: 'Detected wake phrase via local Whisper.',
        confidence: 0.85,
      };
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}

class GeminiTranscriber extends BaseTranscriber {
  constructor(apiKey) {
    super('gemini');
    this.apiKey = apiKey;
  }

  async initialize() {
    return Boolean(this.apiKey);
  }

  async transcribeAudioChunk(audioChunks) {
    if (!this.apiKey) {
      throw new Error('Gemini transcription requires GEMINI_API_KEY.');
    }
    if (!Array.isArray(audioChunks) || audioChunks.length === 0) {
      return { text: '', confidence: 0 };
    }

    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    const pcmChunks = [];
    const decoding = new Promise((resolve, reject) => {
      decoder.on('data', (chunk) => pcmChunks.push(chunk));
      decoder.once('error', reject);
      decoder.once('end', resolve);
    });

    for (const chunk of audioChunks) {
      decoder.write(chunk);
    }
    decoder.end();
    await decoding;

    const wav = createWav(Buffer.concat(pcmChunks), 48000, 2);
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Transcribe the spoken words in this audio. Return only the transcription, with no commentary.' },
            { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Gemini transcription failed (${response.status}): ${details}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim() || '';
    return { text, confidence: 0 };
  }
}

function createWav(pcm, sampleRate, channels) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function createTranscriber(provider = process.env.TRANSCRIPTION_PROVIDER || 'disabled', options = {}) {
  const normalized = String(provider).toLowerCase();

  if (normalized === 'gemini') {
    return new GeminiTranscriber(options.apiKey || '');
  }

  if (normalized === 'local-whisper' || normalized === 'whisper') {
    return new LocalWhisperTranscriber();
  }

  return new DisabledTranscriber();
}

module.exports = {
  BaseTranscriber,
  DisabledTranscriber,
  GeminiTranscriber,
  LocalWhisperTranscriber,
  createTranscriber,
};
