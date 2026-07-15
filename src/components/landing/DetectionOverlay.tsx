import type { CSSProperties, ReactNode } from "react";

type Props={
  variant:"normal"|"danger";
  label:string;
  confidence:number;
  className?:string;
  style?:CSSProperties;
  pulse?:boolean;
  children?:ReactNode;
};

export function DetectionOverlay({variant,label,confidence,className="",style,pulse=false,children}:Props){
  return <div className={`detection-bbox detection-bbox--${variant} ${className}`.trim()} style={style} aria-hidden="true">
    <span className="detection-bbox__label">{label} · {confidence}%</span>
    {children}
    {pulse&&<span className="detection-bbox__pulse"/>}
  </div>;
}
