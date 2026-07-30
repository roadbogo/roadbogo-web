export type CoordinateValidation =
  | { valid: true; latitude: number; longitude: number }
  | { valid: false; reason: "MISSING" | "OUT_OF_RANGE" };

export function validateCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): CoordinateValidation {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { valid: false, reason: "MISSING" };
  }

  if (latitude! < -90 || latitude! > 90 || longitude! < -180 || longitude! > 180) {
    return { valid: false, reason: "OUT_OF_RANGE" };
  }

  return { valid: true, latitude: latitude!, longitude: longitude! };
}

export function formatCoordinate(value: number) {
  return value.toFixed(6);
}

export function getDirectionLabel(directionCode: string) {
  const labels: Record<string, string> = {
    BOTH: "양방향",
    FORWARD: "정방향",
    REVERSE: "역방향",
    UP: "상행",
    DOWN: "하행",
  };

  return labels[directionCode] ?? directionCode;
}

export function getCctvSourceLabel(sourceType:string){
  return({ITS:"ITS 연동",DEMO:"시연 데이터",MANUAL:"수동 등록"} as Record<string,string>)[sourceType]??"확인되지 않은 출처";
}

export function formatLocationKst(value:string|null|undefined){
  if(!value)return"기록 없음";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return"기록 확인 필요";
  return `${new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(date)} KST`;
}
