"use client";
import Link from "next/link";
import { useCallback } from "react";
import { LandingHeader } from "./LandingHeader";
import { LandingCarousel } from "./LandingCarousel";

const flow=[
 {number:"01",title:"AI 실시간 탐지",text:"CCTV 영상에서 낙하물, 야생동물, 이륜차 위험을 실시간 분류합니다.",tone:"teal"},
 {number:"02",title:"사건 생성",text:"탐지 위치와 위험 점수, 근거 영상을 하나의 사건으로 자동 구성합니다.",tone:"blue"},
 {number:"03",title:"관제 판단",text:"관제 관리자가 AI 근거를 확인하고 실제 위험 여부를 빠르게 판단합니다.",tone:"blue"},
 {number:"04",title:"출동 연결",text:"사건 위치와 도로 상황을 가장 가까운 현장 대응팀에 전달합니다.",tone:"amber"},
 {number:"05",title:"현장 대응",text:"조치 과정과 완료 결과를 관제 화면에 실시간으로 동기화합니다.",tone:"green"},
];

export function LandingPage(){
 const showFlow=useCallback(()=>{const section=document.getElementById("service-flow");if(!section)return;section.scrollIntoView({behavior:"smooth",block:"start"});window.setTimeout(()=>section.focus({preventScroll:true}),450)},[]);
 return <div className="landing-page"><LandingHeader/><main>
  <section id="home" className="command-stage"><div className="stage-copy"><p className="stage-eyebrow"><span/> ROAD FLOW INTELLIGENCE</p><h1 className="stage-title"><span>도로 위 위험을</span><span className="stage-title__accent">AI가 먼저 발견하고,</span><span>대응까지 연결합니다</span></h1><p className="stage-description"><span>AI가 도로 위 위험 요소를 실시간으로 감지하고,</span><span>관제 판단부터 현장 대응까지 하나의 흐름으로 연결합니다.</span></p><div className="stage-actions"><Link href="/login" className="stage-primary">실시간 관제 보기 <span>→</span></Link><button type="button" onClick={showFlow}>서비스 흐름 보기 <span>↓</span></button></div></div><LandingCarousel/></section>
  <section id="service-flow" className="service-flow" aria-labelledby="service-flow-title" tabIndex={-1}><div className="service-flow__intro"><p>RESPONSE FLOW</p><h2 id="service-flow-title">탐지부터 현장 대응까지<br/>하나의 흐름으로 연결합니다.</h2><p className="service-flow__description">AI 탐지 결과가 사건 생성, 관제 판단, 출동 연결, 현장 조치까지 실시간으로 이어집니다.</p></div><div id="response-flow" className="service-flow__rail">{flow.map((item,index)=><article key={item.number} className={`service-flow__card service-flow__card--${item.tone}`}><div><span>{item.number}</span>{index<flow.length-1&&<i aria-hidden="true">→</i>}</div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
  <section className="operation-metrics" aria-label="운영 지표"><div><strong>24시간</strong><span>실시간 객체 탐지</span></div><div><strong>3종</strong><span>집중 위험 유형</span></div><div><strong>평균 8초</strong><span>탐지부터 관제 전달까지</span></div><div><strong>실시간 동기화</strong><span>관제·출동·현장 상태</span></div></section>
 </main><footer className="stage-footer"><span>ROADBOGO · ROAD FLOW INTELLIGENCE</span><span>AI DETECTION / CONNECTED RESPONSE</span></footer></div>;
}
