/**
 * Standalone mic-level preview reachable from Settings without being in any
 * voice channel — a short-lived `getUserMedia` call + AnalyserNode, entirely
 * independent of `voiceService`'s join lifecycle. Ports a specific desktop
 * Phase 8 fix (Phase 3 PRD P3.1): the noise-gate meter must work as a
 * standalone preview, not only while actually in a call.
 */
class NoiseGatePreviewService {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  get isActive(): boolean {
    return this.stream !== null;
  }

  async start(onLevel: (db: number) => void): Promise<void> {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);

    const analyser = this.analyser;
    const data = new Uint8Array(analyser.fftSize);
    this.interval = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (const sample of data) {
        const normalized = (sample - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;
      onLevel(Number.isFinite(db) ? Math.max(db, -100) : -100);
    }, 50);
  }

  /** Torn down on close or on a real voice join (Phase 3 PRD P3.1). */
  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.analyser = null;
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

export const noiseGatePreviewService = new NoiseGatePreviewService();
