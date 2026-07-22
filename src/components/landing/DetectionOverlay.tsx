"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DetectionVisualVariant } from "@/features/detection/detectionVisualVariant";
import styles from "./DetectionOverlay.module.css";

export type NormalizedBBox={x:number;y:number;width:number;height:number};

type Props={
  objectType?:string;
  variant:"hazard"|"tracking";
  visualVariant?:DetectionVisualVariant;
  label:string;
  confidence:number|null;
  bbox?:NormalizedBBox;
  className?:string;
  style?:CSSProperties;
  animated?:boolean;
  labelPosition?:"start"|"end";
  labelVerticalPosition?:"auto"|"above";
  children?:ReactNode;
};
type LabelPlacement="above-start"|"above-end"|"below-start"|"below-end"|"inside-start"|"inside-end";
export function resolveDetectionLabelPlacement(space:{left:number;right:number;top:number;bottom:number},rootWidth:number,labelWidth:number,labelHeight:number,preferredEnd:boolean):LabelPlacement{
  const edgeTolerance=2;
  const fitsStart=space.right+rootWidth>=labelWidth;
  const fitsEnd=space.left+rootWidth>=labelWidth;
  const end=preferredEnd?(fitsEnd||!fitsStart):(!fitsStart&&fitsEnd);
  if(space.top+edgeTolerance>=labelHeight)return end?"above-end":"above-start";
  if(space.bottom>=labelHeight)return end?"below-end":"below-start";
  return end?"inside-end":"inside-start";
}

export function DetectionOverlay({objectType,label,confidence,bbox,variant,visualVariant,className="",style,animated=true,labelPosition="start",labelVerticalPosition="auto",children}:Props){
  const rootRef=useRef<HTMLDivElement>(null);
  const labelRef=useRef<HTMLSpanElement>(null);
  const [placement,setPlacement]=useState<LabelPlacement>(labelPosition==="end"?"above-end":"above-start");
  const position=bbox?{left:`${bbox.x*100}%`,top:`${bbox.y*100}%`,width:`${bbox.width*100}%`,height:`${bbox.height*100}%`}:style;
  const {left:positionLeft,top:positionTop,width:positionWidth,height:positionHeight}=position??{};
  const displayLabel=label.replace(/\s*감지$/u,"");
  useLayoutEffect(()=>{
    const root=rootRef.current,labelElement=labelRef.current,container=root?.parentElement;
    if(!root||!labelElement||!container)return;
    const update=()=>{
      const rootRect=root.getBoundingClientRect(),containerRect=container.getBoundingClientRect();
      const labelWidth=labelElement.offsetWidth,labelHeight=labelElement.offsetHeight;
      const space={left:rootRect.left-containerRect.left,right:containerRect.right-rootRect.right,top:rootRect.top-containerRect.top,bottom:containerRect.bottom-rootRect.bottom};
      const preferredEnd=labelPosition==="end";
      const keepAbove=labelVerticalPosition==="above"||objectType==="vehicle";
      const placementSpace=keepAbove?{...space,top:Number.POSITIVE_INFINITY}:space;
      setPlacement(resolveDetectionLabelPlacement(placementSpace,rootRect.width,labelWidth,labelHeight,preferredEnd));
    };
    update();
    const frame=window.requestAnimationFrame(update);
    const observer=new ResizeObserver(update);
    observer.observe(container);observer.observe(root);observer.observe(labelElement);
    return()=>{window.cancelAnimationFrame(frame);observer.disconnect();};
  },[labelPosition,labelVerticalPosition,objectType,displayLabel,confidence,positionLeft,positionTop,positionWidth,positionHeight]);
  const presentationClass=visualVariant?styles[visualVariant]:styles[variant];
  const isHazard=visualVariant?visualVariant==="hazard":variant==="hazard";
  return <div ref={rootRef} className={`${styles.position} ${isHazard?styles.positionHazard:""} ${className}`.trim()} style={position} data-object-type={objectType??displayLabel} data-visual-variant={visualVariant} aria-hidden="true">
    <div className={`${styles.box} ${presentationClass} ${animated?styles.animated:""}`}>
      <span className={`${styles.corner} ${styles.topLeft}`}/><span className={`${styles.corner} ${styles.topRight}`}/><span className={`${styles.corner} ${styles.bottomRight}`}/><span className={`${styles.corner} ${styles.bottomLeft}`}/>
      <span ref={labelRef} className={`${styles.label} ${styles[placement]}`}><span className={styles.dot}/><b className={styles.name}>{displayLabel}</b>{confidence!==null&&<><span className={styles.separator}>·</span><b className={styles.confidence}>{confidence}%</b></>}</span>
      {children}
      <span className={styles.lockRing}/>
    </div>
  </div>;
}
