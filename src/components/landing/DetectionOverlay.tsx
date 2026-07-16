import type { CSSProperties, ReactNode } from "react";

export type NormalizedBBox={x:number;y:number;width:number;height:number};

type Props={
  objectType?:string;
  variant:"normal"|"danger";
  label:string;
  confidence:number;
  bbox?:NormalizedBBox;
  className?:string;
  style?:CSSProperties;
  animated?:boolean;
  pulse?:boolean;
  children?:ReactNode;
};

export function DetectionOverlay({objectType,label,confidence,bbox,variant,className="",style,animated=true,pulse=false,children}:Props){
  const position=bbox?{left:`${bbox.x*100}%`,top:`${bbox.y*100}%`,width:`${bbox.width*100}%`,height:`${bbox.height*100}%`}:style;
  return <div className={`detection-bbox detection-bbox--${variant} detectionBox detectionBox--${variant} ${animated?"detectionBox--animated":""} ${className}`.trim()} style={position} data-object-type={objectType??label} aria-hidden="true">
    <span className="detectionBox__corner detectionBox__corner--tl"/><span className="detectionBox__corner detectionBox__corner--tr"/><span className="detectionBox__corner detectionBox__corner--br"/><span className="detectionBox__corner detectionBox__corner--bl"/>
    <span className="detection-bbox__label detectionBox__label"><i/><b>{label}</b><small>신뢰도 {confidence}%</small></span>
    {children}
    {(variant==="danger"||pulse)&&<span className="detection-bbox__pulse detectionBox__ripple"/>}
  </div>;
}
