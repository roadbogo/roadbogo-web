"use client";

import {createPortal} from "react-dom";
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type KeyboardEvent} from "react";
import styles from "./UserDirectoryPagination.module.css";

export const USER_PAGE_SIZE_OPTIONS=[10,20,50] as const;
export const PaginationChevron=({direction}:{direction:"left"|"right"})=><svg viewBox="0 0 20 20" aria-hidden="true"><path d={direction==="left"?"m12 5-5 5 5 5":"m8 5 5 5-5 5"}/></svg>;
export function getUserPaginationItems(current:number,total:number):(number|"ellipsis")[]{
 if(total<=5)return Array.from({length:total},(_,index)=>index+1);
 const values:(number|"ellipsis")[]=[1];
 if(current>3)values.push("ellipsis");
 for(let value=Math.max(2,current-1);value<=Math.min(total-1,current+1);value++)values.push(value);
 if(current<total-2)values.push("ellipsis");
 values.push(total);
 return values;
}

export function UserPageSizeSelect({value,onChange}:{value:number;onChange:(value:number)=>void}){
 const[open,setOpen]=useState(false),[active,setActive]=useState(Math.max(0,USER_PAGE_SIZE_OPTIONS.indexOf(value as typeof USER_PAGE_SIZE_OPTIONS[number]))),[position,setPosition]=useState<CSSProperties>({});
 const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(!open)return;const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.max(rect.width,118),left=Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12)),height=132,spaceBelow=window.innerHeight-rect.bottom;setPosition({position:"fixed",width,left,top:spaceBelow>=height?rect.bottom+6:undefined,bottom:spaceBelow<height?window.innerHeight-rect.top+6:undefined})};place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true)}},[open]);
 useEffect(()=>{if(!open)return;setActive(Math.max(0,USER_PAGE_SIZE_OPTIONS.indexOf(value as typeof USER_PAGE_SIZE_OPTIONS[number])));const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))setOpen(false)};document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside)},[open,value]);
 const choose=(next:number)=>{if(next!==value)onChange(next);setOpen(false);requestAnimationFrame(()=>trigger.current?.focus())};
 const key=(event:KeyboardEvent<HTMLElement>)=>{if(!open&&(event.key==="Enter"||event.key===" "||event.key==="ArrowDown")){event.preventDefault();setOpen(true);return}if(!open)return;if(event.key==="Escape"){event.preventDefault();setOpen(false);trigger.current?.focus()}else if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();setActive(index=>(index+(event.key==="ArrowDown"?1:-1)+USER_PAGE_SIZE_OPTIONS.length)%USER_PAGE_SIZE_OPTIONS.length)}else if(event.key==="Home"||event.key==="End"){event.preventDefault();setActive(event.key==="Home"?0:USER_PAGE_SIZE_OPTIONS.length-1)}else if(event.key==="Enter"||event.key===" "){event.preventDefault();choose(USER_PAGE_SIZE_OPTIONS[active])}};
 const popup=open&&typeof document!=="undefined"?createPortal(<div ref={menu} className={styles.menu} style={position} role="listbox" aria-label="한 페이지에 표시할 사용자 수" onKeyDown={key}>{USER_PAGE_SIZE_OPTIONS.map((option,index)=><button type="button" role="option" aria-selected={value===option} data-active={active===index} key={option} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option)}><span aria-hidden="true">{value===option?"✓":""}</span><b>{option}명</b></button>)}</div>,document.body):null;
 return <span className={styles.root}><span>한 페이지에</span><button ref={trigger} type="button" className={styles.trigger} aria-haspopup="listbox" aria-expanded={open} aria-label={`한 페이지에 ${value}명 표시`} onClick={()=>setOpen(current=>!current)} onKeyDown={key}><b>{value}명</b><i aria-hidden="true">⌄</i></button>{popup}</span>;
}
