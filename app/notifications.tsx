import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, getStoredProfile } from "../lib/backend";

type Row = {
  id: string;
  title: string;
  body: string;
  type: string;
  read_at?: string | null;
  created_at: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const p = await getStoredProfile();
      if (!p) return router.replace("/");
      const data = await api<Row[]>(`/rest/v1/notifications?select=id,title,body,type,read_at,created_at&user_id=eq.${p.id}&order=created_at.desc&limit=100`);
      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    const p = await getStoredProfile();
    if (!p) return;
    await api(`/rest/v1/notifications?user_id=eq.${p.id}&read_at=is.null`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    });
    await load();
  };

  if (loading) return <SafeAreaView style={[s.page, s.center]}><ActivityIndicator size="large"/></SafeAreaView>;

  return <SafeAreaView style={s.page}>
    <View style={s.header}>
      <Pressable onPress={() => router.back()}><Text style={s.back}>رجوع</Text></Pressable>
      <Text style={s.title}>الإشعارات</Text>
      <Pressable onPress={markAllRead}><Text style={s.read}>تحديد الكل كمقروء</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      {rows.length === 0 && <View style={s.empty}><Text style={s.emptyText}>لا توجد إشعارات حاليًا</Text></View>}
      {rows.map((n) => <View key={n.id} style={[s.card, !n.read_at && s.unread]}>
        <View style={s.row}><Text style={s.icon}>{iconFor(n.type)}</Text><View style={{flex:1}}><Text style={s.cardTitle}>{n.title}</Text><Text style={s.body}>{n.body}</Text><Text style={s.time}>{formatDate(n.created_at)}</Text></View></View>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

function iconFor(type: string) {
  if (type.includes("shift_start")) return "🟢";
  if (type.includes("shift_end")) return "🔵";
  if (type.includes("absence")) return "🔴";
  if (type.includes("device")) return "📱";
  if (type.includes("sales")) return "💰";
  return "🔔";
}
function formatDate(v: string) {
  try { return new Date(v).toLocaleString("ar-SA"); } catch { return v; }
}

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:"#F4F7FB"},center:{alignItems:"center",justifyContent:"center"},header:{padding:18,flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",gap:8},title:{fontSize:24,fontWeight:"900",color:"#102847"},back:{fontWeight:"900",color:"#1677FF"},read:{fontSize:11,fontWeight:"800",color:"#16A77A"},content:{paddingHorizontal:18,paddingBottom:50},card:{backgroundColor:"#fff",borderRadius:18,padding:15,marginBottom:10,borderWidth:1,borderColor:"#E4E7EC"},unread:{borderColor:"#1677FF",backgroundColor:"#F5F9FF"},row:{flexDirection:"row-reverse",gap:12},icon:{fontSize:22},cardTitle:{textAlign:"right",fontWeight:"900",fontSize:16,color:"#17233C"},body:{textAlign:"right",color:"#475467",marginTop:6,lineHeight:21},time:{textAlign:"right",color:"#98A2B3",fontSize:11,marginTop:8},empty:{backgroundColor:"#fff",padding:28,borderRadius:18},emptyText:{textAlign:"center",color:"#667085",fontWeight:"800"}
});
