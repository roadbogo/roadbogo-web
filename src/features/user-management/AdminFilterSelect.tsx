"use client";

import {createPortal} from "react-dom";
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from "react";
import type {CSSProperties,ReactNode} from "react";
import styles from "./AdminFilterSelect.module.css";

export type AdminFilterOption<T extends string>={
  value:T;
  label:string;
  icon?:ReactNode;
  accent?:string;
  title?:string;
};

const CLOSE_EVENT="roadbogo:admin-filter-open";

export function AdminFilterSelect<T extends string>({label,value,options,onChange}:{label:string;value:T;options:AdminFilterOption<T>[];onChange:(value:T)=>void}){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const[open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState<CSSProperties>({});
 const selected=useMemo(()=>options.find(option=>option.value===value)??options[0],[options,value]);
 useLayoutEffect(()=>{if(!open)return;const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(Math.max(rect.width,220),window.innerWidth-24),left=Math.min(Math.max(12,rect.left),window.innerWidth-width-12),spaceBelow=window.innerHeight-rect.bottom;setPosition({position:"fixed",width,left,top:spaceBelow>=Math.min(320,options.length*46+16)?rect.bottom+6:undefined,bottom:spaceBelow<Math.min(320,options.length*46+16)?window.innerHeight-rect.top+6:undefined})};place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true)}},[open,options.length]);
 useEffect(()=>{if(!open)return;setActive(Math.max(0,options.findIndex(option=>option.value===value)));window.dispatchEvent(new CustomEvent(CLOSE_EVENT,{detail:id}));const close=(event:Event)=>{if((event as CustomEvent).detail!==id)setOpen(false)};const outside=(event:PointerEvent)=>{const node=event.target as Node;if(!trigger.current?.contains(node)&&!menu.current?.contains(node))setOpen(false)};window.addEventListener(CLOSE_EVENT,close);document.addEventListener("pointerdown",outside);return()=>{window.removeEventListener(CLOSE_EVENT,close);document.removeEventListener("pointerdown",outside)}},[id,open,options,value]);
 const choose=(next:T)=>{onChange(next);setOpen(false);requestAnimationFrame(()=>trigger.current?.focus())};
 const key=(event:React.KeyboardEvent)=>{if(!open&&(event.key==="ArrowDown"||event.key==="Enter"||event.key===" ")){event.preventDefault();setOpen(true);return}if(!open)return;if(event.key==="Escape"){event.preventDefault();setOpen(false);trigger.current?.focus()}else if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();setActive(index=>(index+(event.key==="ArrowDown"?1:-1)+options.length)%options.length)}else if(event.key==="Home"||event.key==="End"){event.preventDefault();setActive(event.key==="Home"?0:options.length-1)}else if(event.key==="Enter"||event.key===" "){event.preventDefault();const option=options[active];if(option)choose(option.value)}};
 const popup=open&&typeof document!=="undefined"?createPortal(<><button className={styles.backdrop} tabIndex={-1} aria-label={`${label} 선택 닫기`} onClick={()=>setOpen(false)}/><section ref={menu} id={`${id}-menu`} className={styles.menu} style={position} role="listbox" aria-label={`${label} 필터`} onKeyDown={key}><header><strong>{label} 선택</strong><button type="button" aria-label={`${label} 선택 닫기`} onClick={()=>{setOpen(false);trigger.current?.focus()}}>×</button></header><div>{options.map((option,index)=><button id={`${id}-${index}`} type="button" role="option" aria-selected={option.value===value} data-active={active===index} title={option.title} key={option.value} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option.value)} style={{"--option-accent":option.accent??"#7b8d99"} as CSSProperties}><span className={styles.check} aria-hidden="true">{option.value===value?"✓":""}</span>{option.icon?<span className={styles.icon}>{option.icon}</span>:option.accent?<i/>:null}<span>{option.label}</span></button>)}</div></section></>,document.body):null;
 return <div className={styles.root}><button ref={trigger} type="button" className={styles.trigger} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-menu`} aria-label={`${label} 필터, 현재 ${selected?.label}`} title={`${label} · ${selected?.label}`} onClick={()=>setOpen(current=>!current)} onKeyDown={key}><span>{label} · {selected?.label}</span><i aria-hidden="true">⌄</i></button>{popup}</div>;
}
