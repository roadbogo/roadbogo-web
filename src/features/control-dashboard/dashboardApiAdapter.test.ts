import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/apiClient";
import type { IncidentDetailDto } from "@/features/incident-detail/incidentApiTypes";
import { ApiDashboardAdapter } from "./dashboardApiAdapter";
import type { CctvListDto, IncidentListDto, IncidentSummaryDto } from "./dashboardApiTypes";

vi.mock("@/lib/apiClient",()=>({apiRequest:vi.fn()}));
const request=vi.mocked(apiRequest);

const generatedAt="2026-07-21T00:00:00.000Z";
const summary={total_count:0,new_count:0,acknowledged_count:0,claimed_count:0,under_review_count:0,dispatch_requested_count:0,dispatch_in_progress_count:0,action_completed_count:0,closed_count:0,false_positive_count:0,risk_grade_counts:{CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0},object_category_counts:{VEHICLE:0,DEBRIS:0,WILDLIFE:0,OTHER:0},generated_at:generatedAt}satisfies IncidentSummaryDto;
const incidents={items:[],pagination:{page:1,size:100,total_elements:0,total_pages:0}}satisfies IncidentListDto;
const cctvs={items:[],pagination:{page:1,size:100,total_elements:0,total_pages:0},fallback_used:false}satisfies CctvListDto;
const detail={public_id:"incident-1",incident_no:"INC-1",status:"DISPATCH_REQUESTED",version_no:4,object:{object_category:"DEBRIS",class_code:"DEBRIS",class_name:"낙하물",tracked_object_public_id:null,external_track_id:null},ai_analysis:{representative_confidence:.91,confidence_calculation_type:"MAX",risk_score:91,risk_grade:"HIGH",duration_ms:4200,repeat_count:14,rule_code:null,rule_version:null,reason_codes:[]},cctv_snapshot:{cctv_public_id:"cctv-1",cctv_name:"CAM 01",direction_code:"ASC",road_name:"중부고속도로",road_section_name:"일죽IC ~ 호법JC",latitude:37,longitude:127,km_post:null},timeline:{first_detected_at:generatedAt,last_detected_at:generatedAt,created_at:generatedAt,updated_at:generatedAt,acknowledged_at:generatedAt,claimed_at:generatedAt,review_started_at:generatedAt,closed_at:null},controller:{public_id:"controller-1",user_name:"관제자"},decision:null,active_dispatch:{public_id:"dispatch-1",status:"REQUESTED",responder:{public_id:"responder-1",user_name:"출동 담당자"},requested_at:generatedAt,updated_at:generatedAt},representative_evidence:null,evidence_count:14,memo_count:0}satisfies IncidentDetailDto;

describe("ApiDashboardAdapter",()=>{
 beforeEach(()=>request.mockReset());

 it("loads the snapshot with exactly three aggregate requests and no incident-detail N+1",async()=>{
  request.mockResolvedValueOnce(summary).mockResolvedValueOnce(incidents).mockResolvedValueOnce(cctvs);
  const snapshot=await new ApiDashboardAdapter().load();
  expect(snapshot).toMatchObject({source:"api",incidents:[],cctvs:[],dispatches:[]});
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls.map(([path])=>path).sort()).toEqual([
   "/cctvs?size=100&sort=cctv_name%2Casc",
   "/incidents/summary",
   "/incidents?size=100&sort=priority%2Cdesc",
  ]);
 });

 it("loads active dispatch only for the selected incident detail",async()=>{
  request.mockResolvedValue(detail);
  const selection=await new ApiDashboardAdapter().loadIncidentSelection(detail.public_id);
  expect(request).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith(`/incidents/${detail.public_id}`);
  expect(selection).toMatchObject({incident:{public_id:detail.public_id,status:"DISPATCH_REQUESTED",version_no:4},dispatch:{public_id:"dispatch-1",incident_public_id:detail.public_id,status:"REQUESTED",responder_label:"출동 담당자"}});
 });
});
