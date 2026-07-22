export function consumeWithdrawalNotice() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("reason") !== "withdrawn") return false;
  url.searchParams.delete("reason");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}
