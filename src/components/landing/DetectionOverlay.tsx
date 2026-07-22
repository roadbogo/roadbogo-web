import type { CSSProperties, ReactNode } from "react";
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
  children?:ReactNode;
};

export function DetectionOverlay({objectType,label,confidence,bbox,variant,visualVariant,className="",style,animated=true,labelPosition="start",children}:Props){
  const position=bbox?{left:`${bbox.x*100}%`,top:`${bbox.y*100}%`,width:`${bbox.width*100}%`,height:`${bbox.height*100}%`}:style;
  const displayLabel=label.replace(/\s*감지$/u,"");
  const presentationClass=visualVariant?styles[visualVariant]:styles[variant];
  const isHazard=visualVariant?visualVariant==="hazard":variant==="hazard";
  return <div className={`${styles.position} ${isHazard?styles.positionHazard:""} ${className}`.trim()} style={position} data-object-type={objectType??displayLabel} data-visual-variant={visualVariant} aria-hidden="true">
    <div className={`${styles.box} ${presentationClass} ${animated?styles.animated:""}`}>
      <span className={`${styles.corner} ${styles.topLeft}`}/><span className={`${styles.corner} ${styles.topRight}`}/><span className={`${styles.corner} ${styles.bottomRight}`}/><span className={`${styles.corner} ${styles.bottomLeft}`}/>
      <span className={`${styles.label} ${labelPosition==="end"?styles.labelEnd:""}`}><i className={styles.dot}/><b className={styles.name}>{displayLabel}</b>{confidence!==null&&<><span className={styles.separator}>·</span><b className={styles.confidence}>{confidence}%</b></>}</span>
      {children}
      <span className={styles.lockRing}/>
    </div>
  </div>;
}
