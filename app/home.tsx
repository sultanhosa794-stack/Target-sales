import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { api, businessDate, getStoredProfile, logout, monthBounds, Profile } from "../lib/backend";
import { cancelShiftReminders, prepareNotifications, scheduleEveningShiftReminders } from "../lib/notifications";
import { checkForAppUpdate } from "../lib/updater";

type DailyRow = {
  shift_status?: string | null;
  assigned_location?: string | null;
  package_35?: number | null;
  package_58?: number | null;
  package_75?: number | null;
  package_104?: number | null;
  total_units?: number | null;
  total_points?: number | null;
  sales_status?: string | null;
};

type MonthRow = { total_points?: number | null; eligible_target_points?: number | null };
type NotificationRow = { id: string };
const PACKAGE_POINTS = { "35": 5, "58": 10, "75": 10, "104": 12 } as const;

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [daily, setDaily] = useState<DailyRow>({});
  const [month, setMonth] = useState<MonthRow>({});
  const [monthlyTarget, setMonthlyTarget] = useState(3300);
  const [unread, setUnread] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    setError("");
    try {
      const stored = await getStoredProfile();
      if (!stored) return router.replace("/");
      if (["system_admin", "manager", "viewer"].includes(stored.role)) return router.replace("/admin");
      setProfile(stored);
      const date = businessDate();
      const mb = monthBounds();
      const [dailyRows, monthRows, configRows, notificationRows] = await Promise.all([
        api<DailyRow[]>(`/rest/v1/daily_operations?select=*&employee_id=eq.${stored.id}&work_date=eq.${date}&limit=1`),
        api<MonthRow[]>(`/rest/v1/monthly_performance?select=*&employee_id=eq.${stored.id}&year=eq.${mb.year}&month=eq.${mb.month}&limit=1`),
        api<{ key: string; value: number }[]>("/rest/v1/app_config?select=key,value&key=eq.monthly_target_points"),
        api<NotificationRow[]>(`/rest/v1/notifications?select=id&user_id=eq.${stored.id}&read_at=is.null&limit=99`),
      ]);
      const row = dailyRows?.[0] ?? {};
      setDaily(row);
      setMonth(monthRows?.[0] ?? {});
      setUnread(notificationRows?.length ?? 0);
      const target = Number(configRows?.[0]?.value ?? 3300);
      setMonthlyTarget(Number.isFinite(target) ? target : 3300);

      try {
        await prepareNotifications();
        if ((row.shift_status ?? "not_started") === "not_started") await scheduleEveningShiftReminders();
        else await cancelShiftReminders();
      } catch {}

      try { setUpdateAvailable((await checkForAppUpdate()).available); } catch { setUpdateAvailable(false); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const getPosition = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") throw new Error("يجب السماح بالموقع لتنفيذ هذه العملية");
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
  };

  const startShift = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      const result = await api<any>("/rest/v1/rpc/start_my_shift", { method: "POST", body: JSON.stringify({ p_latitude: pos.latitude, p_longitude: pos.longitude, p_accuracy_m: pos.accuracy }) });
      await cancelShiftReminders().catch(() => undefined);
      Alert.alert("تم بدء الشفت", `${result?.location_name ?? "الموقع المعتمد"}\nالمسافة: ${result?.distance_m ?? 0} م`);
      await load(true);
    } catch (e) { Alert.alert("لم يبدأ الشفت", e instanceof Error ? e.message : "تعذر بدء الشفت"); }
    finally { setBusy(false); }
  };

  const endShift = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      const result = await api<any>("/rest/v1/rpc/end_my_shift", { method: "POST", body: JSON.stringify({ p_latitude: pos.latitude, p_longitude: pos.longitude, p_accuracy_m: pos.accuracy }) });
      await cancelShiftReminders().catch(() => undefined);
      Alert.alert("تم إنهاء الشفت", `المسافة عن موقع البداية: ${result?.from_start_m ?? 0} م`);
      await load(true);
    } catch (e) { Alert.alert("تعذر إنهاء الشفت", e instanceof Error ? e.message : "حاول مرة أخرى"); }
    finally { setBusy(false); }
  };

  const markAbsent = () => Alert.alert("تسجيل غياب", "هل تريد تسجيل نفسك غائبًا لهذا اليوم؟", [
    { text: "إلغاء", style: "cancel" },
    { text: "تسجيل الغياب", style: "destructive", onPress: async () => {
      setBusy(true);
      try {
        await api("/rest/v1/rpc/mark_my_absence", { method: "POST", body: JSON.stringify({ p_reason: null }) });
        await cancelShiftReminders().catch(() => undefined);
        await load(true);
      } catch (e) { Alert.alert("تعذر تسجيل الغياب", e instanceof Error ? e.message : "حاول مرة أخرى"); }
      finally { setBusy(false); }
    }},
  ]);

  const signOut = async () => { await logout(); router.replace("/"); };

  if (loading || !profile) return <SafeAreaView style={[styles.page, styles.center]}><ActivityIndicator size="large"/><Text style={styles.muted}>جاري تجهيز حسابك…</Text></SafeAreaView>;

  const shiftStatus = daily.shift_status ?? "not_started";
  const monthPoints = Number(month.total_points ?? 0);
  const eligible = Number(month.eligible_target_points ?? 0);
  const achievement = eligible > 0 ? (monthPoints / eligible) * 100 : 0;
  const mb = monthBounds();
  const dailyTarget = monthlyTarget / mb.days;
  const firstName = profile.full_name?.split(" ")[0] || "موظف";
  const status = statusMeta(shiftStatus);

  return <SafeAreaView style={styles.page}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }}/> }>
      <View style={styles.topRow}>
        <View style={styles.brandCircle}><Text style={styles.brandSmall}>الوسام</Text><Text style={styles.brandBig}>الجنوبية</Text></View>
        <View style={styles.topActions}>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/notifications")}><Text style={styles.icon}>🔔</Text>{unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text></View>}</Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/update")}><Text style={styles.icon}>⬆️</Text>{updateAvailable && <View style={styles.dot}/>}</Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroHello}>مرحبًا {firstName} 👋</Text>
        <Text style={styles.heroRole}>موظف مبيعات ميدانية</Text>
        <View style={styles.statusRow}><View style={[styles.statusPill,{backgroundColor:status.bg}]}><Text style={[styles.statusText,{color:status.fg}]}>{status.label}</Text></View><Text style={styles.heroDate}>{businessDate()}</Text></View>
      </View>

      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      {shiftStatus === "not_started" && <View style={styles.reminder}><Text style={styles.reminderIcon}>⏰</Text><View style={{flex:1}}><Text style={styles.reminderTitle}>حان وقت بداية الشفت</Text><Text style={styles.reminderText}>ابدأ من موقعك المعتمد أو سجّل الغياب لليوم.</Text></View></View>}

      <View style={styles.locationCard}><View style={{flex:1}}><Text style={styles.eyebrow}>الموقع المعتمد اليوم</Text><Text style={styles.location}>{daily.assigned_location ?? "سيظهر الموقع بعد التوزيع"}</Text></View><Text style={styles.pin}>📍</Text></View>

      <View style={styles.targetCard}>
        <View style={styles.targetMain}><Text style={styles.targetLabel}>التارجت الشهري</Text><Text style={styles.targetValue}>{monthlyTarget.toLocaleString()}</Text><Text style={styles.targetPoints}>نقطة</Text></View>
        <View style={styles.targetMetrics}><Metric label="المطلوب اليومي" value={dailyTarget.toFixed(2)}/><Metric label="نقاط الشهر" value={monthPoints.toFixed(0)}/><Metric label="التحقيق" value={`${achievement.toFixed(1)}%`}/></View>
      </View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>مبيعات اليوم</Text><Text style={styles.sectionSub}>{daily.total_units ?? 0} شريحة • {daily.total_points ?? 0} نقطة</Text></View>
      <View style={styles.packageGrid}>
        <PackageCard code="35" qty={daily.package_35 ?? 0}/><PackageCard code="58" qty={daily.package_58 ?? 0}/><PackageCard code="75" qty={daily.package_75 ?? 0}/><PackageCard code="104" qty={daily.package_104 ?? 0}/>
      </View>

      <View style={styles.summaryRow}><MiniCard label="حالة المبيعات" value={salesLabel(daily.sales_status)}/><MiniCard label="حالة الشفت" value={shiftLabel(shiftStatus)}/></View>

      <Text style={styles.sectionTitle}>العمليات</Text>
      {shiftStatus === "not_started" && <View style={styles.actionRow}><TouchableOpacity disabled={busy} style={styles.primaryButton} onPress={startShift}><Text style={styles.primaryButtonText}>{busy ? "جاري تحديد الموقع…" : "بداية الشفت"}</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={styles.dangerGhost} onPress={markAbsent}><Text style={styles.dangerText}>تسجيل غياب</Text></TouchableOpacity></View>}
      {shiftStatus === "open" && <TouchableOpacity disabled={busy} style={styles.primaryFull} onPress={endShift}><Text style={styles.primaryButtonText}>{busy ? "جاري الحفظ…" : "إنهاء الشفت"}</Text></TouchableOpacity>}
      {shiftStatus === "ended" && <TouchableOpacity style={styles.primaryFull} onPress={() => router.push("/sales")}><Text style={styles.primaryButtonText}>تسجيل / تعديل المبيعات</Text></TouchableOpacity>}
      {shiftStatus === "absent" && <View style={styles.absentBox}><Text style={styles.absentText}>مسجل غائب اليوم — لا يوجد تارجت لهذا اليوم</Text></View>}

      <View style={styles.bottomTools}><Pressable style={styles.tool} onPress={() => router.push("/notifications")}><Text style={styles.toolIcon}>🔔</Text><Text style={styles.toolText}>الإشعارات</Text></Pressable><Pressable style={styles.tool} onPress={() => router.push("/update")}><Text style={styles.toolIcon}>⬆️</Text><Text style={styles.toolText}>التحديثات</Text></Pressable><Pressable style={styles.tool} onPress={signOut}><Text style={styles.toolIcon}>↩️</Text><Text style={styles.toolText}>خروج</Text></Pressable></View>
    </ScrollView>
  </SafeAreaView>;
}

function Metric({label,value}:{label:string;value:string}) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function MiniCard({label,value}:{label:string;value:string}) { return <View style={styles.miniCard}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
function PackageCard({ code, qty }: { code: keyof typeof PACKAGE_POINTS; qty: number }) { return <View style={styles.packageCard}><Text style={styles.packageCode}>{code}</Text><Text style={styles.packageQty}>{qty}</Text><Text style={styles.packageUnit}>شريحة</Text><Text style={styles.packagePoints}>{PACKAGE_POINTS[code]} نقاط / شريحة</Text></View>; }
function statusMeta(status:string){if(status==="open")return{label:"الشفت مفتوح",bg:"#DCFCE7",fg:"#067647"};if(status==="ended")return{label:"تم إنهاء الشفت",bg:"#E0F2FE",fg:"#075985"};if(status==="absent")return{label:"غائب",bg:"#FEE2E2",fg:"#B42318"};return{label:"لم يبدأ الشفت",bg:"#FEF3C7",fg:"#92400E"};}
function shiftLabel(status?: string | null) { return status === "open" ? "الشفت مفتوح" : status === "ended" ? "تم إنهاء الشفت" : status === "absent" ? "غائب" : "لم يبدأ"; }
function salesLabel(status?: string | null) { return status === "approved" ? "معتمدة" : status === "submitted" ? "بانتظار الاعتماد" : status === "rejected" ? "مرفوضة - يمكن التعديل" : status === "draft" ? "مسودة" : "لم تسجل"; }

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:"#F4F7FB"},center:{alignItems:"center",justifyContent:"center"},content:{padding:18,paddingBottom:50},muted:{color:"#8792A1",marginTop:10},
  topRow:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",marginBottom:14},brandCircle:{width:74,height:74,borderRadius:37,borderWidth:5,borderColor:"#111",backgroundColor:"#fff",alignItems:"center",justifyContent:"center"},brandSmall:{fontSize:9,fontWeight:"900"},brandBig:{fontSize:14,fontWeight:"900",marginTop:1},topActions:{flexDirection:"row-reverse",gap:10},iconBtn:{width:48,height:48,borderRadius:15,backgroundColor:"#fff",alignItems:"center",justifyContent:"center",position:"relative",borderWidth:1,borderColor:"#E4E7EC"},icon:{fontSize:20},badge:{position:"absolute",top:-5,right:-5,minWidth:20,height:20,borderRadius:10,backgroundColor:"#B42318",alignItems:"center",justifyContent:"center",paddingHorizontal:4},badgeText:{color:"#fff",fontSize:10,fontWeight:"900"},dot:{position:"absolute",top:3,right:3,width:10,height:10,borderRadius:5,backgroundColor:"#16A77A"},
  hero:{backgroundColor:"#102847",borderRadius:26,padding:20,marginBottom:14},heroHello:{textAlign:"right",color:"#fff",fontSize:25,fontWeight:"900"},heroRole:{textAlign:"right",color:"#BFD0E5",marginTop:4,fontWeight:"700"},statusRow:{marginTop:16,flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",gap:8},statusPill:{paddingHorizontal:12,paddingVertical:7,borderRadius:99},statusText:{fontWeight:"900",fontSize:12},heroDate:{color:"#BFD0E5",fontWeight:"700"},
  errorBox:{backgroundColor:"#FEF3F2",borderRadius:14,padding:12,marginBottom:14},errorText:{color:"#B42318",textAlign:"right",fontWeight:"700"},reminder:{flexDirection:"row-reverse",gap:12,backgroundColor:"#FFF4E5",borderWidth:1,borderColor:"#FEC84B",borderRadius:18,padding:15,marginBottom:14,alignItems:"center"},reminderIcon:{fontSize:24},reminderTitle:{textAlign:"right",fontSize:16,fontWeight:"900",color:"#7A2E0E"},reminderText:{textAlign:"right",color:"#9A5412",marginTop:4},
  locationCard:{backgroundColor:"#fff",borderRadius:20,padding:16,flexDirection:"row-reverse",gap:12,alignItems:"center",marginBottom:14},eyebrow:{textAlign:"right",color:"#98A2B3",fontSize:11},location:{textAlign:"right",color:"#17233C",fontSize:17,fontWeight:"900",marginTop:5},pin:{fontSize:25},
  targetCard:{backgroundColor:"#17233C",borderRadius:26,padding:18,marginBottom:22},targetMain:{alignItems:"center"},targetLabel:{color:"#BCC5D2",fontSize:13},targetValue:{color:"#fff",fontSize:40,fontWeight:"900",marginTop:3},targetPoints:{color:"#65D9B5",fontWeight:"900"},targetMetrics:{flexDirection:"row-reverse",justifyContent:"space-between",borderTopWidth:1,borderTopColor:"#33405A",marginTop:15,paddingTop:15},metric:{width:"32%"},metricLabel:{color:"#AEB9C9",textAlign:"center",fontSize:10},metricValue:{color:"#fff",textAlign:"center",fontSize:16,fontWeight:"900",marginTop:5},
  sectionHead:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",marginBottom:12},sectionTitle:{textAlign:"right",fontSize:19,fontWeight:"900",color:"#17233C",marginBottom:12,marginTop:4},sectionSub:{color:"#667085",fontWeight:"700",fontSize:12},packageGrid:{flexDirection:"row-reverse",flexWrap:"wrap",justifyContent:"space-between",rowGap:10,marginBottom:16},packageCard:{width:"48.5%",backgroundColor:"#fff",borderRadius:20,padding:16,borderWidth:1,borderColor:"#EAECF0"},packageCode:{textAlign:"right",fontSize:13,fontWeight:"900",color:"#1677FF"},packageQty:{textAlign:"right",fontSize:28,fontWeight:"900",color:"#17233C",marginTop:4},packageUnit:{textAlign:"right",color:"#667085",fontSize:11},packagePoints:{textAlign:"right",color:"#16A77A",fontWeight:"800",fontSize:11,marginTop:6},summaryRow:{flexDirection:"row-reverse",gap:10,marginBottom:18},miniCard:{flex:1,backgroundColor:"#fff",borderRadius:18,padding:14},miniLabel:{textAlign:"right",color:"#98A2B3",fontSize:11},miniValue:{textAlign:"right",color:"#17233C",fontWeight:"900",marginTop:5},
  actionRow:{flexDirection:"row-reverse",gap:10},primaryButton:{flex:1,backgroundColor:"#16A77A",borderRadius:18,paddingVertical:16},primaryButtonText:{textAlign:"center",color:"#fff",fontWeight:"900",fontSize:16},dangerGhost:{flex:1,borderWidth:1,borderColor:"#FDA29B",borderRadius:18,paddingVertical:16,backgroundColor:"#fff"},dangerText:{color:"#B42318",textAlign:"center",fontWeight:"900"},primaryFull:{backgroundColor:"#16A77A",borderRadius:18,paddingVertical:17},absentBox:{backgroundColor:"#FEF3F2",borderRadius:18,padding:16},absentText:{color:"#B42318",textAlign:"center",fontWeight:"900"},
  bottomTools:{flexDirection:"row-reverse",justifyContent:"space-between",gap:10,marginTop:24},tool:{flex:1,backgroundColor:"#fff",borderRadius:18,paddingVertical:14,alignItems:"center",borderWidth:1,borderColor:"#E4E7EC"},toolIcon:{fontSize:19},toolText:{marginTop:5,fontSize:11,fontWeight:"900",color:"#344054"}
});
