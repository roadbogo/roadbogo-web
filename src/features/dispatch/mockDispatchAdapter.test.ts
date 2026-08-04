import { describe, expect, it } from "vitest";
import { MockDispatchAdapter } from "./mockDispatchAdapter";

describe("MockDispatchAdapter", () => {
  it("keeps the demo flow separate and updates versions", async () => {
    const adapter = new MockDispatchAdapter(); const page = await adapter.list({ activeOnly: false });
    expect(page.items.length).toBeGreaterThan(0);
    const requested = page.items.find((item) => item.status === "REQUESTED")!;
    const result = await adapter.accept(requested.publicId, requested.versionNo, crypto.randomUUID());
    expect(result.ok).toBe(true); if (result.ok) { expect(result.detail.status).toBe("ACCEPTED"); expect(result.detail.versionNo).toBe(requested.versionNo + 1); }
  });

  it("advances an owned dispatch one step at a time and keeps list and detail in sync", async () => {
    const adapter = new MockDispatchAdapter();
    const page = await adapter.list({ activeOnly: false });
    const requested = page.items.find((item) => item.status === "REQUESTED")!;
    const accepted = await adapter.accept(requested.publicId, requested.versionNo, crypto.randomUUID());
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    const departed = await adapter.depart(requested.publicId, accepted.detail.versionNo, crypto.randomUUID());
    expect(departed).toMatchObject({ ok: true, detail: { status: "DEPARTED", departedAt: expect.any(String) } });
    if (!departed.ok) return;
    const enRoute = await adapter.markEnRoute(requested.publicId, departed.detail.versionNo, crypto.randomUUID());
    expect(enRoute).toMatchObject({ ok: true, detail: { status: "EN_ROUTE", enRouteAt: expect.any(String) } });
    if (!enRoute.ok) return;
    const arrived = await adapter.arrive(requested.publicId, enRoute.detail.versionNo, crypto.randomUUID());
    expect(arrived).toMatchObject({ ok: true, detail: { status: "ARRIVED", arrivedAt: expect.any(String), incident: { status: "ON_SCENE" } } });
    if (!arrived.ok) return;
    const started = await adapter.startAction(requested.publicId, arrived.detail.versionNo, crypto.randomUUID());
    expect(started).toMatchObject({ ok: true, detail: { status: "ACTION_IN_PROGRESS", actionStartedAt: expect.any(String), incident: { status: "ACTION_IN_PROGRESS" } } });
    if (!started.ok) return;
    expect(started.detail.versionNo).toBe(requested.versionNo + 5);
    expect((await adapter.detail(requested.publicId))?.status).toBe("ACTION_IN_PROGRESS");
    expect((await adapter.list({ activeOnly: false })).items.find((item) => item.publicId === requested.publicId)?.status).toBe("ACTION_IN_PROGRESS");
  });

  it("rejects skipped, reversed, stale, terminal, and unknown progress commands", async () => {
    const adapter = new MockDispatchAdapter();
    const page = await adapter.list({ activeOnly: false });
    const requested = page.items.find((item) => item.status === "REQUESTED")!;
    expect(await adapter.depart(requested.publicId, requested.versionNo, "skip")).toMatchObject({ ok: false, code: "DISPATCH_INVALID_STATE_TRANSITION" });
    const accepted = await adapter.accept(requested.publicId, requested.versionNo, "accept");
    if (!accepted.ok) return;
    expect(await adapter.depart(requested.publicId, requested.versionNo, "stale")).toMatchObject({ ok: false, code: "DISPATCH_VERSION_CONFLICT" });
    const departed = await adapter.depart(requested.publicId, accepted.detail.versionNo, "depart");
    if (!departed.ok) return;
    expect(await adapter.depart(requested.publicId, departed.detail.versionNo, "reverse"))
      .toMatchObject({ ok: false, code: "DISPATCH_INVALID_STATE_TRANSITION" });
    const terminal = page.items.find((item) => ["ACTION_COMPLETED", "CANCELLED"].includes(item.status))!;
    expect(await adapter.startAction(terminal.publicId, terminal.versionNo, "terminal"))
      .toMatchObject({ ok: false, code: "DISPATCH_INVALID_STATE_TRANSITION" });
    expect(await adapter.depart("missing", 0, "missing"))
      .toMatchObject({ ok: false, code: "DISPATCH_NOT_FOUND" });
  });
  it("stores an action report, links photos, and completes the active dispatch",async()=>{
    const adapter=new MockDispatchAdapter(),page=await adapter.list({activeOnly:false}),requested=page.items.find(item=>item.status==="REQUESTED")!;
    const accepted=await adapter.accept(requested.publicId,requested.versionNo,"a");if(!accepted.ok)return;const departed=await adapter.depart(requested.publicId,accepted.detail.versionNo,"d");if(!departed.ok)return;const enRoute=await adapter.markEnRoute(requested.publicId,departed.detail.versionNo,"e");if(!enRoute.ok)return;const arrived=await adapter.arrive(requested.publicId,enRoute.detail.versionNo,"r");if(!arrived.ok)return;const started=await adapter.startAction(requested.publicId,arrived.detail.versionNo,"s");if(!started.ok)return;
    const saved=await adapter.saveActionReport(requested.publicId,"  낙하물 제거 완료  ",started.detail.versionNo,"report",started.detail);expect(saved).toMatchObject({ok:true,report:{detail:"낙하물 제거 완료"}});if(!saved.ok)return;
    const uploaded=await adapter.uploadActionFile(new File(["image"],"after.jpg"),"ACTION_AFTER","client-1","upload");await adapter.linkActionFile(requested.publicId,uploaded.filePublicId,"ACTION_AFTER",0,"link");expect((await adapter.getActionReport(requested.publicId))?.files).toHaveLength(1);
    const completed=await adapter.completeAction(requested.publicId,started.detail.versionNo,"complete",started.detail);expect(completed).toMatchObject({ok:true,detail:{status:"ACTION_COMPLETED",incident:{status:"ACTION_COMPLETED"}},report:{completedAt:expect.any(String)}});
  });
});
