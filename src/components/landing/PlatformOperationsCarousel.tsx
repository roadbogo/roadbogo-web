"use client";
import { useEffect, useRef, useState } from "react";
import { OperationalOverview } from "./OperationalOverview";
import { ResponseFlowSection } from "./ResponseFlowSection";

const slides=[{label:"운영 구조",key:"operation"},{label:"사건 처리 흐름",key:"flow"}] as const;

export function PlatformOperationsCarousel(){
 const[active,setActive]=useState(0);const dragStart=useRef<number|null>(null);
 const select=(index:number)=>{const next=Math.max(0,Math.min(slides.length-1,index));setActive(next);window.dispatchEvent(new CustomEvent("roadbogo:platform-slide-change",{detail:{key:slides[next].key}}))};
 useEffect(()=>{const onSelect=(event:Event)=>select((event as CustomEvent<{key:string}>).detail.key==="flow"?1:0);window.addEventListener("roadbogo:platform-slide",onSelect);return()=>window.removeEventListener("roadbogo:platform-slide",onSelect)},[]);
 const endDrag=(clientX:number)=>{if(dragStart.current===null)return;const distance=clientX-dragStart.current;dragStart.current=null;if(Math.abs(distance)>55)select(active+(distance<0?1:-1))};
 return <section id="platform-operations" className="platform-carousel" aria-labelledby="platform-carousel-title" tabIndex={0} onKeyDown={event=>{if(event.key==="ArrowLeft")select(active-1);if(event.key==="ArrowRight")select(active+1)}}>
  <header className="platform-carousel__heading"><p>PLATFORM OPERATIONS</p><h2 id="platform-carousel-title">통합 사건 운영 체계</h2></header>
  <div className="platform-carousel__navigation"><nav className="platform-carousel__tabs" aria-label="플랫폼 운영 경로" aria-orientation="horizontal" role="tablist" onKeyDown={event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();event.stopPropagation();const next=event.key==="Home"?0:event.key==="End"?slides.length-1:Math.max(0,Math.min(slides.length-1,active+(event.key==="ArrowRight"?1:-1)));select(next);event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()}}>{slides.map((slide,index)=><button type="button" id={`platform-tab-${slide.key}`} aria-controls={`platform-panel-${slide.key}`} key={slide.key} className={active===index?"is-active":""} aria-selected={active===index} role="tab" tabIndex={active===index?0:-1} onClick={()=>select(index)}><span>0{index+1}</span><strong>{slide.label}</strong></button>)}</nav></div>
  <div className="platform-carousel__viewport" onMouseDown={event=>{dragStart.current=event.clientX}} onMouseUp={event=>endDrag(event.clientX)} onMouseLeave={()=>{dragStart.current=null}} onTouchStart={event=>{dragStart.current=event.touches[0].clientX}} onTouchEnd={event=>endDrag(event.changedTouches[0].clientX)}>
   <div className="platform-carousel__track" style={{transform:`translateX(-${active*50}%)`}}><div id="platform-panel-operation" aria-labelledby="platform-tab-operation" role="tabpanel" tabIndex={-1} className="platform-carousel__slide" aria-hidden={active!==0} inert={active!==0?true:undefined}><OperationalOverview/></div><div id="platform-panel-flow" aria-labelledby="platform-tab-flow" role="tabpanel" tabIndex={-1} className="platform-carousel__slide" aria-hidden={active!==1} inert={active!==1?true:undefined}><ResponseFlowSection/></div></div>
  </div>
 </section>;
}
