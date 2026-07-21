import{describe,expect,it}from"vitest";
import{ApiDashboardAdapter}from"./dashboardApiAdapter";
import{MockDashboardAdapter,createMockDashboardSnapshot}from"./mockDashboardAdapter";
import{resolveDashboardDataMode}from"./dashboardAdapterFactory";
import{mapDashboardSnapshot}from"./dashboardMapper";
import type{CctvListItemDto,IncidentSummaryDto}from"./dashboardApiTypes";

const summary={total_count:0,new_count:0,acknowledged_count:0,claimed_count:0,under_review_count:0,dispatch_requested_count:0,dispatch_in_progress_count:0,action_completed_count:0,closed_count:0,false_positive_count:0,risk_grade_counts:{CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0},object_category_counts:{VEHICLE:0,DEBRIS:0,WILDLIFE:0,OTHER:0},generated_at:"2026-07-20T00:00:00.000Z"}satisfies IncidentSummaryDto;
const cctv={public_id:"c",cctv_code:"C-1",cctv_name:"CAM",source_type:"ITS",direction_code:"ASC",latitude:37,longitude:127,km_post:null,operational_status:"NORMAL",is_active:true,has_stream:true,road:{public_id:"r",road_code:"R",road_name:"중부고속도로"},road_section:{public_id:"s",section_code:"S",section_name:"일죽IC ~ 호법JC"},last_successful_sync_at:null}satisfies CctvListItemDto;

describe("dashboard adapter selection and display states",()=>{
 it("selects mock only when development explicitly enables the existing public flag",()=>{expect(resolveDashboardDataMode("development","true")).toBe("mock");expect(resolveDashboardDataMode("development",undefined)).toBe("api");expect(resolveDashboardDataMode("production","true")).toBe("api")});
 it("keeps both adapter implementations available",()=>{expect(new MockDashboardAdapter()).toBeInstanceOf(MockDashboardAdapter);expect(new ApiDashboardAdapter()).toBeInstanceOf(ApiDashboardAdapter)});
 it("provides six 3x2 verification cards with statuses and linked detections in mock mode",()=>{const snapshot=createMockDashboardSnapshot();expect(snapshot.cctvs).toHaveLength(6);expect(new Set(snapshot.cctvs.map(item=>item.operational_status))).toEqual(new Set(["NORMAL","DELAYED","FAULT"]));expect(snapshot.incidents.some(item=>item.class_name&&item.representative_confidence!==null&&snapshot.cctvs.some(c=>c.public_id===item.cctv_public_id))).toBe(true)});
 it("keeps a populated API snapshot as API data",()=>{const snapshot=mapDashboardSnapshot({summary,incidents:[],cctvs:[cctv],fallbackUsed:false,fetchedAt:summary.generated_at});expect(snapshot.source).toBe("api");expect(snapshot.cctvs).toHaveLength(1)});
 it("keeps an empty API CCTV response empty without mock fallback",()=>{const snapshot=mapDashboardSnapshot({summary,incidents:[],cctvs:[],fallbackUsed:false,fetchedAt:summary.generated_at});expect(snapshot.source).toBe("api");expect(snapshot.cctvs).toEqual([])});
});
