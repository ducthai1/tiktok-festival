// Chạy trong LUỒNG ÂM THANH (AudioWorklet): nghe tiếng nhạc đang phát, tính độ "bật" ~100 lần/giây rồi gửi về trang
// theo lô ~0,1 giây, kèm giờ âm thanh (AudioContext) của khung đầu lô. Ở đây không bị khung hình 3D làm trễ / bỏ sót mẫu
// như khi hỏi AnalyserNode từ trang. Phần tính toán ở stage-beat-core.js.
import { createOnsetDetector } from './stage-beat-core.js';

const BATCH = 10;

class BeatOnset extends AudioWorkletProcessor {
  constructor() {
    super();
    this.detector = createOnsetDetector(sampleRate);
    this.mono = new Float32Array(128);
    this.startAt = -1; // giờ âm thanh của mẫu đầu tiên đã nghe
    this.frames = 0;
    this.batch = [];
    this.batchFirst = 0;
  }

  process(inputs) {
    const channels = inputs[0] || [];
    const length = channels[0]?.length || 128;
    if (this.startAt < 0) this.startAt = currentFrame / sampleRate;
    if (this.mono.length !== length) this.mono = new Float32Array(length);
    this.mono.fill(0);
    // nguồn đang dừng có thể gửi 0 kênh — vẫn đẩy khối im lặng để dòng thời gian liền mạch
    for (const channel of channels) for (let i = 0; i < length; i += 1) this.mono[i] += channel[i] / channels.length;
    for (const value of this.detector.push(this.mono)) {
      if (!this.batch.length) this.batchFirst = this.frames;
      this.batch.push(value);
      this.frames += 1;
    }
    if (this.batch.length >= BATCH) {
      this.port.postMessage({ at: this.startAt + this.detector.timeOf(this.batchFirst), rate: this.detector.rate, values: this.batch });
      this.batch = [];
    }
    return true;
  }
}

registerProcessor('beat-onset', BeatOnset);
