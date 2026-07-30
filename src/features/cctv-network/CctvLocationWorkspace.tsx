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
  formatLocationKst,
  getCctvSourceLabel,
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
const MIN_ZOOM=.7,MAX_ZOOM=2.2,ZOOM_STEP=.1;
const clampZoom=(value:number)=>Math.min(MAX_ZOOM,Math.max(MIN_ZOOM,Number(value.toFixed(2))));
function ToolIcon({kind}:{kind:"close"|"minus"|"plus"|"fit"|"expand"}){
  const paths={close:<path d="m6 6 12 12M18 6 6 18"/>,minus:<path d="M5 12h14"/>,plus:<path d="M12 5v14M5 12h14"/>,fit:<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>,expand:<path d="M9 3H3v6m12-6h6v6M9 21H3v-6m12 6h6v-6"/>};
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{paths[kind]}</svg>;
}

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
      aria-label={expanded ? "CCTV 설치 좌표 확대 보기 영역" : "CCTV 설치 좌표 확대 보기"}
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
      {!expanded ? <span className={styles.openHint}>클릭하여 설치 좌표 확대 보기</span> : null}
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
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
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
      zoom: clampZoom(current.zoom+amount),
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
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
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
            <span>설치 좌표 확대 보기</span>
            <h2 id="cctv-location-title">{cctv.name}</h2>
            <p>{cctv.code}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="설치 좌표 확대 보기 닫기">
            <ToolIcon kind="close"/>
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
              <button type="button" disabled={viewport.zoom<=MIN_ZOOM} onClick={() => zoomBy(-ZOOM_STEP)} aria-label="축소" title="축소">
                <ToolIcon kind="minus"/>
              </button>
              <output aria-label="현재 확대율">{Math.round(viewport.zoom * 100)}%</output>
              <button type="button" disabled={viewport.zoom>=MAX_ZOOM} onClick={() => zoomBy(ZOOM_STEP)} aria-label="확대" title="확대">
                <ToolIcon kind="plus"/>
              </button>
              <button
                type="button"
                onClick={() => setViewport((current) => ({ ...current, x: 0, y: 0 }))}
                aria-label="위치 맞춤"
                title="위치 맞춤"
              >
                <ToolIcon kind="fit"/>
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
                <dd>{getCctvSourceLabel(cctv.sourceType)}</dd>
              </div>
              <div>
                <dt>최근 동기화</dt>
                <dd>{formatLocationKst(cctv.lastSuccessfulSyncAt)}</dd>
              </div>
            </dl>
            <p className={styles.guide}>
              등록된 위도·경도 값을 확인하기 위한 좌표 도식입니다. 실제 지도 위치나 주변 시설과의
              관계를 나타내지 않습니다.
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
          <h3 id="location-preview-title">설치 좌표 확인</h3>
          <p>등록된 위도·경도 값과 선택한 CCTV 좌표의 기준점을 확인합니다.</p>
        </div>
        <button
          ref={expandButtonRef}
          type="button"
          className={styles.expandButton}
          onClick={() => setExpanded(true)}
        >
          <ToolIcon kind="expand"/> 설치 좌표 확대 보기
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
        등록된 위도·경도 값을 확인하기 위한 좌표 도식입니다. 화면상의 기준점은 실제 지도 위치나
        주변 시설과의 관계를 나타내지 않습니다.
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
