import { AuthRiskVisual } from "./AuthRiskVisual";
import type { LoginIntent } from "@/types/auth";

export function LoginHeroCarousel({ intent = "general" }: { intent?: LoginIntent }){
  return <AuthRiskVisual variant="login" loginIntent={intent} />;
}
