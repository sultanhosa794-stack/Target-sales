import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, businessDate, getStoredProfile, logout, Profile } from "../lib/backend";

type Employee = { id: string; full_name: string; username: string; role: string };
type Daily = {
  employee_id: string;
  shift_status?: string | null;
  assigned_location?: string | null;
  total_units?: number | null;
  total_points?: number | null;
  sales_status?: string | null;
  package_35?: number | null;
  package_58?: number | null;
  package_75?: number | null;
  package_104?: number | null;
};
type Sales = { id: string; employee_id: string; status: string; total_units: number; total_points: number };
type MonthlyPerformance = {
  employee_id: string;
  attended_days?: number | null;
  sales_points?: number | null;
  opening_points?: number | null;
  total_points?: number | null;
  eligible_target_points?: number | null;
};
type DeviceBinding = {
  id: string;
  employee_id: string;
  device_label?: string | null;
  platform?: string | null;
  active?: boolean | null;
  bound_at?: string | null;
  migration_pending?: boolean | null;
};
type Region = { id: string; name: string; shift_type?: string | null };

export default function AdminScreen() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [sales, setSales] = useState<Sales[]>([]);
  const [monthly, setMonthly] = useState<MonthlyPerformance[]>([]);
  const [devices, setDevices] = useState<DeviceBinding[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "ended" | "absent" | "not_started">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const profile = await getStoredProfile();
      if (!profile) return router.replace("/");
      if (!["system_admin", "manager", "viewer"].includes(profile.role)) return router.replace("/home");
      setMe(profile);

      const date = businessDate();
      const [year, month] = date.split("-").map(Number);
      const [people, ops, entries, monthRows, deviceRows, regions] = await Promise.all([
        api<Employee[]>("/rest/v1/profiles?select=id,full_name,username,role&active=eq.true&role=eq.employee&order=full_name.asc"),
        api<Daily[]>(`/rest/v1/daily_operations?select=employee_id,shift_status,assigned_location,total_units,total_points,sales_status,package_35,package_58,package_75,package_104&work_date=eq.${date}`),
        api<Sales[]>(`/rest/v1/sales_entries?select=id,employee_id,status,total_units,total_points&business_date=eq.${date}`),
        api<MonthlyPerformance[]>(`/rest/v1/monthly_performance?select=employee_id,attended_days,sales_points,opening_points,total_points,eligible_target_points&year=eq.${year}&month=eq.${month}`),
        api<DeviceBinding[]>("/rest/v1/device_bindings?select=id,employee_id,device_label,platform,active,bound_at,migration_pending&order=bound_at.desc"),
        api<Region[]>("/rest/v1/regions?select=id,name,shift_type&active=eq.true&order=created_at.asc&limit=1"),
      ]);
      setEmployees(people ?? []);
      setDaily(ops ?? []);
      setSales(entries ?? []);
      setMonthly(monthRows ?? []);
      setDevices(deviceRows ?? []);
      setRegion(regions?.[0] ?? null);
    } catch (e) {
      Alert.alert("تعذر تحميل لوحة الإدارة", e instanceof Error ? e.message : "حاول مرة أخرى");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const dailyMap = useMemo(() => new Map(daily.map((d) => [d.employee_id, d])), [daily]);
  const salesMap = useMemo(() => new Map(sales.map((s) => [s.employee_id, s])), [sales]);
  const monthlyMap = useMemo(() => new Map(monthly.map((m) => [m.employee_id, m])), [monthly]);
  const deviceMap = useMemo(() => {
    const map = new Map<string, DeviceBinding>();
    for (const d of devices) if (!map.has(d.employee_id) || d.active) map.set(d.employee_id, d);
    return map;
  }, [devices]);

  const summary = useMemo(() => {
    let open = 0, ended = 0, absent = 0, notStarted = 0;
    let units = 0, points = 0, p35 = 0, p58 = 0, p75 = 0, p104 = 0;
    for (const e of employees) {
      const d = dailyMap.get(e.id);
      const status = d?.shift_status;
      if (status === "open") open++;
      else if (status === "ended") ended++;
      else if (status === "absent") absent++;
      else notStarted++;
      units += Number(d?.total_units ?? 0);
      points += Number(d?.total_points ?? 0);
      p35 += Number(d?.package_35 ?? 0); p58 += Number(d?.package_58 ?? 0); p75 += Number(d?.package_75 ?? 0); p104 += Number(d?.package_104 ?? 0);
    }
    return { open, ended, absent, notStarted, units, points, p35, p58, p75, p104 };
  }, [employees, dailyMap]);

  const filteredEmployees = useMemo(() => employees.filter((e) => {
    const d = dailyMap.get(e.id);
    const status = d?.shift_status ?? "not_started";
    const text = `${e.full_name} ${e.username} ${d?.assigned_location ?? ""}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (statusFilter === "all" || status === statusFilter);
  }), [employees, dailyMap, search, statusFilter]);

  const topFive = useMemo(() => [...employees].sort((a, b) => Number(monthlyMap.get(b.id)?.total_points ?? 0) - Number(monthlyMap.get(a.id)?.total_points ?? 0)).slice(0, 5), [employees, monthlyMap]);

  const markAbsent = (employee: Employee) => {
    Alert.alert("رفع غياب", `تسجيل ${employee.full_name} غائبًا اليوم؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل", style: "destructive", onPress: async () => {
        setBusyId(employee.id);
        try {
          await api("/rest/v1/rpc/admin_mark_absent", { method: "POST", body: JSON.stringify({ p_employee_id: employee.id, p_reason: null }) });
          await load();
        } catch (e) {
          Alert.alert("تعذر تسجيل الغياب", e instanceof Error ? e.message : "حاول مرة أخرى");
        } finally { setBusyId(null); }
      }},
    ]);
  };

  const review = async (entry: Sales, decision: "approved" | "rejected") => {
    setBusyId(entry.id);
    try {
      await api("/rest/v1/rpc/review_sales_entry", { method: "POST", body: JSON.stringify({ p_sales_entry_id: entry.id, p_decision: decision, p_reason: decision === "rejected" ? "إعادة إدخال المبيعات" : null }) });
      await load();
    } catch (e) {
      Alert.alert("تعذر الاعتماد", e instanceof Error ? e.message : "حاول مرة أخرى");
    } finally { setBusyId(null); }
  };

  const signOut = async () => { await logout(); router.replace("/"); };

  if (loading) return <SafeAreaView style={[styles.page, styles.center]}><ActivityIndicator size="large" /><Text style={styles.muted}>جاري تجهيز لوحة المنطقة…</Text></SafeAreaView>;

  const canEdit = me?.role === "system_admin" || me?.role === "manager";
  const shiftName = region?.shift_type === "morning" ? "صباح" : region?.shift_type === "evening" ? "مساء" : "";

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={signOut}><Text style={styles.logout}>تسجيل الخروج</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>مرحبًا {me?.full_name?.split(" ")[0] ?? "سلطان"} 👋</Text>
            <Text style={styles.subtitle}>لوحة معلومات {region?.name ?? "الجنوبية"} {shiftName}</Text>
            <Text style={styles.date}>{businessDate()}</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>القائمة</Text>
          <View style={styles.menuGrid}>
            <MenuItem icon="🏠" label="لوحة المعلومات" active />
            <MenuItem icon="👥" label="الموظفين" />
            <MenuItem icon="💰" label="المبيعات اليومية" />
            <MenuItem icon="📊" label="المتابعة الشهرية" />
            <MenuItem icon="📱" label="أجهزة الموظفين" />
            <MenuItem icon="✅" label="الاعتمادات المعلقة" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>ملخص المنطقة اليوم</Text>
        <View style={styles.statGrid}>
          <StatCard label="إجمالي الموظفين" value={String(employees.length)} sub={`حاضر ${summary.open + summary.ended} • غائب ${summary.absent} • لم يبدأ ${summary.notStarted}`} />
          <StatCard label="عدد الشرائح اليوم" value={String(summary.units)} sub={`35: ${summary.p35} • 58: ${summary.p58} • 75: ${summary.p75} • 104: ${summary.p104}`} />
          <StatCard label="نقاط مبيعات اليوم" value={String(summary.points)} sub="إجمالي نقاط المنطقة" />
          <StatCard label="متوسط النقاط" value={employees.length ? (summary.points / employees.length).toFixed(1) : "0"} sub="لكل موظف" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>أعلى 5 موظفين هذا الشهر</Text>
          {topFive.map((e, i) => <View key={e.id} style={styles.rankRow}><Text style={styles.rankPoints}>{formatNumber(monthlyMap.get(e.id)?.total_points)} نقطة</Text><Text style={styles.rankName}>{i + 1}. {e.full_name}</Text></View>)}
        </View>

        <Text style={styles.sectionTitle}>متابعة الموظفين</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="بحث بالاسم أو الموقع..." style={styles.search} textAlign="right" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Filter label={`الكل (${employees.length})`} active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
          <Filter label={`حاضر (${summary.open + summary.ended})`} active={statusFilter === "open"} onPress={() => setStatusFilter("open")} />
          <Filter label={`غائب (${summary.absent})`} active={statusFilter === "absent"} onPress={() => setStatusFilter("absent")} />
          <Filter label={`لم يبدأ (${summary.notStarted})`} active={statusFilter === "not_started"} onPress={() => setStatusFilter("not_started")} />
        </ScrollView>

        {filteredEmployees.map((employee) => {
          const d = dailyMap.get(employee.id);
          const m = monthlyMap.get(employee.id);
          const s = salesMap.get(employee.id);
          const device = deviceMap.get(employee.id);
          const status = d?.shift_status ?? "not_started";
          const target = Number(m?.eligible_target_points ?? 0);
          const total = Number(m?.total_points ?? 0);
          const pct = target > 0 ? (total / target) * 100 : 0;
          return (
            <View key={employee.id} style={styles.employeeCard}>
              <View style={styles.employeeHead}>
                <StatusPill status={status} />
                <View style={{ flex: 1 }}><Text style={styles.employeeName}>{employee.full_name}</Text><Text style={styles.username}>@{employee.username}</Text></View>
              </View>
              <Text style={styles.location}>📍 {d?.assigned_location ?? "لا يوجد موقع مسجل اليوم"}</Text>
              <View style={styles.employeeGrid}>
                <Mini label="مبيعات اليوم" value={`${d?.total_units ?? 0} شريحة`} />
                <Mini label="نقاط اليوم" value={String(d?.total_points ?? 0)} />
                <Mini label="نقاط الشهر" value={formatNumber(m?.total_points)} />
                <Mini label="التحقيق" value={`${pct.toFixed(1)}%`} />
                <Mini label="أيام الدوام" value={String(m?.attended_days ?? 0)} />
                <Mini label="الجهاز" value={device?.device_label || "غير مربوط"} />
              </View>
              <Text style={styles.packages}>الباقات اليوم — 35: {d?.package_35 ?? 0} | 58: {d?.package_58 ?? 0} | 75: {d?.package_75 ?? 0} | 104: {d?.package_104 ?? 0}</Text>
              {device && <Text style={styles.deviceMeta}>{device.platform || "غير محدد"} • {device.active ? "نشط" : "غير نشط"}{device.migration_pending ? " • نقل الجهاز معلّق" : ""}</Text>}

              {canEdit && status === "not_started" && <TouchableOpacity disabled={busyId === employee.id} style={styles.absentButton} onPress={() => markAbsent(employee)}><Text style={styles.absentButtonText}>رفع غياب</Text></TouchableOpacity>}
              {canEdit && s?.status === "submitted" && <View style={styles.actions}><TouchableOpacity disabled={busyId === s.id} style={styles.rejectButton} onPress={() => review(s, "rejected")}><Text style={styles.rejectText}>رفض</Text></TouchableOpacity><TouchableOpacity disabled={busyId === s.id} style={styles.approveButton} onPress={() => review(s, "approved")}><Text style={styles.approveText}>اعتماد المبيعات</Text></TouchableOpacity></View>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) { return <View style={[styles.menuItem, active && styles.menuItemActive]}><Text style={styles.menuIcon}>{icon}</Text><Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{label}</Text></View>; }
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) { return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statSub}>{sub}</Text></View>; }
function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
function Filter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <TouchableOpacity onPress={onPress} style={[styles.filter, active && styles.filterActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></TouchableOpacity>; }
function StatusPill({ status }: { status: string }) { const text = status === "open" ? "الشفت مفتوح" : status === "ended" ? "أنهى الشفت" : status === "absent" ? "غائب" : "لم يبدأ"; return <View style={[styles.statusPill, status === "absent" ? styles.statusAbsent : status === "not_started" ? styles.statusWaiting : styles.statusPresent]}><Text style={styles.statusText}>{text}</Text></View>; }
function formatNumber(v?: number | null) { const n = Number(v ?? 0); return Number.isInteger(n) ? String(n) : n.toFixed(1); }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7FB" }, center: { alignItems: "center", justifyContent: "center" }, content: { padding: 18, paddingBottom: 50 }, muted: { color: "#8792A1", marginTop: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 18 }, welcome: { textAlign: "right", color: "#17233C", fontSize: 27, fontWeight: "900" }, subtitle: { textAlign: "right", color: "#667085", marginTop: 4, fontWeight: "700" }, date: { textAlign: "right", color: "#98A2B3", marginTop: 4 }, logout: { color: "#B42318", fontWeight: "900", paddingVertical: 8 },
  menuCard: { backgroundColor: "#102847", borderRadius: 24, padding: 16, marginBottom: 20 }, menuTitle: { color: "#FFFFFF", textAlign: "right", fontWeight: "900", fontSize: 21, marginBottom: 12 }, menuGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 }, menuItem: { width: "48%", backgroundColor: "#18395F", padding: 13, borderRadius: 14, flexDirection: "row-reverse", alignItems: "center", gap: 8 }, menuItemActive: { backgroundColor: "#1677FF" }, menuIcon: { fontSize: 18 }, menuLabel: { flex: 1, color: "#D8E4F2", textAlign: "right", fontWeight: "800" }, menuLabelActive: { color: "#FFFFFF" },
  sectionTitle: { textAlign: "right", color: "#17233C", fontSize: 20, fontWeight: "900", marginBottom: 12, marginTop: 6 }, statGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginBottom: 18 }, statCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16 }, statLabel: { textAlign: "right", color: "#667085", fontSize: 12 }, statValue: { textAlign: "right", color: "#101828", fontSize: 31, fontWeight: "900", marginTop: 5 }, statSub: { textAlign: "right", color: "#98A2B3", fontSize: 11, marginTop: 6 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 20 }, panelTitle: { textAlign: "right", fontWeight: "900", color: "#17233C", marginBottom: 10, fontSize: 17 }, rankRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EAECF0" }, rankName: { color: "#344054", fontWeight: "800", textAlign: "right", flex: 1 }, rankPoints: { color: "#16A77A", fontWeight: "900" },
  search: { backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#E4E7EC", marginBottom: 10 }, filters: { gap: 8, paddingBottom: 14, flexDirection: "row-reverse" }, filter: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D0D5DD" }, filterActive: { backgroundColor: "#1677FF", borderColor: "#1677FF" }, filterText: { color: "#475467", fontWeight: "800" }, filterTextActive: { color: "#FFFFFF" },
  employeeCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 16, marginBottom: 12 }, employeeHead: { flexDirection: "row", alignItems: "center", gap: 10 }, employeeName: { textAlign: "right", color: "#17233C", fontWeight: "900", fontSize: 17 }, username: { textAlign: "right", color: "#98A2B3", marginTop: 2 }, location: { textAlign: "right", color: "#667085", marginTop: 10 }, employeeGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 14 }, mini: { width: "31%", backgroundColor: "#F8FAFC", borderRadius: 13, padding: 10 }, miniLabel: { textAlign: "center", color: "#98A2B3", fontSize: 10 }, miniValue: { textAlign: "center", color: "#17233C", fontWeight: "900", marginTop: 5, fontSize: 12 }, packages: { textAlign: "right", color: "#475467", marginTop: 12, fontWeight: "700" }, deviceMeta: { textAlign: "right", color: "#98A2B3", marginTop: 5, fontSize: 11 },
  statusPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }, statusPresent: { backgroundColor: "#DCFCE7" }, statusAbsent: { backgroundColor: "#FEE2E2" }, statusWaiting: { backgroundColor: "#FEF3C7" }, statusText: { color: "#344054", fontSize: 11, fontWeight: "900" },
  absentButton: { marginTop: 12, borderWidth: 1, borderColor: "#FDA29B", borderRadius: 14, paddingVertical: 11 }, absentButtonText: { color: "#B42318", textAlign: "center", fontWeight: "900" }, actions: { flexDirection: "row", gap: 8, marginTop: 12 }, approveButton: { flex: 1, backgroundColor: "#16A77A", borderRadius: 14, paddingVertical: 12 }, approveText: { color: "#FFFFFF", textAlign: "center", fontWeight: "900" }, rejectButton: { flex: 1, borderWidth: 1, borderColor: "#FDA29B", borderRadius: 14, paddingVertical: 12 }, rejectText: { color: "#B42318", textAlign: "center", fontWeight: "900" },
});