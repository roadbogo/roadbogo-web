"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { formatRiskGrade } from "@/features/control-dashboard/dashboardDomain";
import type { IncidentEvidence } from "./incidentDetailTypes";

export type EvidenceViewMode = "annotated" | "original" | "compare";

export const evidenceViewOptions: ReadonlyArray<{
  value: EvidenceViewMode;
  label: string;
}> = [
  { value: "annotated", label: "탐지 결과" },
  { value: "original", label: "원본" },
  { value: "compare", label: "결과 비교" },
];

const viewLabels = Object.fromEntries(
  evidenceViewOptions.map(({ value, label }) => [value, label]),
) as Record<EvidenceViewMode, string>;

function Icon({
  name,
}: {
  name: "back" | "close" | "minus" | "plus" | "previous" | "next" | "chevron";
}) {
  const paths = {
    back: <path d="m15 18-6-6 6-6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    minus: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4M8 11h6" /></>,
    plus: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4M11 8v6M8 11h6" /></>,
    previous: <path d="m15 18-6-6 6-6" />,
    next: <path d="m9 18 6-6-6-6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function evidenceTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

interface EvidenceFocusDialogProps {
  incidentNo: string;
  evidences: IncidentEvidence[];
  selectedId: string;
  view: EvidenceViewMode;
  onSelect: (id: string) => void;
  onView: (view: EvidenceViewMode) => void;
  onClose: () => void;
  renderVisual: (evidence: IncidentEvidence, view: EvidenceViewMode) => ReactNode;
}

type ZoomMode = "fit" | "width" | "manual";
type ZoomOption = { id:string; label:string; mode:ZoomMode; zoom?:number };
const zoomSteps=[50,75,100,125,150,200] as const;
const zoomOptions:ZoomOption[]=[
  {id:"fit",label:"전체 보기",mode:"fit"},
  {id:"width",label:"너비 맞춤",mode:"width"},
  {id:"actual",label:"실제 크기 100%",mode:"manual",zoom:100},
  ...([50,75,125,150,200] as const).map(zoom=>({id:`zoom-${zoom}`,label:`${zoom}%`,mode:"manual" as const,zoom})),
];

export function EvidenceFocusDialog({
  incidentNo,
  evidences,
  selectedId,
  view,
  onSelect,
  onView,
  onClose,
  renderVisual,
}: EvidenceFocusDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const zoomMenuButtonRef = useRef<HTMLButtonElement>(null);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const zoomItemRefs = useRef<Array<HTMLButtonElement|null>>([]);
  const onCloseRef = useRef(onClose);
  const onSelectRef = useRef(onSelect);
  const zoomRef=useRef(100);
  const [zoom, setZoom] = useState(100);
  const [zoomMode,setZoomMode]=useState<ZoomMode>("fit");
  const [zoomMenuOpen,setZoomMenuOpen]=useState(false);
  const [pannable,setPannable]=useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);

  const selectedIndex = Math.max(
    0,
    evidences.findIndex((item) => item.detection_public_id === selectedId),
  );
  const evidence = evidences[selectedIndex] ?? evidences[0];

  const clampOffset=useCallback((next:{x:number;y:number},scale=zoom)=>{
    const stage=stageRef.current,content=transformRef.current;
    if(!stage||!content)return next;
    const limitX=Math.max(0,(content.offsetWidth*scale/100-stage.clientWidth)/2);
    const limitY=Math.max(0,(content.offsetHeight*scale/100-stage.clientHeight)/2);
    return{x:Math.max(-limitX,Math.min(limitX,next.x)),y:Math.max(-limitY,Math.min(limitY,next.y))};
  },[zoom]);

  const calculateAutomaticZoom=useCallback((mode:"fit"|"width")=>{
    const stage=stageRef.current,content=transformRef.current;
    if(!stage||!content||!stage.clientWidth||!stage.clientHeight||!content.offsetWidth||!content.offsetHeight)return 100;
    const widthScale=stage.clientWidth/content.offsetWidth;
    const heightScale=stage.clientHeight/content.offsetHeight;
    return Math.max(50,Math.min(200,Math.round((mode==="fit"?Math.min(widthScale,heightScale):widthScale)*100)));
  },[]);

  const measurePannable=useCallback((scale:number)=>{
    const stage=stageRef.current,content=transformRef.current;
    return Boolean(stage&&content&&(content.offsetWidth*scale/100>stage.clientWidth||content.offsetHeight*scale/100>stage.clientHeight));
  },[]);

  const applyAutomaticZoom=useCallback((mode:"fit"|"width")=>{
    const value=calculateAutomaticZoom(mode);
    setZoomMode(mode);
    zoomRef.current=value;
    setZoom(value);
    setPannable(measurePannable(value));
    setOffset({x:0,y:0});
    setDrag(null);
  },[calculateAutomaticZoom,measurePannable]);

  const changeZoom = useCallback((next: number,resetPosition=false) => {
    const value = Math.max(50, Math.min(200, next));
    setZoomMode("manual");
    zoomRef.current=value;
    setZoom(value);
    setPannable(measurePannable(value));
    setOffset(current=>resetPosition?{x:0,y:0}:clampOffset(current,value));
    setDrag(null);
  }, [clampOffset,measurePannable]);

  const stepZoom=useCallback((direction:-1|1)=>{
    const next=direction<0
      ? [...zoomSteps].reverse().find(step=>step<zoom)
      : zoomSteps.find(step=>step>zoom);
    if(next!==undefined)changeZoom(next);
  },[changeZoom,zoom]);

  const closeZoomMenu=useCallback((restoreFocus=true)=>{
    setZoomMenuOpen(false);
    if(restoreFocus)window.requestAnimationFrame(()=>zoomMenuButtonRef.current?.focus());
  },[]);

  const select = useCallback((index: number) => {
    const next = evidences[index];
    if (!next) return;
    onSelectRef.current(next.detection_public_id);
  }, [evidences]);

  useEffect(() => {
    onCloseRef.current = onClose;
    onSelectRef.current = onSelect;
  }, [onClose, onSelect]);

  useLayoutEffect(()=>{
    setOffset({x:0,y:0});
    setDrag(null);
    const nextZoom=zoomMode==="manual"?zoomRef.current:calculateAutomaticZoom(zoomMode);
    if(zoomMode!=="manual"){zoomRef.current=nextZoom;setZoom(nextZoom)}
    setPannable(measurePannable(nextZoom));
  },[calculateAutomaticZoom,measurePannable,selectedId,view,zoomMode]);

  useEffect(()=>{
    const stage=stageRef.current,content=transformRef.current;
    if(!stage||!content||typeof ResizeObserver==="undefined")return;
    const observer=new ResizeObserver(()=>{
      const nextZoom=zoomMode==="manual"?zoomRef.current:calculateAutomaticZoom(zoomMode);
      if(zoomMode==="manual")setOffset(current=>clampOffset(current));
      else{zoomRef.current=nextZoom;setZoom(nextZoom)}
      setPannable(measurePannable(nextZoom));
    });
    observer.observe(stage);observer.observe(content);
    return()=>observer.disconnect();
  },[calculateAutomaticZoom,clampOffset,measurePannable,zoomMode]);

  useEffect(()=>{
    if(!zoomMenuOpen)return;
    window.requestAnimationFrame(()=>{
      const selectedIndex=zoomOptions.findIndex(option=>option.mode===zoomMode&&(option.mode!=="manual"||option.zoom===zoom));
      zoomItemRefs.current[Math.max(0,selectedIndex)]?.focus();
    });
    const outside=(event:PointerEvent)=>{
      const target=event.target;
      if(target instanceof Node&&!zoomMenuRef.current?.contains(target)&&!zoomMenuButtonRef.current?.contains(target))closeZoomMenu(false);
    };
    document.addEventListener("pointerdown",outside);
    return()=>document.removeEventListener("pointerdown",outside);
  },[closeZoomMenu,zoom,zoomMenuOpen,zoomMode]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if(event.defaultPrevented)return;
      const target = event.target;
      if (target instanceof Element && target.matches("input, textarea, select")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        if(zoomMenuOpen)closeZoomMenu();
        else onCloseRef.current();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        select(selectedIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        select(selectedIndex + 1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        stepZoom(1);
      } else if (event.key === "-") {
        event.preventDefault();
        stepZoom(-1);
      } else if (event.key === "0") {
        event.preventDefault();
        changeZoom(100,true);
      } else if (event.key === "Tab" && dialogRef.current) {
        const controls = [
          ...dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex="0"]',
          ),
        ];
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [changeZoom, closeZoomMenu, select, selectedIndex, stepZoom, zoomMenuOpen]);

  if (!evidence) {
    return (
      <div className="evidence-focus-backdrop">
        <section
          ref={dialogRef}
          className="evidence-focus evidence-focus--empty"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evidence-focus-title"
        >
          <button ref={closeRef} type="button" onClick={onClose}>
            사건 상세로 돌아가기
          </button>
          <h2 id="evidence-focus-title">집중 검토할 증거가 없습니다</h2>
        </section>
      </div>
    );
  }

  const canPan=()=>{
    const stage=stageRef.current,content=transformRef.current;
    return Boolean(stage&&content&&(content.offsetWidth*zoom/100>stage.clientWidth||content.offsetHeight*zoom/100>stage.clientHeight));
  };
  const pointerDown = (event: ReactPointerEvent) => {
    if (!canPan()) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      x: event.clientX,
      y: event.clientY,
      originX: offset.x,
      originY: offset.y,
    });
  };
  const pointerMove = (event: ReactPointerEvent) => {
    if (!drag) return;
    setOffset(clampOffset({
      x:drag.originX+event.clientX-drag.x,
      y:drag.originY+event.clientY-drag.y,
    }));
  };
  const wheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    stepZoom(event.deltaY<0?1:-1);
  };
  const selectZoomOption=(option:ZoomOption)=>{
    if(option.mode==="manual")changeZoom(option.zoom??100,option.zoom===100);
    else applyAutomaticZoom(option.mode);
    closeZoomMenu();
  };
  const selectedZoomOption=(option:ZoomOption)=>option.mode===zoomMode&&(option.mode!=="manual"||option.zoom===zoom);
  const zoomLabel=zoomMode==="fit"?"전체 보기":zoomMode==="width"?"너비 맞춤":`${zoom}%`;
  const zoomMenuKeyDown=(event:ReactKeyboardEvent)=>{
    const current=zoomItemRefs.current.findIndex(item=>item===document.activeElement);
    let next=current;
    if(event.key==="ArrowDown")next=(current+1+zoomOptions.length)%zoomOptions.length;
    else if(event.key==="ArrowUp")next=(current-1+zoomOptions.length)%zoomOptions.length;
    else if(event.key==="Home")next=0;
    else if(event.key==="End")next=zoomOptions.length-1;
    else if(event.key==="Escape"){event.preventDefault();closeZoomMenu();return}
    else if(event.key==="Tab"){closeZoomMenu(false);return}
    else return;
    event.preventDefault();zoomItemRefs.current[next]?.focus();
  };
  const objectName = evidence.class_name ?? "탐지 객체";

  return (
    <div className="evidence-focus-backdrop">
      <section
        ref={dialogRef}
        className="evidence-focus"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-focus-title"
        aria-describedby="evidence-focus-description"
      >
        <header>
          <button type="button" className="evidence-focus__back" onClick={onClose}>
            <Icon name="back" />
            사건 상세로 돌아가기
          </button>
          <div>
            <h2 id="evidence-focus-title" title={`${incidentNo} · ${objectName}`}>
              {incidentNo} · {objectName}
            </h2>
            <p id="evidence-focus-description">
              {viewLabels[view]} · {evidenceTime(evidence.detected_at)} KST
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="evidence-focus__close"
            aria-label="집중 검토 닫기"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="evidence-focus__body">
          <main
            ref={stageRef}
            className="evidence-focus__stage"
            tabIndex={0}
            aria-label={`${incidentNo} ${objectName} ${viewLabels[view]} 이미지`}
            onWheel={wheel}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerCancel={() => setDrag(null)}
            data-draggable={pannable || undefined}
          >
            <div
              ref={transformRef}
              className="evidence-focus__transform"
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom / 100})`,
              }}
            >
              {renderVisual(evidence, view)}
            </div>
          </main>

          <aside>
            <header>
              <span>선택 근거</span>
              {evidence.is_representative && <b>대표 근거</b>}
            </header>
            <dl>
              <div><dt>객체</dt><dd>{objectName}</dd></div>
              {evidence.class_code && <div><dt>클래스</dt><dd>{evidence.class_code}</dd></div>}
              {evidence.confidence !== null && <div><dt>신뢰도</dt><dd>{Math.round(evidence.confidence * 100)}%</dd></div>}
              <div><dt>탐지 시각</dt><dd>{evidenceTime(evidence.detected_at)} KST</dd></div>
              <div><dt>지속 시간</dt><dd>{(evidence.risk.duration_ms / 1000).toFixed(1)}초</dd></div>
              <div><dt>반복 탐지</dt><dd>{evidence.risk.repeat_count}회</dd></div>
              <div><dt>위험 점수</dt><dd>{evidence.risk.risk_score}</dd></div>
              <div><dt>위험 등급</dt><dd>{formatRiskGrade(evidence.risk.risk_grade)}</dd></div>
              {evidence.risk.track_id && <div><dt>추적 객체</dt><dd>{evidence.risk.track_id}</dd></div>}
              <div><dt>근거 번호</dt><dd>{selectedIndex + 1} / {evidences.length}</dd></div>
            </dl>
            <fieldset>
              <legend>보기 방식</legend>
              {evidenceViewOptions.map(({ value, label }) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={view === value}
                  onClick={() => onView(value)}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </aside>
        </div>

        <nav className="evidence-focus__navigation" aria-label="사건 근거 탐색">
          <button type="button" disabled={selectedIndex === 0} onClick={() => select(selectedIndex - 1)}>
            <Icon name="previous" />
            이전 근거
          </button>
          <div>
            {evidences.map((item, index) => {
              const src = item.original_image_url ?? item.annotated_image_url;
              return (
                <button
                  type="button"
                  key={item.detection_public_id}
                  className={index === selectedIndex ? "is-current" : ""}
                  aria-pressed={index === selectedIndex}
                  aria-label={`${index + 1}번 근거${item.is_representative ? " 대표 근거" : ""}`}
                  onClick={() => select(index)}
                >
                  {src ? (
                    <span><Image src={src} alt="" fill sizes="72px" /></span>
                  ) : (
                    <span className="is-empty">이미지 없음</span>
                  )}
                  <small>{item.confidence === null ? "—" : `${Math.round(item.confidence * 100)}%`}</small>
                </button>
              );
            })}
          </div>
          <strong aria-live="polite">{selectedIndex + 1} / {evidences.length}</strong>
          <button
            type="button"
            disabled={selectedIndex === evidences.length - 1}
            onClick={() => select(selectedIndex + 1)}
          >
            다음 근거
            <Icon name="next" />
          </button>
        </nav>

        <footer>
          <button type="button" aria-label="이미지 축소" onClick={() => stepZoom(-1)} disabled={zoom <= 50}>
            <Icon name="minus" />
            축소
          </button>
          <div className="evidence-focus__zoom-control">
            <button ref={zoomMenuButtonRef} type="button" className="evidence-focus__zoom-trigger" aria-haspopup="menu" aria-expanded={zoomMenuOpen} aria-controls="evidence-view-menu" onClick={()=>setZoomMenuOpen(open=>!open)}>{zoomLabel}<Icon name="chevron"/></button>
            {zoomMenuOpen&&<div ref={zoomMenuRef} id="evidence-view-menu" className="evidence-focus__zoom-menu" role="menu" aria-label="이미지 보기 설정" onKeyDown={zoomMenuKeyDown}>
              {zoomOptions.map((option,index)=><button ref={node=>{zoomItemRefs.current[index]=node}} type="button" role="menuitemradio" aria-checked={selectedZoomOption(option)} key={option.id} data-group={index===3?"scale":undefined} onClick={()=>selectZoomOption(option)}><span aria-hidden="true">{selectedZoomOption(option)?"✓":""}</span>{option.label}</button>)}
            </div>}
          </div>
          <button type="button" aria-label="이미지 확대" onClick={() => stepZoom(1)} disabled={zoom >= 200}>
            <Icon name="plus" />
            확대
          </button>
        </footer>
      </section>
    </div>
  );
}
