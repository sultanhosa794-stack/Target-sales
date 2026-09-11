import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";
import { api, businessDate, getStoredProfile, Profile } from "../lib/backend";

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
type Sales = { id: string; employee_id: string; status: string; revision_count: number; total_units: number; total_points: number };

export default function AdminScreen() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [sales, setSales] = useState<Sales[]>([]);
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
      const [people, ops, entries] = await Promise.all([
        api<Employee[]>("/rest/v1/profiles?select=id,full_name,username,role&active=eq.true&role=eq.employee&order=full_name.asc"),
        api<Daily[]>(`/rest/v1/daily_operations?select=employee_id,shift_status,assigned_location,total_units,total_points,sales_status,package_35,package_58,package_75,package_104&work_date=eq.${date}`),
        api<Sales[]>(`/rest/v1/sales_entries?select=id,employee_id,status,revision_count,total_units,total_points&business_date=eq.${date}`),
      ]);
      setEmployees(people ?? []);
      setDaily(ops ?? []);
      setSales(entries ?? []);
    } catch (e) {
      Alert.alert("تعذر تحميل الإدارة", e instanceof Error ? e.message : "حاول مرة أخرى");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const dailyMap = useMemo(() => new Map(daily.map((d) => [d.employee_id, d])), [daily]);
  const salesMap = useMemo(() => new Map(sales.map((s) => [s.employee_id, s])), [sales]);
  const counters = useMemo(() => {
    let open = 0, ended = 0, absent = 0, notStarted = 0;
    for (const e of employees) {
      const status = dailyMap.get(e.id)?.shift_status;
      if (status === "open") open++;
      else if (status === "ended") ended++;
      else if (status === "absent") absent++;
      else notStarted++;
    }
    return { open, ended, absent, notStarted };
  }, [employees, dailyMap]);

  const review = async (entry: Sales, decision: "approved" | "rejected") => {
    setBusyId(entry.id);
    try {
      await api("/rest/v1/rpc/review_sales_entry", {
        method: "POST",
        body: JSON.stringify({ p_sales_entry_id: entry.id, p_decision: decision, p_reason: decision === "rejected" ? "إعادة إدخال المبيعات" : null }),
      });
      await load();
    } catch (e) {
      Alert.alert("تعذر الاعتماد", e instanceof Error ? e.message : "حاول مرة أخرى");
    } finally {
      setBusyId(null);
    }
  };

  const absent = (employee: Employee) => {
    Alert.alert("رفع غياب", `تسجيل ${employee.full_name} غائبًا اليوم؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل",
        style: "destructive",
        onPress: async () => {
          setBusyId(employee.id);
          try {
            await api("/rest/v1/rpc/admin_mark_absent", { method: "POST", body: JSON.stringify({ p_employee_id: employee.id, p_reason: null }) });
            await load();
          } catch (e) {
            Alert.alert("تعذر تسجيل الغياب", e instanceof Error ? e.message : "حاول مرة أخرى");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <SafeAreaView style={[styles.page, styles.center]}><ActivityIndicator size="large" /></SafeAreaView>;
  const canEdit = me?.role === "system_admin" || me?.role === "manager";

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>رجوع</Text></TouchableOpacity>
          <View><Text style={styles.title}>إدارة اليوم</Text><Text style={styles.date}>{businessDate()}</Text></View>
        </View>

        <View style={styles.counterGrid}>
          <Counter label="مفتوح" value={counters.open} />
          <Counter label="منتهي" value={counters.ended} />
          <Counter label="غائب" value={counters.absent} />
          <Counter label="لم يبدأ" value={counters.notStarted} />
        </View>

        {employees.map((employee) => {
          const d = dailyMap.get(employee.id);
          const s = salesMap.get(employee.id);
          const status = d?.shift_status ?? "not_started";
          return (
            <View key={employee.id} style={styles.card}>
              <Text style={styles.employeeName}>{employee.full_name}</Text>
              <Text style={styles.location}>{d?.assigned_location ?? "لا يوجد موقع مسجل اليوم"}</Text>
              <View style={styles.row}>
                <Info label="الشفت" value={shiftLabel(status)} />
                <Info label="الشرائح" value={String(d?.total_units ?? 0)} />
                <Info label="النقاط" value={String(d?.total_points ?? 0)} />
              </View>
              <Text style={styles.packages}>35: {d?.package_35 ?? 0}   |   58: {d?.package_58 ?? 0}   |   75: {d?.package_75 ?? 0}   |   104: {d?.package_104 ?? 0}</Text>
              <Text style={styles.salesState}>المبيعات: {salesLabel(s?.status ?? d?.sales_status)}</Text>

              {canEdit && !d?.shift_status && (
                <TouchableOpacity disabled={busyId === employee.id} style={styles.absentButton} onPress={() => absent(employee)}>
                  <Text style={styles.absentButtonText}>رفع غياب</Text>
                </TouchableOpacity>
              )}

              {canEdit && s?.status === "submitted" && (
                <View style={styles.actions}>
                  <TouchableOpacity disabled={busyId === s.id} style={styles.rejectButton} onPress={() => review(s, "rejected")}><Text style={styles.rejectText}>رفض</Text></TouchableOpacity>
                  <TouchableOpacity disabled={busyId === s.id} style={styles.approveButton} onPress={() => review(s, "approved")}><Text style={styles.approveText}>اعتماد</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Counter({ label, value }: { label: string; value: number }) { return <View style={styles.counter}><Text style={styles.counterValue}>{value}</Text><Text style={styles.counterLabel}>{label}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={{ flex: 1 }}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function shiftLabel(s?: string | null) { return s === "open" ? "مفتوح" : s === "ended" ? "منتهي" : s === "absent" ? "غائب" : "لم يبدأ"; }
function salesLabel(s?: string | null) { return s === "approved" ? "معتمدة" : s === "submitted" ? "معلقة" : s === "rejected" ? "مرفوضة" : "لا يوجد"; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7FB" }, center: { alignItems: "center", justifyContent: "center" }, content: { padding: 18, paddingBottom: 50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, back: { color: "#16A77A", fontWeight: "900", padding: 10 }, title: { textAlign: "right", color: "#17233C", fontSize: 26, fontWeight: "900" }, date: { textAlign: "right", color: "#8792A1", marginTop: 3 },
  counterGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10, marginBottom: 18 }, counter: { width: "48%", backgroundColor: "#17233C", borderRadius: 18, padding: 16 }, counterValue: { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center" }, counterLabel: { color: "#B8C1CF", textAlign: "center", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 22, padding: 17, marginBottom: 12 }, employeeName: { color: "#17233C", fontSize: 18, fontWeight: "900", textAlign: "right" }, location: { color: "#8792A1", textAlign: "right", marginTop: 5 }, row: { flexDirection: "row-reverse", gap: 8, marginTop: 16 }, infoLabel: { color: "#98A2B3", fontSize: 11, textAlign: "center" }, infoValue: { color: "#17233C", fontWeight: "900", textAlign: "center", marginTop: 4 }, packages: { textAlign: "right", color: "#475467", marginTop: 14, fontWeight: "700" }, salesState: { textAlign: "right", color: "#16A77A", marginTop: 8, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 }, approveButton: { flex: 1, backgroundColor: "#16A77A", borderRadius: 14, paddingVertical: 12 }, approveText: { color: "#fff", textAlign: "center", fontWeight: "900" }, rejectButton: { flex: 1, borderColor: "#FDA29B", borderWidth: 1, borderRadius: 14, paddingVertical: 12 }, rejectText: { color: "#B42318", textAlign: "center", fontWeight: "900" },
  absentButton: { marginTop: 14, borderWidth: 1, borderColor: "#FDA29B", borderRadius: 14, paddingVertical: 11 }, absentButtonText: { color: "#B42318", textAlign: "center", fontWeight: "900" },
});
