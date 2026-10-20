import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { api, getStoredProfile } from "./backend";

const SHIFT_IDS_KEY = "target_sales_shift_notification_ids";
Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});
function expoProjectId(){const eas=(Constants.expoConfig?.extra as any)?.eas?.projectId;return Constants.easConfig?.projectId??(typeof eas==="string"?eas:undefined)}
const CHANNEL_ID = "target-sales-alerts";
let registrationInFlight: Promise<string> | null = null;
let lastRegistrationError: string | null = null;
export function getPushRegistrationError(){return lastRegistrationError}
async function ensureAndroidChannel(){
 if(Platform.OS==="android") await Notifications.setNotificationChannelAsync(CHANNEL_ID,{name:"تنبيهات Target & Sales",importance:Notifications.AndroidImportance.MAX,vibrationPattern:[0,500,250,500],sound:"default",lockscreenVisibility:Notifications.AndroidNotificationVisibility.PUBLIC});
}
async function performTokenRegistration(){
 if(Platform.OS!=="android"&&Platform.OS!=="ios") throw new Error("الإشعارات غير مدعومة على هذه المنصة.");
 const profile=await getStoredProfile();
 if(!profile) throw new Error("لا توجد جلسة مستخدم محفوظة لتسجيل الإشعارات.");
 const projectId=expoProjectId();
 if(!projectId) throw new Error("تعذر تحديد مشروع Expo للإشعارات.");
 await ensureAndroidChannel();
 const existing=await Notifications.getPermissionsAsync();
 const permission=existing.granted?existing:await Notifications.requestPermissionsAsync();
 if(!permission.granted) throw new Error("يجب السماح بالإشعارات من إعدادات الجهاز.");
 const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
 if(!token||!token.startsWith("ExponentPushToken[")&&!token.startsWith("ExpoPushToken[")) throw new Error("لم يتم استلام رمز Expo صالح؛ تحقق من إعداد Firebase والاتصال.");
 await api("/rest/v1/rpc/register_my_push_token",{method:"POST",body:JSON.stringify({p_expo_token:token,p_platform:Platform.OS,p_device_label:"Target & Sales"})});
 lastRegistrationError=null;
 return token;
}
export function registerRemotePushToken(){
 if(!registrationInFlight) registrationInFlight=performTokenRegistration().catch(error=>{
  lastRegistrationError=error instanceof Error?error.message:"تعذر تسجيل رمز الإشعارات";
  console.warn("Push token registration failed:",lastRegistrationError);
  throw error;
 }).finally(()=>{registrationInFlight=null});
 return registrationInFlight;
}
export async function prepareNotifications(){
 try{await registerRemotePushToken();return {registered:true,error:null}}
 catch(error){return {registered:false,error:error instanceof Error?error.message:"تعذر تسجيل الجهاز للإشعارات"}}
}
// Retry when the app returns to the foreground (including after network/Firebase recovery).
let foregroundListenerInstalled=false;
export function enablePushRegistrationRetry(){
 if(foregroundListenerInstalled)return;
 foregroundListenerInstalled=true;
 AppState.addEventListener("change",state=>{if(state==="active")void prepareNotifications()});
}
export async function cancelShiftReminders(){const raw=await SecureStore.getItemAsync(SHIFT_IDS_KEY);if(!raw)return;try{const ids:string[]=JSON.parse(raw);await Promise.all(ids.map(id=>Notifications.cancelScheduledNotificationAsync(id).catch(()=>undefined)))}finally{await SecureStore.deleteItemAsync(SHIFT_IDS_KEY)}}
function eveningReminderTimes(now:Date){const base=new Date(now);if(now.getHours()<2)base.setDate(base.getDate()-1);base.setHours(15,20,0,0);const times:Date[]=[];for(let minute=20;minute<=50;minute+=2){const t=new Date(base);t.setHours(15,minute,0,0);if(t>now)times.push(t)}return times}
export async function scheduleEveningShiftReminders(){await prepareNotifications();await cancelShiftReminders();const now=new Date(),ids:string[]=[];for(const when of eveningReminderTimes(now)){const id=await Notifications.scheduleNotificationAsync({content:{title:"حان وقت بداية الشفت",body:"ابدأ الشفت من موقعك المعتمد. سيتوقف التنبيه فور بدء الشفت.",sound:"default",data:{screen:"home",kind:"shift_reminder"}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:when,channelId:Platform.OS==="android"?"target-sales-alerts":undefined}});ids.push(id)}await SecureStore.setItemAsync(SHIFT_IDS_KEY,JSON.stringify(ids));return ids.length}
export async function showLocalNotification(title:string,body:string,type="general"){await prepareNotifications();await Notifications.scheduleNotificationAsync({content:{title,body,sound:"default",data:{type}},trigger:null})}
