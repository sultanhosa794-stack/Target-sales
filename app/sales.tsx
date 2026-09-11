import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, businessDate, getStoredProfile } from "../lib/backend";

type Daily = {
  package_35?: number | null;
  package_58?: number | null;
  package_75?: number | null;
  package_104?: number | null;
  sales_status?: string | null;
  revision_count?: number | null;
  shift_status?: string | null;
};

const points = { p35: 5, p58: 10, p75: 10, p104: 12 };

export default function SalesScreen() {
  const router = useRouter();
  const [p35, setP35] = useState("0");
  const [p58, setP58] = useState("0");
  const [p75, setP75] = useState("0");
  const [p104, setP104] = useState("0");
  const [daily, setDaily] = useState<Daily>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await getStoredProfile();
        if (!profile) return router.replace("/");
        const rows = await api<Daily[]>(`/rest/v1/daily_operations?select=package_35,package_58,package_75,package_104,sales_status,revision_count,shift_status&employee_id=eq.${profile.id}&work_date=eq.${businessDate()}&limit=1`);
        const d = rows?.[0] ?? {};
        setDaily(d);
        setP35(String(d.package_35 ?? 0));
        setP58(String(d.package_58 ?? 0));
        setP75(String(d.package_75 ?? 0));
        setP104(String(d.package_104 ?? 0));
      } catch (e) {
        Alert.alert("خطأ", e instanceof Error ? e.message : "تعذر تحميل المبيعات");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const nums = useMemo(() => ({
    p35: Number(p35 || 0),
    p58: Number(p58 || 0),
    p75: Number(p75 || 0),
    p104: Number(p104 || 0),
  }), [p35, p58, p75, p104]);

  const totalUnits = nums.p35 + nums.p58 + nums.p75 + nums.p104;
  const totalPoints = nums.p35 * points.p35 + nums.p58 * points.p58 + nums.p75 * points.p75 + nums.p104 * points.p104;
  const invalid = Object.values(nums).some((n) => !Number.isInteger(n) || n < 0 || n > 100) || totalUnits > 100;
  const locked = daily.sales_status === "approved" || Number(daily.revision_count ?? 0) >= 1;

  const submit = async () => {
    if (daily.shift_status !== "ended") return Alert.alert("أكمل الشفت أولًا", "تسجيل المبيعات متاح بعد إنهاء الشفت.");
    if (invalid) return Alert.alert("راجع الأعداد", "كل باقة من 0 إلى 100، وإجمالي الشرائح لا يتجاوز 100.");
    if (locked) return Alert.alert("المبيعات مقفلة", "تم استهلاك التعديل المسموح أو اعتماد المبيعات.");
    setSaving(true);
    try {
      const result = await api<any>("/rest/v1/rpc/submit_my_sales", {
        method: "POST",
        body: JSON.stringify({ p35: nums.p35, p58: nums.p58, p75: nums.p75, p104: nums.p104 }),
      });
      Alert.alert("تم الحفظ", `الإجمالي ${result?.total_units ?? totalUnits} شريحة — ${result?.total_points ?? totalPoints} نقطة`, [
        { text: "تمام", onPress: () => router.replace("/home") },
      ]);
    } catch (e) {
      Alert.alert("تعذر حفظ المبيعات", e instanceof Error ? e.message : "حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SafeAreaView style={[styles.page, styles.center]}><ActivityIndicator size="large" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>رجوع</Text></TouchableOpacity>
          <View><Text style={styles.title}>مبيعات اليوم</Text><Text style={styles.date}>{businessDate()}</Text></View>
        </View>

        {daily.shift_status !== "ended" && <View style={styles.notice}><Text style={styles.noticeText}>يجب إنهاء الشفت قبل إرسال المبيعات.</Text></View>}
        {locked && <View style={styles.notice}><Text style={styles.noticeText}>المبيعات الحالية مقفلة ولا يمكن تعديلها مرة أخرى.</Text></View>}

        <View style={styles.card}>
          <PackageInput label="باقة 35" points="5 نقاط" value={p35} setValue={setP35} disabled={locked} />
          <PackageInput label="باقة 58" points="10 نقاط" value={p58} setValue={setP58} disabled={locked} />
          <PackageInput label="باقة 75" points="10 نقاط" value={p75} setValue={setP75} disabled={locked} />
          <PackageInput label="باقة 104" points="12 نقطة" value={p104} setValue={setP104} disabled={locked} />
        </View>

        <View style={styles.totalCard}>
          <View><Text style={styles.totalLabel}>إجمالي النقاط</Text><Text style={styles.totalValue}>{totalPoints}</Text></View>
          <View><Text style={styles.totalLabel}>إجمالي الشرائح</Text><Text style={styles.totalValue}>{totalUnits}</Text></View>
        </View>
        {totalUnits > 100 && <Text style={styles.error}>الإجمالي تجاوز 100 شريحة.</Text>}

        <Text style={styles.rule}>يسمح بتعديل واحد فقط بعد الإدخال الأول، وبعد التعديل تصبح القيمة نهائية.</Text>
        <TouchableOpacity disabled={saving || invalid || locked || daily.shift_status !== "ended"} style={[styles.button, (saving || invalid || locked || daily.shift_status !== "ended") && styles.disabled]} onPress={submit}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{daily.sales_status ? "حفظ التعديل النهائي" : "إرسال المبيعات"}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PackageInput({ label, points, value, setValue, disabled }: { label: string; points: string; value: string; setValue: (v: string) => void; disabled: boolean }) {
  return (
    <View style={styles.inputRow}>
      <TextInput style={styles.input} value={value} onChangeText={(v) => setValue(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" textAlign="center" editable={!disabled} maxLength={3} />
      <View style={{ flex: 1 }}><Text style={styles.packageLabel}>{label}</Text><Text style={styles.packagePoints}>{points} / شريحة</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7FB" }, center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  back: { color: "#16A77A", fontWeight: "900", padding: 10 }, title: { textAlign: "right", fontSize: 26, fontWeight: "900", color: "#17233C" }, date: { textAlign: "right", color: "#8792A1", marginTop: 4 },
  notice: { backgroundColor: "#FFF4E5", borderRadius: 16, padding: 14, marginBottom: 14 }, noticeText: { textAlign: "right", color: "#9A6700", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 18, gap: 14 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 16 }, input: { width: 88, backgroundColor: "#F4F7FB", borderRadius: 14, paddingVertical: 14, fontSize: 20, fontWeight: "900", color: "#17233C", borderWidth: 1, borderColor: "#E4E9F0" },
  packageLabel: { textAlign: "right", fontSize: 18, fontWeight: "900", color: "#17233C" }, packagePoints: { textAlign: "right", color: "#16A77A", marginTop: 3, fontWeight: "700" },
  totalCard: { marginTop: 16, backgroundColor: "#17233C", borderRadius: 22, padding: 20, flexDirection: "row-reverse", justifyContent: "space-around" }, totalLabel: { color: "#AEB9C9", textAlign: "center" }, totalValue: { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginTop: 5 },
  error: { color: "#B42318", textAlign: "right", marginTop: 10, fontWeight: "800" }, rule: { textAlign: "right", color: "#667085", marginVertical: 16, lineHeight: 21 },
  button: { backgroundColor: "#16A77A", borderRadius: 18, paddingVertical: 17, minHeight: 54, justifyContent: "center" }, disabled: { opacity: 0.4 }, buttonText: { color: "#fff", textAlign: "center", fontWeight: "900", fontSize: 17 },
});
