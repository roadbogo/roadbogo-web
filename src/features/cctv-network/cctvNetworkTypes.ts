import type {CctvSourceType,DirectionCode,OperationalStatus} from "@/features/control-dashboard/dashboardTypes";

export type Road={publicId:string;name:string};
export type RoadSection={publicId:string;roadPublicId:string;name:string};
export type NetworkCctv={publicId:string;code:string;name:string;roadPublicId:string;roadSectionPublicId:string;latitude:number;longitude:number;directionCode:DirectionCode;operationalStatus:OperationalStatus;isActive:boolean;sourceType:CctvSourceType;streamType:"LIVE"|"DEMO"|null;hasStream:boolean;lastSuccessfulSyncAt:string|null};
export type ItsSyncRecord={publicId:string;status:"SUCCESS"|"PARTIAL"|"FALLBACK";requested:number;created:number;updated:number;failed:number;attemptedAt:string;lastSuccessfulAt:string|null};
export type CctvNetworkSnapshot={cctvs:NetworkCctv[];roads:Road[];sections:RoadSection[];syncHistory:ItsSyncRecord[];generatedAt:string;source:"mock"};
export interface CctvNetworkRepository{load(signal:AbortSignal):Promise<CctvNetworkSnapshot>}
