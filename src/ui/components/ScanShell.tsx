// src/ui/components/ScanShell.tsx
import { useState } from 'preact/hooks';
import type { ComponentChildren, RefObject } from 'preact';
import { pt } from '../../i18n/pt';
import type { CameraState } from '../hooks/useScanner';

export interface ScanShellProps {
  pageTitle: string;
  pageSubtitle: string;
  /** sr-only assertive announcement of each scan result. */
  announce: string;
  /** Hint under the mira when idle (differs per screen); the "reading" hint is shared. */
  holdStillText: string;

  cameraState: CameraState;
  ocrReady: boolean;
  ocrFailed: boolean;
  ocrProgress: number;
  reading: boolean;
  facing: 'user' | 'environment';
  videoLayerRef: RefObject<HTMLDivElement>;
  onFlip: () => void;
  onRetry: () => void;

  /** Manual-entry sheet — controlled by the screen (one source of truth for "open"). */
  manualOpen: boolean;
  setManualOpen: (open: boolean) => void;
  onManualSubmit: (value: string) => void;

  /** Optional extra root class (e.g. 'conferir-screen'). */
  rootClass?: string;
  /** ?debug tap-to-capture handler on the camera area (undefined = none). */
  onCamClick?: () => void;
  /** ?debug / ?record readouts (empty/false = hidden). */
  debugBeat?: string;
  debugText?: string;
  recCount?: number;
  recording?: boolean;

  // ---- slots ----
  /** cam-top, left side: counters, or back + counters. */
  topLeft?: ComponentChildren;
  /** cam-top actions, before the manual/flip icons: the "Terminar" pill (or nothing). */
  finishAction?: ComponentChildren;
  /** A full-camera overlay panel above cam-bottom (e.g. the multi-sticker panel). */
  overlay?: ComponentChildren;
  /** cam-bottom dock: verdict + screen-specific content. */
  bottom?: ComponentChildren;
  /** Extra control inside the manual sheet (e.g. ScanScreen's "Colar lista"). */
  manualExtra?: ComponentChildren;
}

export function ScanShell({
  pageTitle,
  pageSubtitle,
  announce,
  holdStillText,
  cameraState,
  ocrReady,
  ocrFailed,
  ocrProgress,
  reading,
  facing,
  videoLayerRef,
  onFlip,
  onRetry,
  manualOpen,
  setManualOpen,
  onManualSubmit,
  rootClass,
  onCamClick,
  debugBeat,
  debugText,
  recCount,
  recording,
  topLeft,
  finishAction,
  overlay,
  bottom,
  manualExtra,
}: ScanShellProps) {
  const [manualValue, setManualValue] = useState('');

  const submit = (e: Event) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    onManualSubmit(value);
    setManualValue('');
    setManualOpen(false);
  };

  return (
    <div class={`screen scan-screen${rootClass ? ' ' + rootClass : ''}`}>
      <p class="sr-only" role="status" aria-live="assertive">
        {announce}
      </p>

      <div class="pagetab">
        <span class="pagetab-name">{pageTitle}</span>
        <span class="pagetab-pg">{pageSubtitle}</span>
      </div>

      <div class="cam" onClick={onCamClick}>
        <div class="cam-top">
          {topLeft}
          <div class="cam-top-actions">
            {finishAction}
            {cameraState !== 'denied' && (
              <>
                <button
                  class="cam-icon-btn"
                  onClick={() => setManualOpen(true)}
                  aria-label={pt.scan.manualEntry}
                  title={pt.scan.manualEntry}
                >
                  📝
                </button>
                <button
                  class="cam-icon-btn"
                  onClick={onFlip}
                  aria-label={pt.scan.flipCamera}
                  title={facing === 'user' ? pt.scan.cameraFront : pt.scan.cameraBack}
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>

        {recording && (
          <div class="scan-rec" role="status">
            <span class="scan-rec-dot" aria-hidden="true" />
            Gravando · {recCount}
          </div>
        )}

        {debugBeat !== undefined && (
          <div class="debug-box">
            {debugBeat || 'iniciando…'}
            {debugText ? ` · ${debugText}` : ''}
          </div>
        )}

        {cameraState !== 'denied' && (
          <div class="mira-wrap">
            <div class={reading ? 'mira reading' : 'mira'}>
              <div class="scan-video-layer" ref={videoLayerRef} aria-hidden="true" />
              {reading && <span class="mira-scan" aria-hidden="true" />}
              <span class="corner tl" aria-hidden="true" />
              <span class="corner tr" aria-hidden="true" />
              <span class="corner bl" aria-hidden="true" />
              <span class="corner br" aria-hidden="true" />
              {cameraState === 'loading' && <span class="cole">{pt.scan.slotLabel}</span>}
            </div>
            {ocrReady && !bottom && (
              <span class={reading ? 'hint reading' : 'hint'}>
                <span class="pulse" aria-hidden="true" />
                {reading ? pt.scan.reading : holdStillText}
              </span>
            )}
          </div>
        )}

        {cameraState === 'ready' && !ocrReady && !ocrFailed && (
          <div class="scan-overlay">
            <div class="spinner" />
            <p>{pt.scan.preparing(ocrProgress)}</p>
          </div>
        )}
        {cameraState === 'ready' && ocrFailed && (
          <div class="scan-overlay scan-overlay-msg">
            <div class="scan-denied-emoji">📴</div>
            <p>{pt.scan.ocrUnavailable}</p>
            <button class="miss-action" type="button" onClick={() => setManualOpen(true)}>
              📝 {pt.scan.manualOpen}
            </button>
          </div>
        )}
        {cameraState === 'denied' && (
          <div class="scan-overlay scan-denied">
            <div class="scan-denied-emoji">📷</div>
            <h2>{pt.scan.cameraDenied}</h2>
            <p>{pt.scan.cameraDeniedHint}</p>
            <button class="btn btn-primary" onClick={onRetry}>
              {pt.scan.retry}
            </button>
          </div>
        )}

        {overlay}

        <div class="cam-bottom">{bottom}</div>
      </div>

      {manualOpen && (
        <div class="manual-sheet">
          <form class="manual-form" onSubmit={submit}>
            <h2 class="manual-title">{pt.scan.manualEntry}</h2>
            <input
              class="manual-input"
              type="text"
              inputMode="text"
              autocomplete="off"
              autocapitalize="characters"
              placeholder={pt.scan.manualPlaceholder}
              value={manualValue}
              onInput={(e) => setManualValue((e.currentTarget as HTMLInputElement).value)}
              autofocus
            />
            <div class="manual-actions">
              <button class="btn btn-ghost" type="button" onClick={() => setManualOpen(false)}>
                {pt.scan.manualCancel}
              </button>
              <button class="btn btn-primary" type="submit">
                {pt.scan.manualConfirm}
              </button>
            </div>
            {manualExtra}
          </form>
        </div>
      )}
    </div>
  );
}
