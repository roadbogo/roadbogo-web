import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetectionOverlay } from "./DetectionOverlay";

describe("detection confidence label",()=>{
  it("does not turn missing confidence into zero percent",()=>{
    const html=renderToStaticMarkup(<DetectionOverlay variant="tracking" label="차량" confidence={null}/>);
    expect(html).not.toContain("0%");
    expect(html).toContain("차량");
  });
  it("keeps real zero and rounded values distinct",()=>{
    expect(renderToStaticMarkup(<DetectionOverlay variant="tracking" label="차량" confidence={0}/>)).toContain("0%");
    expect(renderToStaticMarkup(<DetectionOverlay variant="tracking" label="차량" confidence={87}/>)).toContain("87%");
  });
});
