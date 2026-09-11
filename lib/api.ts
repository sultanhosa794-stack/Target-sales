import * as Location from 'expo-location';
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase';
import { getDeviceLabel, getDeviceToken } from './device';

export async function resolveLogin(username: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/resolve-login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY},
    body: JSON.stringify({ username: username.trim() }),
  });
  const x = await r.json().catch(() => ({}));
  if (!r.ok || !x.login_email) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
  return String(x.login_email);
}

export async function signInWithUsername(username: string, password: string) {
  const email = await resolveLogin(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('الحساب غير مفعّل في النسخة الجديدة أو كلمة المرور غير صحيحة');
  return data;
}

export async function currentProfile() {
  const { data, error } = await supabase.from('profiles').select('id,full_name,username,role,active').single();
  if (error) throw error;
  return data;
}

export async function getGps() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('يجب السماح بالوصول للموقع');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? 0 };
}

export async function startShift(locationId: string) {
  const gps = await getGps();
  const device = await getDeviceToken();
  const { data, error } = await supabase.rpc('start_shift', {
    p_location_id: locationId, p_lat: gps.lat, p_lng: gps.lng,
    p_accuracy_m: gps.accuracy, p_device_token: device,
  });
  if (error) throw error;
  return data;
}

export async function endShift() {
  const gps = await getGps();
  const device = await getDeviceToken();
  const { data, error } = await supabase.rpc('end_shift', {
    p_lat: gps.lat, p_lng: gps.lng, p_accuracy_m: gps.accuracy, p_device_token: device,
  });
  if (error) throw error;
  return data;
}

export async function selfAbsent(reason?: string) {
  const device = await getDeviceToken();
  const { data, error } = await supabase.rpc('mark_self_absent', { p_reason: reason || null, p_device_token: device });
  if (error) throw error;
  return data;
}

export async function submitSales(p35: number, p58: number, p75: number, p104: number) {
  const device = await getDeviceToken();
  const { data, error } = await supabase.rpc('submit_sales', { p35, p58, p75, p104, p_device_token: device });
  if (error) throw error;
  return data;
}

export async function reviewSales(id: string, action: 'approve'|'reject', reason?: string) {
  const { data, error } = await supabase.rpc('review_sales', { p_sales_entry_id: id, p_action: action, p_reason: reason || null });
  if (error) throw error;
  return data;
}

export async function replaceDevice(employeeId: string, rawDevice: string) {
  const { data, error } = await supabase.rpc('admin_replace_device', {
    p_employee_id: employeeId, p_device_token: rawDevice,
    p_device_label: getDeviceLabel(), p_platform: 'android',
  });
  if (error) throw error;
  return data;
}

export async function adminSetAssignment(employeeId:string, locationId:string, businessDate:string){
  const {data,error}=await supabase.rpc('admin_set_assignment',{p_employee_id:employeeId,p_location_id:locationId,p_business_date:businessDate});
  if(error) throw error; return data;
}

export async function adminMarkAbsent(employeeId:string,businessDate:string,reason?:string){
  const {data,error}=await supabase.rpc('admin_mark_absent',{p_employee_id:employeeId,p_business_date:businessDate,p_reason:reason||null});
  if(error) throw error; return data;
}

export async function adminClearAbsence(employeeId:string,businessDate:string){
  const {data,error}=await supabase.rpc('admin_clear_absence',{p_employee_id:employeeId,p_business_date:businessDate});
  if(error) throw error; return data;
}
