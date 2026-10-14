import type { NoiseFilterLevel } from '@/lib/preferences';

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const LEVEL_THRESHOLDS: Record<NoiseFilterLevel, number> = {
  low: 0.02,
  medium: 0.04,
  high: 0.06,
};

/** A best-effort local volume gate; it detects sound level, not speaker identity. */
export class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private running = false;
  private loudFrames = 0;
  private lastReportedAt = 0;
  private startGeneration = 0;

  constructor(private readonly level: NoiseFilterLevel = 'medium') {}

  async start(onVoiceDetected: () => void): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    if (this.running) return true;
    const generation = ++this.startGeneration;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (generation !== this.startGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.stream = stream;

      const audioWindow = window as AudioWindow;
      const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
      if (!AudioContextClass) {
        this.stop();
        return false;
      }

      this.audioContext = new AudioContextClass();
      void this.audioContext.resume().catch(() => undefined);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);

      const samples = new Uint8Array(this.analyser.fftSize);
      const threshold = LEVEL_THRESHOLDS[this.level];
      this.running = true;

      const check = () => {
        if (!this.running || !this.analyser) return;
        this.analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);

        if (rms >= threshold) {
          this.loudFrames += 1;
          const now = Date.now();
          if (this.loudFrames >= 3 && now - this.lastReportedAt >= 450) {
            this.lastReportedAt = now;
            onVoiceDetected();
          }
        } else {
          this.loudFrames = 0;
        }
        this.rafId = window.requestAnimationFrame(check);
      };

      check();
      return true;
    } catch (error) {
      console.info('[VoiceActivityDetector] Microphone volume gate unavailable:', error);
      this.stop();
      return false;
    }
  }

  stop(): void {
    this.startGeneration += 1;
    this.running = false;
    if (this.rafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    this.loudFrames = 0;
  }
}
