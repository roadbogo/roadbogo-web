import type {CctvNetworkRepository,CctvNetworkSnapshot,NetworkCctv,Road,RoadSection} from "./cctvNetworkTypes";
import type {CctvSourceType,DirectionCode,OperationalStatus} from "@/features/control-dashboard/dashboardTypes";

export const mockRoads:Road[]=[
 {publicId:"road-jungbu",name:"중부고속도로"},{publicId:"road-gyeongbu",name:"경부고속도로"},{publicId:"road-yeongdong",name:"영동고속도로"},{publicId:"road-seohaean",name:"서해안고속도로"},
];
export const mockRoadSections:RoadSection[]=[
 {publicId:"section-jb-1",roadPublicId:"road-jungbu",name:"남이천IC ~ 호법JC"},{publicId:"section-jb-2",roadPublicId:"road-jungbu",name:"호법JC ~ 일죽IC"},
 {publicId:"section-gb-1",roadPublicId:"road-gyeongbu",name:"수원신갈IC ~ 서울TG"},{publicId:"section-gb-2",roadPublicId:"road-gyeongbu",name:"안성JC ~ 오산IC"},
 {publicId:"section-yd-1",roadPublicId:"road-yeongdong",name:"여주JC ~ 이천IC"},{publicId:"section-yd-2",roadPublicId:"road-yeongdong",name:"덕평IC ~ 호법JC"},
 {publicId:"section-sh-1",roadPublicId:"road-seohaean",name:"서평택JC ~ 발안IC"},
];
const statuses:OperationalStatus[]=["NORMAL","NORMAL","NORMAL","DELAYED","FAULT","INACTIVE","UNKNOWN"];
const directions:DirectionCode[]=["ASC","DESC","BOTH","UNKNOWN"];
const sources:CctvSourceType[]=["ITS","ITS","ITS","DEMO","MANUAL"];
export const mockNetworkCctvs:NetworkCctv[]=Array.from({length:24},(_,index)=>{
 const road=mockRoads[index%mockRoads.length],sections=mockRoadSections.filter(section=>section.roadPublicId===road.publicId),section=sections[index%sections.length],status=statuses[index%statuses.length],source=sources[index%sources.length];
 return{publicId:`cctv-network-${String(index+1).padStart(3,"0")}`,code:`CCTV-${source}-${String(index+1).padStart(3,"0")}`,name:`${road.name} ${section.name.split(" ~ ")[0]} ${index+1}`,roadPublicId:road.publicId,roadSectionPublicId:section.publicId,latitude:36.75+(index%6)*.11+(index%2)*.02,longitude:126.95+(index%8)*.13,directionCode:directions[index%directions.length],operationalStatus:status,isActive:status!=="INACTIVE",sourceType:source,streamType:source==="DEMO"?"DEMO":"LIVE",hasStream:!["FAULT","INACTIVE"].includes(status),lastSuccessfulSyncAt:source==="ITS"?new Date(Date.UTC(2026,6,29,7,28-index%5)).toISOString():null};
});
const snapshot:CctvNetworkSnapshot={cctvs:mockNetworkCctvs,roads:mockRoads,sections:mockRoadSections,syncHistory:[
 {publicId:"sync-1",status:"PARTIAL",requested:24,created:2,updated:19,failed:3,attemptedAt:"2026-07-29T07:28:00.000Z",lastSuccessfulAt:"2026-07-29T06:50:00.000Z"},
 {publicId:"sync-2",status:"SUCCESS",requested:22,created:0,updated:22,failed:0,attemptedAt:"2026-07-29T06:50:00.000Z",lastSuccessfulAt:"2026-07-29T06:50:00.000Z"},
],generatedAt:"2026-07-29T07:42:00.000Z",source:"mock"};
export class MockCctvNetworkRepository implements CctvNetworkRepository{async load(signal:AbortSignal){await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,140);signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"))},{once:true})});return structuredClone({...snapshot,generatedAt:new Date().toISOString()})}}
export class UnavailableCctvNetworkRepository implements CctvNetworkRepository{async load():Promise<CctvNetworkSnapshot>{throw new Error("CCTV_NETWORK_API_UNAVAILABLE")}}
export function createCctvNetworkRepository():CctvNetworkRepository{return process.env.NEXT_PUBLIC_USE_MOCK==="true"?new MockCctvNetworkRepository():new UnavailableCctvNetworkRepository()}
