"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginSystemHealth } from "@/components/auth/LoginSystemHealth";
import { DetectionOverlay } from "@/components/landing/DetectionOverlay";
import type { LoginIntent } from "@/types/auth";
import styles from "./login.module.css";

const content = {
  general: {
    eyebrow: "GENERAL ACCESS",
    title: "도로보GO에 로그인하세요",
    description: "서비스 정보와 개인 알림을 확인합니다.",
    guide: "계정 권한에 따라 이용 가능한 메뉴가 자동으로 제공됩니다.",
  },
  operations: {
    eyebrow: "OPERATIONS ACCESS",
    title: "도로보GO 운영 시스템",
    description: "관제·관리·현장 대응 업무를 시작합니다.",
    guide: "권한은 계정에 등록된 정보로 자동 확인됩니다.",
  },
} as const;

const IMAGE_SIZE={width:1672,height:941};
const motorcycle={x:1172/1672,y:372/941,width:50/1672,height:92/941};
const candidates=[
  {objectType:"승용차",bbox:{x:822/1672,y:390/941,width:148/1672,height:74/941}},
  {objectType:"SUV",bbox:{x:251/1672,y:500/941,width:306/1672,height:192/941}},
  {objectType:"화물차",bbox:{x:1410/1672,y:250/941,width:79/1672,height:76/941}},
];

export default function LoginPage() {
  const router = useRouter();
  const [intent, setIntent] = useState<LoginIntent>("general");
  const visualRef=useRef<HTMLElement>(null);
  const [stage,setStage]=useState({width:0,height:0,left:0,top:0});

  useEffect(() => {
    setIntent(new URLSearchParams(window.location.search).get("intent") === "operations" ? "operations" : "general");
  }, []);
  useEffect(()=>{const visual=visualRef.current;if(!visual)return;const update=()=>{const width=visual.clientWidth,height=visual.clientHeight;if(!width||!height)return;const scale=Math.max(width/IMAGE_SIZE.width,height/IMAGE_SIZE.height);const renderedWidth=IMAGE_SIZE.width*scale,renderedHeight=IMAGE_SIZE.height*scale;setStage({width:renderedWidth,height:renderedHeight,left:(width-renderedWidth)/2,top:(height-renderedHeight)/2})};update();const observer=new ResizeObserver(update);observer.observe(visual);return()=>observer.disconnect()},[]);

  const selectIntent = (next: LoginIntent) => {
    setIntent(next);
    const params = new URLSearchParams(window.location.search);
    params.set("intent", next);
    router.replace(`/login?${params.toString()}`, { scroll: false });
  };

  const current = content[intent];
  return <main className={styles.page}>
    <section ref={visualRef} className={styles.visual} aria-labelledby="login-brand-title">
      <Image className={styles.roadImage} src="/images/incidents/response-ai-detection-v2.png" alt="고속도로 CCTV 도로 안전 관제 화면" fill priority sizes="(max-width: 767px) 100vw, 64vw" />
      <div className={styles.visualOverlay} />
      <div className={styles.scanLine} aria-hidden="true" />
      <Link className={styles.brand} href="/" aria-label="도로보GO 메인으로 이동"><Image src="/brand/roadbogo-logo-final.png" alt="도로보GO" width={170} height={48} priority /></Link>
      {stage.width>0&&<div className={styles.detectionStage} style={{width:stage.width,height:stage.height,left:stage.left,top:stage.top}} aria-hidden="true">
        {candidates.map((candidate,index)=><DetectionOverlay key={candidate.objectType} objectType={candidate.objectType} variant="normal" label={candidate.objectType} confidence={87-index*4} bbox={candidate.bbox} className={styles[`candidate${index+1}`]}/>) }
        <DetectionOverlay objectType="motorcycle" variant="danger" label="이륜차 위험 후보" confidence={91} bbox={motorcycle} className={styles.motorcycleDetection}/>
      </div>}
      <div className={styles.visualCopy}>
        <p>ROAD FLOW INTELLIGENCE</p>
        <h1 id="login-brand-title">AI가 먼저 발견하고,<br />대응은 더 빠르게.</h1>
        <span>위험 탐지부터 관제 판단,<br />출동과 현장 조치까지 하나로 연결합니다.</span>
      </div>
      <div className={styles.liveStatus}><i/><span><b>실시간 영상 분석 중</b><small>CCTV-021 · 중부고속도로 · 연결 정상</small></span></div>
      <div className={styles.accessFlow} aria-label="도로보GO 대응 흐름"><span>AI 탐지</span><i/><span>관제 판단</span><i/><span>출동 연결</span><i/><span>현장 대응</span></div>
    </section>
    <section className={styles.panel} aria-label="로그인 영역"><div className={styles.formArea}>
      <div className={styles.intentTabs} role="tablist" aria-label="접속 목적" onKeyDown={(event)=>{if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;event.preventDefault();const next=intent==="general"?"operations":"general";selectIntent(next);event.currentTarget.querySelector<HTMLButtonElement>(`[aria-selected="${false}"]`)?.focus()}}>
        <button type="button" role="tab" aria-selected={intent === "general"} className={intent === "general" ? styles.intentActive : ""} onClick={() => selectIntent("general")}>일반 서비스</button>
        <button type="button" role="tab" aria-selected={intent === "operations"} className={intent === "operations" ? styles.intentActive : ""} onClick={() => selectIntent("operations")}>운영 시스템</button>
        <span className={styles.tabIndicator} data-position={intent}/>
      </div>
      <header className={styles.heading}><p>{current.eyebrow}</p><h2>{intent==="general"?<><span>도로보GO에</span> <span>로그인하세요</span></>:current.title}</h2><span>{current.description}</span><b>{current.guide}</b></header>
      {intent === "operations" && <><LoginSystemHealth/><p className={styles.roleGuide}>시스템 관리자 · 관제센터 책임자 · 관제 담당자 · 출동 담당자</p></>}
      <LoginForm intent={intent} />
      <div className={styles.accountNotice}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.2c0 4.7 3.2 8.1 7.5 9.8 4.3-1.7 7.5-5.1 7.5-9.8V6L12 3Z"/><path d="m8.8 12 2.1 2.1 4.5-4.6"/></svg><span><strong>승인된 사용자 전용</strong><small>계정은 관리자 발급 또는 승인된 초대를 통해 생성됩니다.</small></span></div>
      <Link className={styles.homeLink} href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg><span>메인으로 돌아가기</span></Link>
    </div></section>
  </main>;
}
