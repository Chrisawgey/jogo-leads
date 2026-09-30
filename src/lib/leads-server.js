// Server-only: Firestore access for leads. Never import this from a page component.
import admin from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { LEADS_COLLECTION, LEAD_STATUSES, LEAD_SOURCES, US_STATES } from "./leads";

// Optional LEADS_FIRESTORE_DATABASE puts leads in their own Firestore database,
// fully separate from the app's security rules. Defaults to the main database.
const db = () => process.env.LEADS_FIRESTORE_DATABASE
  ? getFirestore(admin.app(), process.env.LEADS_FIRESTORE_DATABASE)
  : getFirestore(admin.app());

export const leadsCollection = () => db().collection(LEADS_COLLECTION);
export { FieldValue };

const str = (value, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const coord = (value, limit) =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;

export const isValidStatus = (id) => LEAD_STATUSES.some(s => s.id === id);

// Whitelist + normalize everything the client is allowed to set on a lead
export function pickLeadFields(body = {}) {
  const source = LEAD_SOURCES.some(s => s.id === body.source) ? body.source : "other";
  let handle = str(body.handle, 300);
  if (source === "instagram") handle = handle.replace(/^@/, "");
  const crewSize = parseInt(body.crewSize, 10);
  const latitude = coord(body.latitude, 90);
  const longitude = coord(body.longitude, 180);
  const hasPin = latitude !== null && longitude !== null;

  return {
    crewName: str(body.crewName, 120),
    contactName: str(body.contactName, 120),
    phone: str(body.phone, 40),
    email: str(body.email, 200),
    source: handle ? source : "",
    handle,
    crewSize: crewSize > 0 ? crewSize : null,
    city: str(body.city, 120),
    state: US_STATES.includes(body.state) ? body.state : "",
    address: str(body.address, 300),
    latitude: hasPin ? latitude : null,
    longitude: hasPin ? longitude : null,
    status: isValidStatus(body.status) ? body.status : "new",
    owner: str(body.owner, 120),
    notes: str(body.notes, 4000),
  };
}

const TIMESTAMP_FIELDS = ["createdAt", "updatedAt", "lastActivityAt"];

// Firestore Timestamps → ISO strings so the data is JSON-safe for the page
export function serializeLead(snap) {
  const data = snap.data();
  const out = { id: snap.id, ...data };
  TIMESTAMP_FIELDS.forEach(f => {
    out[f] = data[f]?.toDate ? data[f].toDate().toISOString() : data[f] ?? null;
  });
  return out;
}

export async function listLeads() {
  const snap = await leadsCollection().orderBy("updatedAt", "desc").get();
  return snap.docs.map(serializeLead);
}
