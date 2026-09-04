import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const MONTHLY_TARGET = 3300;

const PACKAGE_POINTS = [
  { packageName: "35", points: 5 },
  { packageName: "58", points: 10 },
  { packageName: "75", points: 10 },
  { packageName: "104", points: 12 },
];

export default function HomeScreen() {
  const daysInMonth = 30;
  const dailyTarget = MONTHLY_TARGET / daysInMonth;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>مرحبًا بك</Text>
            <Text style={styles.name}>Target & Sales</Text>
          </View>

          <View style={styles.profileCircle}>
            <Text style={styles.profileText}>T&S</Text>
          </View>
        </View>

        <View style={styles.targetCard}>
          <Text style={styles.targetLabel}>التارجت الشهري</Text>

          <Text style={styles.targetValue}>3,300</Text>

          <Text style={styles.targetPoints}>نقطة</Text>

          <View style={styles.separator} />

          <View style={styles.targetRow}>
            <View>
              <Text style={styles.smallLabel}>المطلوب اليومي</Text>
              <Text style={styles.smallValue}>
                {dailyTarget.toFixed(2)}
              </Text>
            </View>

            <View>
              <Text style={styles.smallLabel}>أيام الشهر</Text>
              <Text style={styles.smallValue}>{daysInMonth}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ملخص اليوم</Text>

        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>نقاط اليوم</Text>
            <Text style={styles.statValue}>0</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>إجمالي المبيعات</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>نسبة التارجت</Text>
            <Text style={styles.statValue}>0%</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>حالة الشفت</Text>
            <Text style={styles.shiftValue}>لم يبدأ</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>نقاط الباقات</Text>

        <View style={styles.packageGrid}>
          {PACKAGE_POINTS.map((item) => (
            <View key={item.packageName} style={styles.packageCard}>
              <Text style={styles.packageName}>
                باقة {item.packageName}
              </Text>

              <Text style={styles.packageValue}>
                {item.points} نقاط
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>العمليات</Text>

        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>بداية الشفت</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>تسجيل المبيعات</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 50,
  },

  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  hello: {
    textAlign: "right",
    color: "#8B96A5",
    fontSize: 14,
  },

  name: {
    textAlign: "right",
    color: "#17233C",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },

  profileCircle: {
    width: 55,
    height: 55,
    backgroundColor: "#17233C",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  profileText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  targetCard: {
    backgroundColor: "#17233C",
    borderRadius: 28,
    padding: 25,
    marginBottom: 28,
  },

  targetLabel: {
    color: "#BCC5D2",
    textAlign: "center",
    fontSize: 15,
  },

  targetValue: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 48,
    fontWeight: "900",
    marginTop: 5,
  },

  targetPoints: {
    color: "#65D9B5",
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16,
  },

  separator: {
    height: 1,
    backgroundColor: "#33405A",
    marginVertical: 20,
  },

  targetRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
  },

  smallLabel: {
    color: "#AEB9C9",
    textAlign: "center",
    fontSize: 13,
  },

  smallValue: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5,
  },

  sectionTitle: {
    textAlign: "right",
    fontSize: 19,
    fontWeight: "900",
    color: "#17233C",
    marginBottom: 13,
  },

  grid: {
    flexDirection: "row-reverse",
    gap: 12,
    marginBottom: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
  },

  statLabel: {
    textAlign: "right",
    color: "#8792A1",
    fontSize: 13,
  },

  statValue: {
    textAlign: "right",
    color: "#17233C",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 7,
  },

  shiftValue: {
    textAlign: "right",
    color: "#D78B23",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },

  packageGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 25,
  },

  packageCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 18,
  },

  packageName: {
    textAlign: "right",
    color: "#17233C",
    fontSize: 17,
    fontWeight: "900",
  },

  packageValue: {
    textAlign: "right",
    marginTop: 7,
    color: "#16A77A",
    fontWeight: "800",
  },

  primaryButton: {
    backgroundColor: "#16A77A",
    borderRadius: 18,
    paddingVertical: 17,
    marginBottom: 12,
  },

  primaryButtonText: {
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
  },

  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: "#DEE4EB",
  },

  secondaryButtonText: {
    textAlign: "center",
    color: "#17233C",
    fontWeight: "900",
    fontSize: 17,
  },
});
