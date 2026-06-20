import { useEffect } from 'preact/hooks';
import { CONFIG } from '../../config';

type ElRef = { current: HTMLElement | null };

/**
 * Keep an absolutely-positioned reticle aligned with the detection ROI. `CONFIG.detect.roiRect`
 * is normalized to the camera FRAME, but the frame is shown object-fit:contain (letterboxed), so
 * we map the ROI through the displayed video rect. Without this the "cole aqui" window and the
 * region the recognizer actually reads drift apart. Shared by the scanner and the capture tool so
 * they can't diverge. The ROI is x-symmetric, so the front camera's display mirroring doesn't shift
 * it. Recomputes on resize (ResizeObserver), video metadata, and orientation change.
 */
export function useReticleAlignment(
  wrapRef: ElRef,
  reticleRef: ElRef,
  getVideo: () => HTMLVideoElement | undefined,
  deps: unknown[],
): void {
  useEffect(() => {
    const rect = CONFIG.detect.roiRect;
    const reticle = reticleRef.current;
    const wrap = wrapRef.current;
    if (!rect || !reticle || !wrap) return;

    const place = () => {
      const video = getVideo();
      const vw = video?.videoWidth ?? 0;
      const vh = video?.videoHeight ?? 0;
      const ww = wrap.clientWidth;
      const wh = wrap.clientHeight;
      if (!vw || !vh || !ww || !wh) return;
      const scale = Math.min(ww / vw, wh / vh); // object-fit: contain
      const dispW = vw * scale;
      const dispH = vh * scale;
      const offX = (ww - dispW) / 2;
      const offY = (wh - dispH) / 2;
      reticle.style.left = `${offX + rect.left * dispW}px`;
      reticle.style.top = `${offY + rect.top * dispH}px`;
      reticle.style.width = `${(rect.right - rect.left) * dispW}px`;
      reticle.style.height = `${(rect.bottom - rect.top) * dispH}px`;
      reticle.style.transform = 'none';
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(wrap);
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
