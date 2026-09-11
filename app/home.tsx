import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { api, businessDate, getStoredProfile, logout, monthBounds, Profile } from "../lib/backend";

type DailyRow = {
  shift_status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  assigned_location?: string | null;
  start_distance_m?: number | null;
  end_distance_m?: number | null;
  end_from_start_distance_m?: number | null;
  package_35?: number | null;
  package_58?: number | null;
  package_75?: number | null;
  package_104?: number | null;
  total_units?: number | null;
  total_points?: number | null;
  sales_status?: string | null;
  revision_count?: number | null;
};

type MonthRow = {
  monthly_points?: number | null;
  attended_days?: number | null;
  sales_points?: number | null;
  opening_points?: number | null;
  total_points?: number | null;
  eligible_target_points?: number | null;
  daily_target_points?: number | null;
};

const PACKAGE_POINTS = { "35": 5, "58": 10, "75": 10, "104": 12 } as const;

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [daily, setDaily] = useState<DailyRow>({});
  const [month, setMonth] = useState<MonthRow>({});
  const [monthlyTarget, setMonthlyTarget] = useState(3300);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    setError("");
    try {
      const stored = await getStoredProfile();
      if (!stored) {
        router.replace("/");
        return;
      }
      setProfile(stored);
      const date = businessDate();
      const mb = monthBounds();
      const [dailyRows, monthRows, configRows] = await Promise.all([
        api<DailyRow[]>(`/rest/v1/daily_operations?select=*&employee_id=eq.${stored.id}&work_date=eq.${date}&limit=1`),
        api<MonthRow[]>(`/rest/v1/monthly_performance?select=*&employee_id=eq.${stored.id}&year=eq.${mb.year}&month=eq.${mb.month}&limit=1`),
        api<{ key: string; value: number }[]>("/rest/v1/app_config?select=key,value&key=eq.monthly_target_points"),
      ]);
      setDaily(dailyRows?.[0] ?? {});
      setMonth(monthRows?.[0] ?? {});
      const target = Number(configRows?.[0]?.value ?? 3300);
      setMonthlyTarget(Number.isFinite(target) ? target : 3300);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const getPosition = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") throw new Error("يجب السماح بالموقع لتنفيذ هذه العملية");
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    };
  };

  const startShift = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      const result = await api<any>("/rest/v1/rpc/start_my_shift", {
        method: "POST",
        body: JSON.stringify({ p_latitude: pos.latitude, p_longitude: pos.longitude, p_accuracy_m: pos.accuracy }),
      });
      Alert.alert("تم بدء الشفت", `${result?.location_name ?? "الموقع المعتمد"}\nالمسافة: ${result?.distance_m ?? 0} م`);
      await load(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "تعذر بدء الشفت";
      Alert.alert("لم يبدأ الشفت", message);
    } finally {
      setBusy(false);
    }
  };

  const endShift = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      const result = await api<any>("/rest/v1/rpc/end_my_shift", {
        method: "POST",
        body: JSON.stringify({ p_latitude: pos.latitude, p_longitude: pos.longitude, p_accuracy_m: pos.accuracy }),
      });
      Alert.alert("تم إنهاء الشفت", `المسافة عن موقع البداية: ${result?.from_start_m ?? 0} م`);
      await load(true);
    } catch (e) {
      Alert.alert("تعذر إنهاء الشفت", e instanceof Error ? e.message : "حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const markAbsent = () => {
    Alert.alert("تسجيل غياب", "هل تريد تسجيل نفسك غائبًا لهذا اليوم؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الغياب",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api("/rest/v1/rpc/mark_my_absence", { method: "POST", body: JSON.stringify({ p_reason: null }) });
            await load(true);
          } catch (e) {
            Alert.alert("تعذر تسجيل الغياب", e instanceof Error ? e.message : "حاول مرة أخرى");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const signOut = async () => {
    await logout();
    router.replace("/");
  };

  if (loading) {
    return <SafeAreaView style={[styles.page, styles.center]}><ActivityIndicator size="large" /><Text style={styles.muted}>جاري تحميل بياناتك…</Text></SafeAreaView>;
  }

  const shiftStatus = daily.shift_status ?? "not_started";
  const monthPoints = Number(month.total_points ?? 0);
  const eligible = Number(month.eligible_target_points ?? 0);
  const achievement = eligible > 0 ? (monthPoints / eligible) * 100 : 0;
  const mb = monthBounds();
  const dailyTarget = monthlyTarget / mb.days;
  const isStaff = profile?.role === "system_admin" || profile?.role === "manager" || profile?.role === "viewer";

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>مرحبًا بك</Text>
            <Text style={styles.name}>{profile?.full_name ?? "Target & Sales"}</Text>
            <Text style={styles.muted}>يوم العمل: {businessDate()}</Text>
          </View>
          <TouchableOpacity onPress={signOut}><Text style={styles.logout}>خروج</Text></TouchableOpacity>
        </View>

        {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>التارجت الشهري</Text>
          <Text style={styles.targetValue}>{monthlyTarget.toLocaleString()}</Text>
          <Text style={styles.targetPoints}>نقطة</Text>
          <View style={styles.separator} />
          <View style={styles.targetRow}>
            <View><Text style={styles.smallLabel}>المطلوب اليومي</Text><Text style={styles.smallValue}>{dailyTarget.toFixed(2)}</Text></View>
            <View><Text style={styles.smallLabel}>نقاط الشهر</Text><Text style={styles.smallValue}>{monthPoints.toFixed(0)}</Text></View>
            <View><Text style={styles.smallLabel}>نسبة أيام الدوام</Text><Text style={styles.smallValue}>{achievement.toFixed(1)}%</Text></View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ملخص اليوم</Text>
        <View style={styles.grid}>
          <Stat label="نقاط اليوم" value={String(daily.total_points ?? 0)} />
          <Stat label="إجمالي الشرائح" value={String(daily.total_units ?? 0)} />
        </View>
        <View style={styles.grid}>
          <Stat label="حالة المبيعات" value={salesLabel(daily.sales_status)} />
          <Stat label="حالة الشفت" value={shiftLabel(shiftStatus)} />
        </View>

        <Text style={styles.sectionTitle}>مبيعات الباقات اليوم</Text>
        <View style={styles.packageGrid}>
          <PackageCard code="35" qty={daily.package_35 ?? 0} />
          <PackageCard code="58" qty={daily.package_58 ?? 0} />
          <PackageCard code="75" qty={daily.package_75 ?? 0} />
          <PackageCard code="104" qty={daily.package_104 ?? 0} />
        </View>

        <Text style={styles.sectionTitle}>العمليات</Text>
        {shiftStatus === "not_started" && (
          <>
            <TouchableOpacity disabled={busy} style={styles.primaryButton} onPress={startShift}>
              <Text style={styles.primaryButtonText}>{busy ? "جاري تحديد الموقع…" : "بداية الشفت"}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} style={styles.dangerGhost} onPress={markAbsent}><Text style={styles.dangerText}>رفع غياب اليوم</Text></TouchableOpacity>
          </>
        )}
        {shiftStatus === "open" && (
          <TouchableOpacity disabled={busy} style={styles.primaryButton} onPress={endShift}><Text style={styles.primaryButtonText}>{busy ? "جاري الحفظ…" : "إنهاء الشفت"}</Text></TouchableOpacity>
        )}
        {shiftStatus === "ended" && (
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/sales")}><Text style={styles.primaryButtonText}>تسجيل / تعديل المبيعات</Text></TouchableOpacity>
        )}
        {shiftStatus === "absent" && <View style={styles.absentBox}><Text style={styles.absentText}>مسجل غائب اليوم — لا يوجد تارجت لهذا اليوم</Text></View>}

        {isStaff && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/admin")}><Text style={styles.secondaryButtonText}>لوحة الإدارة</Text></TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function PackageCard({ code, qty }: { code: keyof typeof PACKAGE_POINTS; qty: number }) {
  return <View style={styles.packageCard}><Text style={styles.packageName}>باقة {code}</Text><Text style={styles.packageQty}>{qty} شريحة</Text><Text style={styles.packageValue}>{PACKAGE_POINTS[code]} نقاط / شريحة</Text></View>;
}

function shiftLabel(status?: string | null) {
  if (status === "open") return "الشفت مفتوح";
  if (status === "ended") return "تم إنهاء الشفت";
  if (status === "absent") return "غائب";
  return "لم يبدأ";
}

function salesLabel(status?: string | null) {
  if (status === "approved") return "معتمدة";
  if (status === "submitted") return "بانتظار الاعتماد";
  if (status === "rejected") return "مرفوضة - يمكن التعديل";
  if (status === "draft") return "مسودة";
  return "لم تسجل";
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7FB" },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 50 },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 22, gap: 12 },
  hello: { textAlign: "right", color: "#8B96A5", fontSize: 14 },
  name: { textAlign: "right", color: "#17233C", fontSize: 21, fontWeight: "900", marginTop: 4 },
  muted: { color: "#8792A1", marginTop: 8, textAlign: "center" },
  logout: { color: "#B42318", fontWeight: "900", padding: 10 },
  errorBox: { backgroundColor: "#FEF3F2", borderRadius: 14, padding: 12, marginBottom: 14 },
  errorText: { color: "#B42318", textAlign: "right", fontWeight: "700" },
  targetCard: { backgroundColor: "#17233C", borderRadius: 28, padding: 22, marginBottom: 28 },
  targetLabel: { color: "#BCC5D2", textAlign: "center", fontSize: 15 },
  targetValue: { color: "#FFFFFF", textAlign: "center", fontSize: 44, fontWeight: "900", marginTop: 5 },
  targetPoints: { color: "#65D9B5", textAlign: "center", fontWeight: "800", fontSize: 16 },
  separator: { height: 1, backgroundColor: "#33405A", marginVertical: 18 },
  targetRow: { flexDirection: "row-reverse", justifyContent: "space-around", gap: 8 },
  smallLabel: { color: "#AEB9C9", textAlign: "center", fontSize: 11 },
  smallValue: { color: "#FFFFFF", textAlign: "center", fontSize: 17, fontWeight: "900", marginTop: 5 },
  sectionTitle: { textAlign: "right", fontSize: 19, fontWeight: "900", color: "#17233C", marginBottom: 13, marginTop: 4 },
  grid: { flexDirection: "row-reverse", gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 17 },
  statLabel: { textAlign: "right", color: "#8792A1", fontSize: 12 },
  statValue: { textAlign: "right", color: "#17233C", fontSize: 18, fontWeight: "900", marginTop: 7 },
  packageGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 12, marginBottom: 25 },
  packageCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 19, padding: 16 },
  packageName: { textAlign: "right", color: "#17233C", fontSize: 17, fontWeight: "900" },
  packageQty: { textAlign: "right", color: "#17233C", fontSize: 22, fontWeight: "900", marginTop: 7 },
  packageValue: { textAlign: "right", marginTop: 5, color: "#16A77A", fontWeight: "800", fontSize: 12 },
  primaryButton: { backgroundColor: "#16A77A", borderRadius: 18, paddingVertical: 17, marginBottom: 12 },
  primaryButtonText: { textAlign: "center", color: "#FFFFFF", fontWeight: "900", fontSize: 17 },
  secondaryButton: { backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 17, borderWidth: 1, borderColor: "#DEE4EB", marginTop: 12 },
  secondaryButtonText: { textAlign: "center", color: "#17233C", fontWeight: "900", fontSize: 17 },
  dangerGhost: { borderWidth: 1, borderColor: "#FDA29B", borderRadius: 18, paddingVertical: 15 },
  dangerText: { color: "#B42318", textAlign: "center", fontWeight: "900" },
  absentBox: { backgroundColor: "#FEF3F2", borderRadius: 18, padding: 16 },
  absentText: { color: "#B42318", textAlign: "center", fontWeight: "900" },
});
