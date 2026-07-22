"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NormalizedBBox } from "@/components/landing/DetectionOverlay";

type Dimensions = { width: number; height: number };

function hasValidDimensions(value: Dimensions) {
  return Number.isFinite(value.width) && Number.isFinite(value.height) && value.width > 0 && value.height > 0;
}

function hasValidBbox(value: NormalizedBBox) {
  return [value.x, value.y, value.width, value.height].every(Number.isFinite)
    && value.x >= 0
    && value.y >= 0
    && value.width > 0
    && value.height > 0
    && value.x + value.width <= 1
    && value.y + value.height <= 1;
}

export function projectBboxIntoContainedImage(
  bbox: NormalizedBBox | null,
  image: Dimensions,
  container: Dimensions,
): NormalizedBBox | null {
  if (!bbox || !hasValidBbox(bbox) || !hasValidDimensions(image) || !hasValidDimensions(container)) return null;

  const scale = Math.min(container.width / image.width, container.height / image.height);
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  const offsetX = (container.width - renderedWidth) / 2;
  const offsetY = (container.height - renderedHeight) / 2;

  return {
    x: (offsetX + bbox.x * renderedWidth) / container.width,
    y: (offsetY + bbox.y * renderedHeight) / container.height,
    width: bbox.width * renderedWidth / container.width,
    height: bbox.height * renderedHeight / container.height,
  };
}

export function useContainedBbox(bbox: NormalizedBBox | null, mediaIdentity: string) {
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<Dimensions | null>(null);
  const [image, setImage] = useState<(Dimensions & { identity: string }) | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => setContainerNode(node), []);

  useEffect(() => {
    if (!containerNode) return;
    const measure = () => setContainer({ width: containerNode.clientWidth, height: containerNode.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [containerNode, mediaIdentity]);

  const onImageLoad = useCallback((element: HTMLImageElement) => {
    setImage({ identity: mediaIdentity, width: element.naturalWidth, height: element.naturalHeight });
  }, [mediaIdentity]);

  const projectedBbox = useMemo(() => {
    if (!container || !image || image.identity !== mediaIdentity) return null;
    return projectBboxIntoContainedImage(bbox, image, container);
  }, [bbox, container, image, mediaIdentity]);

  return { containerRef, onImageLoad, projectedBbox };
}
