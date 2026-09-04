import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Target & Sales</Text>
          <Text style={styles.subtitle}>نظام المبيعات والتارجت</Text>
        </View>

        <View style={styles.logo}>
          <Text style={styles.logoText}>T&S</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroSmall}>التارجت الشهري</Text>
        <Text style={styles.heroNumber}>3,300</Text>
        <Text style={styles.heroPoints}>نقطة</Text>
      </View>

      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>مبيعات اليوم</Text>
          <Text style={styles.cardValue}>0</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>نقاط اليوم</Text>
          <Text style={styles.cardValue}>0</Text>
        </View>
      </View>

      <View style={styles.packages}>
        <Text style={styles.sectionTitle}>نقاط الباقات</Text>

        <View style={styles.packageRow}>
          <Package name="35" points="5" />
          <Package name="58" points="10" />
        </View>

        <View style={styles.packageRow}>
          <Package name="75" points="10" />
          <Package name="104" points="12" />
        </View>
      </View>

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>تسجيل الدخول</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        الإصدار الجديد — نظام مستقل عن تطبيق جنوبية
      </Text>
    </SafeAreaView>
  );
}

function Package({
  name,
  points
}: {
  name: string;
  points: string;
}) {
  return (
    <View style={styles.package}>
      <Text style={styles.packageName}>باقة {name}</Text>
      <Text style={styles.packagePoints}>{points} نقاط</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F6F8FC",
    paddingHorizontal: 20,
    paddingTop: 20
  },

  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28
  },

  brand: {
    fontSize: 27,
    fontWeight: "800",
    textAlign: "right",
    color: "#132238"
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: "#7B8798",
    textAlign: "right"
  },

  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#14213D",
    alignItems: "center",
    justifyContent: "center"
  },

  logoText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17
  },

  hero: {
    backgroundColor: "#14213D",
    borderRadius: 26,
    padding: 25,
    alignItems: "center",
    marginBottom: 18
  },

  heroSmall: {
    color: "#C8D1DF",
    fontSize: 15
  },

  heroNumber: {
    color: "#FFFFFF",
    fontSize: 45,
    fontWeight: "900",
    marginTop: 8
  },

  heroPoints: {
    color: "#65D9B5",
    fontSize: 16,
    fontWeight: "700"
  },

  cards: {
    flexDirection: "row-reverse",
    gap: 12
  },

  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 20
  },

  cardLabel: {
    textAlign: "right",
    color: "#7B8798",
    fontSize: 14
  },

  cardValue: {
    textAlign: "right",
    color: "#132238",
    fontWeight: "800",
    fontSize: 28,
    marginTop: 7
  },

  packages: {
    marginTop: 25
  },

  sectionTitle: {
    textAlign: "right",
    fontSize: 19,
    fontWeight: "800",
    color: "#132238",
    marginBottom: 12
  },

  packageRow: {
    flexDirection: "row-reverse",
    gap: 12,
    marginBottom: 12
  },

  package: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16
  },

  packageName: {
    textAlign: "right",
    color: "#132238",
    fontWeight: "800",
    fontSize: 17
  },

  packagePoints: {
    textAlign: "right",
    color: "#11A579",
    marginTop: 6,
    fontWeight: "700"
  },

  button: {
    marginTop: 25,
    backgroundColor: "#11A579",
    paddingVertical: 17,
    borderRadius: 18
  },

  buttonText: {
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800"
  },

  footer: {
    textAlign: "center",
    marginTop: 18,
    color: "#9AA5B4",
    fontSize: 12
  }
});
