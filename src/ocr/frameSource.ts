import type { FrameSource } from '../types';

/**
 * Live camera frame source. Wraps a hidden <video> fed by getUserMedia, and can
 * draw the current frame into a canvas, downscaled to keep OCR cheap on phones.
 */
export function createCameraSource(opts?: { facingMode?: string }): FrameSource {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  let stream: MediaStream | null = null;

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: opts?.facingMode ?? 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
    },

    stop() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      video.srcObject = null;
    },

    get element() {
      return video;
    },

    isReady() {
      return video.readyState >= 2 && video.videoWidth > 0;
    },

    drawTo(canvas, maxWidth) {
      if (!this.isReady()) return false;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);
      canvas.width = width;
      canvas.height = height;
      // willReadFrequently: these capture canvases are always read back via
      // getImageData (frame-diff / preprocess), so keep them CPU-backed.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;
      ctx.drawImage(video, 0, 0, width, height);
      return true;
    },
  };
}
