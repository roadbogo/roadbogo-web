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
describe("detection visual variants",()=>{
  it.each(["hazard","traffic","default"] as const)("renders the %s palette identifier",visualVariant=>{
    const html=renderToStaticMarkup(<DetectionOverlay variant="tracking" visualVariant={visualVariant} label="객체" confidence={87}/>);
    expect(html).toContain(`data-visual-variant="${visualVariant}"`);
  });

  it("keeps the three visual palette identifiers distinct",()=>{
    const classes=(['hazard','traffic','default'] as const).map(visualVariant=>
      renderToStaticMarkup(<DetectionOverlay variant="tracking" visualVariant={visualVariant} label="객체" confidence={87}/>).match(/data-visual-variant="[^"]+"[^>]*><div class="([^"]+)"/)?.[1],
    );
    expect(classes.every(Boolean)).toBe(true);
    expect(new Set(classes).size).toBe(3);
  });

  it("keeps legacy variant styling when no visual variant is supplied",()=>{
    const hazard=renderToStaticMarkup(<DetectionOverlay variant="hazard" label="위험" confidence={87}/>);
    const tracking=renderToStaticMarkup(<DetectionOverlay variant="tracking" label="차량" confidence={87}/>);
    expect(hazard).not.toContain("data-visual-variant");
    expect(tracking).not.toContain("data-visual-variant");
    expect(hazard).not.toBe(tracking);
  });
});
