export interface MockFieldActionRuntimeRecord {
  incidentPublicId:string;
  dispatchPublicId:string;
  responderLabel:string;
  actionType:string;
  detail:string;
  completedAt:string;
  beforeImageUrl:string|null;
  afterImageUrl:string|null;
  beforeImageExpired?:boolean;
  afterImageExpired?:boolean;
}

const records=new Map<string,MockFieldActionRuntimeRecord>();
const storageKey="roadbogo_mock_field_actions";

function hydrate(){
  if(typeof window==="undefined"||records.size)return;
  try{const values=JSON.parse(window.localStorage.getItem(storageKey)??"[]") as MockFieldActionRuntimeRecord[];values.forEach(record=>records.set(record.incidentPublicId,{...record,beforeImageExpired:record.beforeImageExpired||Boolean(record.beforeImageUrl?.startsWith("blob:")),afterImageExpired:record.afterImageExpired||Boolean(record.afterImageUrl?.startsWith("blob:")),beforeImageUrl:persistableImageUrl(record.beforeImageUrl),afterImageUrl:persistableImageUrl(record.afterImageUrl)}))}catch{/* Invalid demo state is ignored. */}
}

const persistableImageUrl=(value:string|null)=>value?.startsWith("blob:")?null:value;

function persist(){
  if(typeof window!=="undefined")window.localStorage.setItem(storageKey,JSON.stringify([...records.values()].map(record=>({...record,beforeImageExpired:record.beforeImageExpired||Boolean(record.beforeImageUrl?.startsWith("blob:")),afterImageExpired:record.afterImageExpired||Boolean(record.afterImageUrl?.startsWith("blob:")),beforeImageUrl:persistableImageUrl(record.beforeImageUrl),afterImageUrl:persistableImageUrl(record.afterImageUrl)}))));
}

export function updateMockFieldActionRuntime(record:MockFieldActionRuntimeRecord){
  hydrate();
  records.set(record.incidentPublicId,structuredClone(record));
  persist();
}

export function getMockFieldActionRuntime(incidentPublicId:string){
  hydrate();
  const record=records.get(incidentPublicId);
  return record?structuredClone(record):null;
}

export function resetMockFieldActionRuntime(){records.clear();if(typeof window!=="undefined")window.localStorage.removeItem(storageKey)}
