import { useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = () => {
    if (!username.trim() || !password.trim()) {
      return;
    }

    router.push("/home");
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.topArea}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>T&S</Text>
        </View>

        <Text style={styles.title}>Target & Sales</Text>

        <Text style={styles.subtitle}>
          نظام إدارة المبيعات والتارجت والحضور
        </Text>
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
        />

        <TouchableOpacity
          style={[
            styles.button,
            (!username.trim() || !password.trim()) && styles.buttonDisabled,
          ]}
          disabled={!username.trim() || !password.trim()}
          onPress={login}
        >
          <Text style={styles.buttonText}>دخول</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Target & Sales • V1</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F4F7FB",
    paddingHorizontal: 22,
  },

  topArea: {
    alignItems: "center",
    paddingTop: 70,
    paddingBottom: 35,
  },

  logo: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: "#17233C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#17233C",
  },

  subtitle: {
    color: "#7A8798",
    marginTop: 8,
    fontSize: 14,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },

  cardTitle: {
    textAlign: "right",
    fontSize: 22,
    fontWeight: "900",
    color: "#17233C",
    marginBottom: 22,
  },

  label: {
    textAlign: "right",
    color: "#526174",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
  },

  input: {
    backgroundColor: "#F5F7FA",
    borderWidth: 1,
    borderColor: "#E7EBF0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: "#17233C",
    marginBottom: 18,
  },

  button: {
    backgroundColor: "#16A77A",
    borderRadius: 17,
    paddingVertical: 17,
    marginTop: 4,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
  },

  version: {
    textAlign: "center",
    marginTop: 22,
    color: "#A1AAB7",
    fontSize: 12,
  },
});
