import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ensureSession, getStoredProfile, login } from "../lib/backend";

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const profile = await getStoredProfile();
        if (profile) {
          await ensureSession();
          if (mounted) router.replace("/home");
          return;
        }
      } catch {
        // A stale session is handled by showing the login screen.
      }
      if (mounted) setChecking(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      router.replace("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={[styles.page, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.checking}>جاري التحقق من الجلسة…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.topArea}>
        <View style={styles.logo}><Text style={styles.logoText}>T&S</Text></View>
        <Text style={styles.title}>Target & Sales</Text>
        <Text style={styles.subtitle}>المبيعات • التارجت • الحضور</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>تسجيل الدخول</Text>
        <Text style={styles.label}>اسم المستخدم</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="أدخل اسم المستخدم"
          placeholderTextColor="#9AA5B4"
          textAlign="right"
          autoCapitalize="none"
          editable={!loading}
        />
        <Text style={styles.label}>كلمة المرور</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="أدخل كلمة المرور"
          placeholderTextColor="#9AA5B4"
          secureTextEntry
          textAlign="right"
          editable={!loading}
          onSubmitEditing={submit}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={[styles.button, (!username.trim() || !password || loading) && styles.buttonDisabled]}
          disabled={!username.trim() || !password || loading}
          onPress={submit}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>دخول</Text>}
        </TouchableOpacity>
      </View>
      <Text style={styles.version}>Target & Sales • V1.1</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7FB", paddingHorizontal: 22 },
  center: { alignItems: "center", justifyContent: "center" },
  checking: { marginTop: 12, color: "#7A8798" },
  topArea: { alignItems: "center", paddingTop: 70, paddingBottom: 35 },
  logo: { width: 78, height: 78, borderRadius: 24, backgroundColor: "#17233C", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  logoText: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  title: { fontSize: 30, fontWeight: "900", color: "#17233C" },
  subtitle: { color: "#7A8798", marginTop: 8, fontSize: 14 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: 22, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 14, elevation: 3 },
  cardTitle: { textAlign: "right", fontSize: 22, fontWeight: "900", color: "#17233C", marginBottom: 22 },
  label: { textAlign: "right", color: "#526174", marginBottom: 8, fontSize: 14, fontWeight: "700" },
  input: { backgroundColor: "#F5F7FA", borderWidth: 1, borderColor: "#E7EBF0", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, fontSize: 16, color: "#17233C", marginBottom: 18 },
  error: { color: "#B42318", textAlign: "right", marginBottom: 12, fontWeight: "700" },
  button: { backgroundColor: "#16A77A", borderRadius: 17, paddingVertical: 17, marginTop: 4, minHeight: 54, justifyContent: "center" },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { textAlign: "center", color: "#FFFFFF", fontWeight: "900", fontSize: 17 },
  version: { textAlign: "center", marginTop: 22, color: "#A1AAB7", fontSize: 12 },
});
