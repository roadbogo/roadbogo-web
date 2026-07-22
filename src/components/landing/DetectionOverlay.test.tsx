import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetectionOverlay, resolveDetectionLabelPlacement } from "./DetectionOverlay";

describe("detection label placement", () => {
  it("flips toward the left when a start-anchored label would cross the right edge", () => {
    expect(resolveDetectionLabelPlacement({ left:230,right:28,top:80,bottom:120 },23,89,26,false)).toBe("above-end");
  });
  it("moves below or inside when there is no room above", () => {
    expect(resolveDetectionLabelPlacement({ left:20,right:100,top:4,bottom:40 },30,70,26,false)).toBe("below-start");
    expect(resolveDetectionLabelPlacement({ left:20,right:100,top:4,bottom:4 },30,70,26,false)).toBe("inside-start");
  });
  it("keeps the label above when only subpixel rounding reaches the top edge", () => {
    expect(resolveDetectionLabelPlacement({ left:80,right:120,top:27.8,bottom:90 },40,82,28,false)).toBe("above-start");
  });
});

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
