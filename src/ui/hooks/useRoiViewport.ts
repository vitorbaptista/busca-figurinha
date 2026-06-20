import { useEffect } from 'preact/hooks';
import { CONFIG } from '../../config';

type ElRef = { current: HTMLElement | null };

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Pure geometry: size + position a video of intrinsic `vw`×`vh` so that its normalized sub-rect
 * `rect` COVERS a `lw`×`lh` window, with the rect's centre at the window's centre. Returns the
 * absolute width/height/left/top (px) to apply to the video inside the clipped window.
 */
export function computeRoiViewport(
  vw: number,
  vh: number,
  lw: number,
  lh: number,
  rect: Rect,
): { width: number; height: number; left: number; top: number } {
  const roiW = (rect.right - rect.left) * vw;
  const roiH = (rect.bottom - rect.top) * vh;
  const scale = Math.max(lw / roiW, lh / roiH); // ROI covers the window
  const width = vw * scale;
  const height = vh * scale;
  const cx = (rect.left + rect.right) / 2;
  const cy = (rect.top + rect.bottom) / 2;
  return { width, height, left: lw / 2 - cx * width, top: lh / 2 - cy * height };
}

/**
 * Turn a clipped window (overflow:hidden) into a viewport onto the detection ROI: scale + position
 * the camera <video> so CONFIG.detect.roiRect exactly COVERS the window. Framing the sticker in the
 * window then means it sits in the region the recognizer actually reads — and the small code shows
 * zoomed in. Without this the window is just a centred crop of the whole frame, so what the user
 * frames and what gets detected drift apart. The ROI is x-symmetric, so the front camera's display
 * mirroring doesn't shift it. Recomputes on resize (ResizeObserver), video metadata, and rotation.
 */
export function useRoiViewport(
  layerRef: ElRef,
  getVideo: () => HTMLVideoElement | undefined,
  deps: unknown[],
): void {
  useEffect(() => {
    const rect = CONFIG.detect.roiRect;
    const layer = layerRef.current;
    if (!rect || !layer) return;

    const place = () => {
      const video = getVideo();
      const vw = video?.videoWidth ?? 0;
      const vh = video?.videoHeight ?? 0;
      const lw = layer.clientWidth;
      const lh = layer.clientHeight;
      if (!video || !vw || !vh || !lw || !lh) return;
      const v = computeRoiViewport(vw, vh, lw, lh, rect);
      video.style.position = 'absolute';
      video.style.maxWidth = 'none';
      video.style.width = `${v.width}px`;
      video.style.height = `${v.height}px`;
      video.style.left = `${v.left}px`;
      video.style.top = `${v.top}px`;
      video.style.objectFit = 'fill'; // dims already match the video's aspect, so fit is a no-op
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(layer);
    const video = getVideo();
    video?.addEventListener('loadedmetadata', place);
    video?.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    return () => {
      ro.disconnect();
      video?.removeEventListener('loadedmetadata', place);
      video?.removeEventListener('resize', place);
      window.removeEventListener('orientationchange', place);
    };
  }, deps);
}
