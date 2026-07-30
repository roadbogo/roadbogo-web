"use client";

import { createPortal } from "react-dom";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import type { NetworkCctv } from "./cctvNetworkTypes";
import {
  formatCoordinate,
  getDirectionLabel,
  validateCoordinates,
} from "./cctvLocationDomain";
import styles from "./CctvLocationWorkspace.module.css";

type Props = {
  cctv: NetworkCctv;
  roadName?: string;
  sectionName?: string;
};

type Viewport = { zoom: number; x: number; y: number };

const INITIAL_VIEWPORT: Viewport = { zoom: 1, x: 0, y: 0 };

function CoordinatePlane({
  cctv,
  expanded,
  viewport = INITIAL_VIEWPORT,
  onOpen,
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: Props & {
  expanded?: boolean;
  viewport?: Viewport;
  onOpen?: () => void;
  onWheel?: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const coordinates = validateCoordinates(cctv.latitude, cctv.longitude);

  if (!coordinates.valid) {
    return (
      <div className={styles.unavailable} role="status">
        <strong>위치 좌표를 확인할 수 없습니다.</strong>
        <span>
          {coordinates.reason === "OUT_OF_RANGE"
            ? "등록된 좌표가 유효 범위를 벗어났습니다."
            : "등록된 설치 좌표가 없습니다."}
        </span>
      </div>
    );
  }

  const activate = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!expanded && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onOpen?.();
    }
  };

  return (
    <div
      className={`${styles.plane} ${expanded ? styles.expandedPlane : ""}`}
      role={expanded ? undefined : "button"}
      tabIndex={expanded ? undefined : 0}
      aria-label={expanded ? "CCTV 설치 좌표 조사 영역" : "CCTV 설치 위치 크게 보기"}
      onClick={expanded ? undefined : onOpen}
      onKeyDown={activate}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={styles.planeLayer}
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
        }}
      >
        <div className={styles.axisX} aria-hidden="true" />
        <div className={styles.axisY} aria-hidden="true" />
        <div className={styles.marker}>
          <span className={styles.markerDot} aria-hidden="true" />
          <strong>{cctv.name}</strong>
          <small>
            {formatCoordinate(coordinates.latitude)}, {formatCoordinate(coordinates.longitude)}
          </small>
        </div>
      </div>
      {!expanded ? <span className={styles.openHint}>클릭하여 위치 크게 보기</span> : null}
    </div>
  );
}

function CopyCoordinates({ cctv }: { cctv: NetworkCctv }) {
  const [message, setMessage] = useState("");
  const coordinates = validateCoordinates(cctv.latitude, cctv.longitude);

  if (!coordinates.valid) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${formatCoordinate(coordinates.latitude)}, ${formatCoordinate(coordinates.longitude)}`,
      );
      setMessage("설치 좌표가 복사되었습니다.");
    } catch {
      setMessage("좌표를 복사하지 못했습니다.");
    }
  };

  return (
    <>
      <button type="button" className={styles.copyButton} onClick={copy}>
        좌표 복사
      </button>
      <span className={styles.srOnly} aria-live="polite">
        {message}
      </span>
    </>
  );
}

function LocationDetails({ cctv, roadName, sectionName }: Props) {
  const coordinates = validateCoordinates(cctv.latitude, cctv.longitude);

  return (
    <dl className={styles.details}>
      <div>
        <dt>설치 위치</dt>
        <dd>{cctv.name}</dd>
      </div>
      <div>
        <dt>도로 · 구간</dt>
        <dd>{[roadName, sectionName].filter(Boolean).join(" · ") || "정보 없음"}</dd>
      </div>
      <div>
        <dt>설치 좌표</dt>
        <dd className={styles.coordinateValue}>
          {coordinates.valid
            ? `${formatCoordinate(coordinates.latitude)}, ${formatCoordinate(coordinates.longitude)}`
            : "확인 불가"}
          <CopyCoordinates cctv={cctv} />
        </dd>
      </div>
      <div>
        <dt>촬영 방향</dt>
        <dd>{getDirectionLabel(cctv.directionCode)}</dd>
      </div>
    </dl>
  );
}

function FullscreenLocation({
  cctv,
  roadName,
  sectionName,
  onClose,
  returnFocusRef,
}: Props & {
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocusTarget = returnFocusRef.current;
    dialog?.focus();

    const handleKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      returnFocusTarget?.focus();
    };
  }, [onClose, returnFocusRef]);

  const zoomBy = (amount: number) =>
    setViewport((current) => ({
      ...current,
      zoom: Math.min(2.2, Math.max(0.7, Number((current.zoom + amount).toFixed(2)))),
    }));

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setViewport((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -0.1 : 0.1);
  };

  return createPortal(
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cctv-location-title"
        tabIndex={-1}
      >
        <header className={styles.dialogHeader}>
          <div>
            <span>좌표 기반 위치 조사</span>
            <h2 id="cctv-location-title">{cctv.name}</h2>
            <p>{cctv.code}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="위치 조사 닫기">
            ×
          </button>
        </header>
        <div className={styles.dialogBody}>
          <div className={styles.workspace}>
            <CoordinatePlane
              cctv={cctv}
              roadName={roadName}
              sectionName={sectionName}
              expanded
              viewport={viewport}
              onWheel={wheel}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
            />
            <div className={styles.mapTools} aria-label="좌표 조사 도구">
              <button type="button" onClick={() => zoomBy(-0.1)} aria-label="축소" title="축소">
                −
              </button>
              <output aria-label="현재 확대율">{Math.round(viewport.zoom * 100)}%</output>
              <button type="button" onClick={() => zoomBy(0.1)} aria-label="확대" title="확대">
                +
              </button>
              <button
                type="button"
                onClick={() => setViewport((current) => ({ ...current, x: 0, y: 0 }))}
                aria-label="위치 맞춤"
                title="위치 맞춤"
              >
                ◎
              </button>
              <button
                type="button"
                onClick={() => setViewport(INITIAL_VIEWPORT)}
                aria-label="보기 초기화"
                title="보기 초기화"
              >
                초기화
              </button>
            </div>
          </div>
          <aside className={styles.infoRail} aria-label="CCTV 위치 정보">
            <h3>설치 정보</h3>
            <LocationDetails cctv={cctv} roadName={roadName} sectionName={sectionName} />
            <dl className={styles.details}>
              <div>
                <dt>데이터 출처</dt>
                <dd>{cctv.sourceType}</dd>
              </div>
              <div>
                <dt>최근 동기화</dt>
                <dd>{cctv.lastSuccessfulSyncAt || "기록 없음"}</dd>
              </div>
            </dl>
            <p className={styles.guide}>
              이 화면은 등록된 설치 좌표를 조사하기 위한 좌표 기반 보기입니다. 실제 도로 영상과
              설치 방향은 CCTV 스트림에서 확인하세요.
            </p>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CctvLocationWorkspace({ cctv, roadName, sectionName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <section className={styles.preview} aria-labelledby="location-preview-title">
      <header>
        <div>
          <h3 id="location-preview-title">좌표 기반 위치 미리보기</h3>
          <p>등록된 설치 좌표를 기준으로 위치를 확인합니다.</p>
        </div>
        <button
          ref={expandButtonRef}
          type="button"
          className={styles.expandButton}
          onClick={() => setExpanded(true)}
        >
          <span aria-hidden="true">⛶</span> 크게 보기
        </button>
      </header>
      <CoordinatePlane
        cctv={cctv}
        roadName={roadName}
        sectionName={sectionName}
        onOpen={() => setExpanded(true)}
      />
      <LocationDetails cctv={cctv} roadName={roadName} sectionName={sectionName} />
      <p className={styles.guide}>
        지도 배경이 아닌 등록 좌표 기반 미리보기입니다. 크게 보기에서 확대와 이동으로 좌표 위치를
        조사할 수 있습니다.
      </p>
      {expanded ? (
        <FullscreenLocation
          cctv={cctv}
          roadName={roadName}
          sectionName={sectionName}
          onClose={() => setExpanded(false)}
          returnFocusRef={expandButtonRef}
        />
      ) : null}
    </section>
  );
}
