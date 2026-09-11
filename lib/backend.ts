import * as SecureStore from "expo-secure-store";

const SUPABASE_URL = "https://feeaekqyqtttpuajmcob.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable__FeQluvb6h7pD0CejDlanQ__ZrAqQUl";
const SESSION_KEY = "target_sales_session_v1";
const PROFILE_KEY = "target_sales_profile_v1";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export type Profile = {
  id: string;
  full_name: string;
  username: string;
  role: "employee" | "manager" | "viewer" | "system_admin" | string;
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function writeJson(key: string, value: unknown) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function login(username: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/login-bootstrap`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.session || !payload?.profile) {
    const code = payload?.error;
    if (code === "invalid_credentials") throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    if (code === "account_not_migrated") throw new Error("الحساب غير مجهز بعد في النظام الجديد");
    throw new Error("تعذر تسجيل الدخول الآن، حاول مرة أخرى");
  }
  await writeJson(SESSION_KEY, payload.session);
  await writeJson(PROFILE_KEY, payload.profile);
  return payload as { session: Session; profile: Profile };
}

export async function getStoredProfile() { return readJson<Profile>(PROFILE_KEY); }
export async function getStoredSession() { return readJson<Session>(SESSION_KEY); }

async function refreshSession(session: Session): Promise<Session> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
    await logout();
    throw new Error("انتهت الجلسة، سجل الدخول من جديد");
  }
  const refreshed: Session = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in ?? 3600),
  };
  await writeJson(SESSION_KEY, refreshed);
  return refreshed;
}

export async function ensureSession(): Promise<Session> {
  let session = await getStoredSession();
  if (!session) throw new Error("يجب تسجيل الدخول");
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || session.expires_at - now < 90) session = await refreshSession(session);
  return session;
}

function friendlyApiError(raw: string) {
  let message = raw;
  try { message = JSON.parse(raw)?.message ?? raw; } catch { /* keep raw */ }
  if (message.includes("outside_location:")) {
    const match = message.match(/outside_location:([0-9.]+):([0-9.]+)/);
    if (match) return `أنت خارج نطاق الموقع المعتمد. المسافة الحالية ${match[1]} م، والمسموح ${match[2]} م.`;
    return "أنت خارج نطاق الموقع المعتمد.";
  }
  const map: Record<string, string> = {
    shift_already_ended: "تم إنهاء شفت اليوم مسبقًا.",
    no_open_shift: "لا يوجد شفت مفتوح لإنهائه.",
    shift_must_be_ended: "يجب إنهاء الشفت قبل تسجيل المبيعات.",
    revision_limit_reached: "تم استخدام التعديل المسموح لهذا اليوم ولا يمكن التعديل مرة أخرى.",
    sales_already_approved: "تم اعتماد مبيعات اليوم ولا يمكن تعديلها.",
    total_over_100: "إجمالي الشرائح لا يمكن أن يتجاوز 100.",
    invalid_quantity: "عدد الشرائح غير صحيح.",
    shift_already_started: "لا يمكن تسجيل الغياب بعد بدء الشفت.",
    no_location: "لم يتم العثور على موقع عمل معتمد.",
    no_region: "الحساب غير مربوط بالمنطقة.",
    not_allowed: "ليس لديك صلاحية لتنفيذ هذه العملية.",
  };
  const key = Object.keys(map).find((k) => message.includes(k));
  return key ? map[key] : "تعذر تنفيذ العملية";
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    console.warn("API error", response.status, raw);
    throw new Error(friendlyApiError(raw));
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}, prefer?: string): Promise<T> {
  const session = await ensureSession();
  const headers = new Headers(init.headers ?? {});
  headers.set("apikey", PUBLISHABLE_KEY);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (prefer) headers.set("Prefer", prefer);

  let response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  if (response.status === 401) {
    const latest = await refreshSession(session);
    headers.set("Authorization", `Bearer ${latest.access_token}`);
    response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  }
  return parseResponse<T>(response);
}

export async function logout() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  await SecureStore.deleteItemAsync(PROFILE_KEY);
}

export function businessDate(date = new Date()) {
  const shifted = new Date(date.getTime() - 2 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(shifted);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function monthBounds(date = new Date()) {
  const shifted = new Date(date.getTime() - 2 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", year: "numeric", month: "numeric" }).formatToParts(shifted);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { year, month, days, start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(days).padStart(2, "0")}` };
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
