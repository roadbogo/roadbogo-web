import { clearAccessToken } from "./accessToken";

export const AUTH_EXPIRED_KEY="roadbogo_auth_expired";

export function clearClientAuth(){
  clearAccessToken();
  localStorage.removeItem("roadbogo_auth_user");
  localStorage.removeItem("roadbogo_access_token");
  sessionStorage.removeItem("roadbogo_access_token");
  localStorage.removeItem("roadbogo-demo-auth");
  sessionStorage.removeItem("roadbogo_return_to");
}
