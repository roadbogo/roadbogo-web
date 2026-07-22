export type DetectionVisualVariant = "hazard" | "traffic" | "default";

type DetectionIdentity = {
  objectCategory?: string | null;
  classCode?: string | null;
};

const HAZARD_CATEGORIES = new Set(["DEBRIS", "WILDLIFE"]);
const HAZARD_CLASS_CODES = new Set([
  "DEBRIS",
  "FALLEN_OBJECT",
  "TIRE",
  "BOX",
  "WILDLIFE",
  "MOTORCYCLE",
  "MOTORBIKE",
]);
const TRAFFIC_CLASS_CODES = new Set(["VEHICLE", "CAR", "SEDAN", "BUS", "TRUCK"]);

function normalizeDetectionCode(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

export function getDetectionVisualVariant({ objectCategory, classCode }: DetectionIdentity): DetectionVisualVariant {
  const category = normalizeDetectionCode(objectCategory);
  const code = normalizeDetectionCode(classCode);

  // Class comes first so motorcycles nested under VEHICLE remain hazards.
  if (HAZARD_CLASS_CODES.has(code) || HAZARD_CATEGORIES.has(category)) return "hazard";
  if (category === "VEHICLE" || TRAFFIC_CLASS_CODES.has(code)) return "traffic";
  return "default";
}
