import type { FrameSource } from '../types';

/**
 * Stickers are shown CLOSE to the screen, so on the front camera we pin focus to the
 * near end of the lens range instead of letting continuous autofocus hunt — sharper,
 * steadier frames mean the small code pill reads far more reliably. Best-effort and
 * feature-detected: most desktops and some phones don't expose manual focus, in which
 * case this is a silent no-op and ordinary autofocus stays. `focusDistance.min` is the
 * closest focus on Android Chrome; the right value is device-dependent (verify on the
 * phone — if close stickers come out blurry, the device may invert the range).
 */
async function lockNearFocus(stream: MediaStream): Promise<void> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== 'function') return;
    const caps = track.getCapabilities() as {
      focusMode?: string[];
      focusDistance?: { min: number; max: number; step: number };
    };
    if (!caps.focusMode?.includes('manual') || !caps.focusDistance) return;
    await track.applyConstraints({
      advanced: [
        { focusMode: 'manual', focusDistance: caps.focusDistance.min } as unknown as MediaTrackConstraintSet,
      ],
    });
  } catch {
    /* focus control unsupported on this device — keep autofocus */
  }
}

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
          // High resolution so a small sticker code still has enough pixels to read
          // (especially with several backs in view). `ideal` negotiates down if the
          // camera can't provide it.
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      // Front camera: the sticker sits right against the screen, so lock focus near
      // rather than let autofocus hunt. Fire-and-forget; it settles a frame later.
      if ((opts?.facingMode ?? 'environment') === 'user') void lockNearFocus(stream);
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
