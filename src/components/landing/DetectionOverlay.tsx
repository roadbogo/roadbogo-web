import type { CSSProperties, ReactNode } from "react";
import styles from "./DetectionOverlay.module.css";

export type NormalizedBBox={x:number;y:number;width:number;height:number};

type Props={
  objectType?:string;
  variant:"hazard"|"tracking";
  label:string;
  confidence:number;
  bbox?:NormalizedBBox;
  className?:string;
  style?:CSSProperties;
  animated?:boolean;
  labelPosition?:"start"|"end";
  children?:ReactNode;
};

export function DetectionOverlay({objectType,label,confidence,bbox,variant,className="",style,animated=true,labelPosition="start",children}:Props){
  const position=bbox?{left:`${bbox.x*100}%`,top:`${bbox.y*100}%`,width:`${bbox.width*100}%`,height:`${bbox.height*100}%`}:style;
  const displayLabel=label.replace(/\s*감지$/u,"");
  return <div className={`${styles.position} ${variant==="hazard"?styles.positionHazard:""} ${className}`.trim()} style={position} data-object-type={objectType??displayLabel} aria-hidden="true">
    <div className={`${styles.box} ${styles[variant]} ${animated?styles.animated:""}`}>
      <span className={`${styles.corner} ${styles.topLeft}`}/><span className={`${styles.corner} ${styles.topRight}`}/><span className={`${styles.corner} ${styles.bottomRight}`}/><span className={`${styles.corner} ${styles.bottomLeft}`}/>
      <span className={`${styles.label} ${labelPosition==="end"?styles.labelEnd:""}`}><i className={styles.dot}/><b className={styles.name}>{displayLabel}</b><span className={styles.separator}>·</span><b className={styles.confidence}>{confidence}%</b></span>
      {children}
      <span className={styles.lockRing}/>
    </div>
  </div>;
}
