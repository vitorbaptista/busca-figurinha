// Gated dataset-capture tool (?capture) — NOT part of the normal app. The owner holds a sticker
// whose code they know, types it, and burst-captures labeled full frames; a "negative" toggle
// grabs not-a-sticker frames for false-positive testing. Frames persist on-device (IndexedDB) and
// Export bundles them into one .bin for `adb pull`. Uses object-fit:contain + the ROI-aligned
// reticle so the pill lands exactly where the recognizer will read it offline.
import { useEffect, useRef, useState } from 'preact/hooks';
import { CONFIG } from '../../config';
import { checklist } from '../../data/checklist';
import { createCameraSource } from '../../ocr/frameSource';
import { useReticleAlignment } from '../../ui/hooks/useReticleAlignment';
import { addFrame, frameCount, clearFrames } from './captureStore';
import { exportCapture } from './exportBundle';

const ALL_CODES = checklist.entries.map((e) => e.code);

export function CaptureScreen() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const videoLayerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<ReturnType<typeof createCameraSource> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const passRef = useRef(0);

  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [code, setCode] = useState('');
  const [negative, setNegative] = useState(false);
  const [recording, setRecording] = useState(false);
  const [total, setTotal] = useState(0);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [status, setStatus] = useState('Digite um código, mostre a etiqueta e toque em Gravar.');

  // Refs so the capture interval always reads the latest label without restarting.
  const codeRef = useRef(code);
  codeRef.current = code.trim().toUpperCase();
  const negRef = useRef(negative);
  negRef.current = negative;

  const trimmed = code.trim().toUpperCase();
  const validCode = negative || checklist.byCode.has(trimmed);
  const currentLabel = negative ? '__neg__' : trimmed;

  // Initial persisted count.
  useEffect(() => {
    void frameCount().then(setTotal);
  }, []);

  // Camera lifecycle (restarts on flip).
  useEffect(() => {
    let cancelled = false;
    const source = createCameraSource({ facingMode: facing });
    sourceRef.current = source;
    source
      .start()
      .then(() => {
        if (cancelled) {
          source.stop();
          return;
        }
        source.element.classList.add('capture-video');
        videoLayerRef.current?.replaceChildren(source.element);
      })
      .catch(() => setStatus('Câmera indisponível.'));
    return () => {
      cancelled = true;
      source.stop();
    };
  }, [facing]);

  useReticleAlignment(
    wrapRef,
    reticleRef,
    () => sourceRef.current?.element as HTMLVideoElement | undefined,
    [facing],
  );

  // Burst capture: while recording, grab a labeled full frame ~4×/sec.
  useEffect(() => {
    if (!recording) return;
    passRef.current += 1;
    const thisPass = passRef.current;
    const id = window.setInterval(() => {
      const src = sourceRef.current;
      const canvas = canvasRef.current;
      if (!src || !canvas || !src.isReady()) return;
      if (!src.drawTo(canvas, CONFIG.ocr.maxWidth)) return;
      const label = negRef.current ? '__neg__' : codeRef.current;
      // Re-validate EVERY tick: the label must never drift to a non-checklist code, or we'd persist
      // corrupt ground truth. (Inputs are also locked while recording, but this is the real guard.)
      if (!label || (!negRef.current && !checklist.byCode.has(label))) return;
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          void addFrame({ blob, code: label, pass: thisPass, ts: Date.now() }).then(() => {
            setTotal((t) => t + 1);
            setTally((m) => ({ ...m, [label]: (m[label] ?? 0) + 1 }));
          });
        },
        'image/jpeg',
        0.82,
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [recording]);

  const toggleRecord = () => {
    setConfirmClear(false);
    if (!recording && !validCode) {
      setStatus('Escolha um código válido (ou marque "negativo") antes de gravar.');
      return;
    }
    setStatus('');
    setRecording((r) => !r);
  };

  const onExport = async () => {
    setConfirmClear(false);
    setStatus('Exportando…');
    const n = await exportCapture();
    setStatus(
      n === 0
        ? 'Nada para exportar ainda.'
        : `Exportado ${n} frames para Downloads. Agora: adb pull /sdcard/Download/figurinhas-capture-*.bin`,
    );
  };

  const onClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setStatus('Toque de novo para apagar TODOS os frames capturados (exporte antes!).');
      return;
    }
    await clearFrames();
    setConfirmClear(false);
    setTotal(0);
    setTally({});
    setStatus('Captura apagada.');
  };

  return (
    <div class="capture-screen">
      <div class="capture-video-wrap" ref={wrapRef}>
        <div class="capture-video-layer" ref={videoLayerRef} />
        <div class="capture-reticle" ref={reticleRef} />
        {recording && <div class="capture-rec">● REC · pass {passRef.current}</div>}
      </div>
      <canvas ref={canvasRef} style="display:none" />

      <div class="capture-controls">
        <div class="capture-row">
          <input
            class="capture-input"
            list="cap-codes"
            value={code}
            disabled={negative || recording}
            placeholder="código (ex: CIV12)"
            onInput={(e) => {
              setConfirmClear(false);
              setCode((e.target as HTMLInputElement).value);
            }}
          />
          <datalist id="cap-codes">
            {ALL_CODES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <label class="capture-neg">
            <input
              type="checkbox"
              checked={negative}
              disabled={recording}
              onChange={(e) => {
                setConfirmClear(false);
                setNegative((e.target as HTMLInputElement).checked);
              }}
            />{' '}
            negativo
          </label>
        </div>

        <div class="capture-row">
          <button class={recording ? 'capture-btn is-rec' : 'capture-btn'} onClick={toggleRecord}>
            {recording ? '■ Parar' : '● Gravar'}
          </button>
          <button
            class="capture-btn"
            onClick={() => {
              setConfirmClear(false);
              setFacing((f) => (f === 'user' ? 'environment' : 'user'));
            }}
          >
            ↻ câmera
          </button>
        </div>

        <div class="capture-stats">
          total: <strong>{total}</strong>
          {' · '}
          {validCode ? `etiqueta: ${currentLabel}` : 'sem código'}
          {tally[currentLabel] ? ` (${tally[currentLabel]} nesta etiqueta)` : ''}
        </div>

        <div class="capture-row">
          <button class="capture-btn" onClick={onExport}>
            ⬇ Exportar .bin
          </button>
          <button class="capture-btn capture-danger" onClick={onClear}>
            {confirmClear ? 'Confirmar apagar' : 'Apagar tudo'}
          </button>
        </div>

        <p class="capture-help">{status}</p>
      </div>
    </div>
  );
}
