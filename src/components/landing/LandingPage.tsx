"use client";
import Link from "next/link";
import { useCallback } from "react";
import { LandingHeader } from "./LandingHeader";
import { LandingCarousel } from "./LandingCarousel";
import { PlatformOperationsCarousel } from "./PlatformOperationsCarousel";

export function LandingPage(){
 const showFlow=useCallback(()=>{const section=document.getElementById("platform-operations");if(!section)return;window.dispatchEvent(new CustomEvent("roadbogo:platform-slide",{detail:{key:"flow"}}));section.scrollIntoView({behavior:"smooth",block:"start"});window.setTimeout(()=>section.focus({preventScroll:true}),450)},[]);
 return <div className="landing-page"><LandingHeader/><main>
  <section id="home" className="command-stage"><div className="stage-copy"><p className="stage-eyebrow"><span/> ROAD FLOW INTELLIGENCE</p><h1 className="stage-title"><span>도로 위 위험을</span><span className="stage-title__accent">AI가 먼저 감지하고</span><span>현장 대응까지 연결합니다</span></h1><p className="stage-description"><span>AI가 도로 위 위험 요소를 실시간으로 감지하고,</span><span>관제 판단부터 현장 대응까지 하나의 흐름으로 연결합니다.</span></p><div className="stage-actions"><Link href="/login" className="stage-primary">실시간 관제 보기 <span>→</span></Link><button type="button" onClick={showFlow}>운영 흐름 보기 <span>↓</span></button></div></div><LandingCarousel/></section>
  <PlatformOperationsCarousel/>
 </main><footer className="stage-footer"><span>ROADBOGO · ROAD FLOW INTELLIGENCE</span><span>AI DETECTION / CONNECTED RESPONSE</span></footer></div>;
}
