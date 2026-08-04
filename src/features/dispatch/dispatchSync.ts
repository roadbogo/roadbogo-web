export const DISPATCH_CHANGED_EVENT="roadbogo:dispatch-changed";

export function notifyDispatchChanged(){
  window.dispatchEvent(new Event(DISPATCH_CHANGED_EVENT));
}
