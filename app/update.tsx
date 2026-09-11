import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { checkForAppUpdate, downloadAndInstallUpdate, explainMissingUpdateUrl, UpdateInfo } from "../lib/updater";

export default function UpdateScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);

  const refresh = async () => {
    setLoading(true);
    try { setInfo(await checkForAppUpdate()); }
    catch (e) { Alert.alert("تعذر فحص التحديث", e instanceof Error ? e.message : "حاول مرة أخرى"); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const install = async () => {
    if (!info?.apkUrl) return explainMissingUpdateUrl();
    try {
      setProgress(0);
      await downloadAndInstallUpdate(info.apkUrl, setProgress);
    } catch (e) {
      Alert.alert("تعذر تثبيت التحديث", e instanceof Error ? e.message : "حاول مرة أخرى");
    } finally { setProgress(null); }
  };

  return <SafeAreaView style={s.page}>
    <View style={s.header}><Pressable onPress={() => router.back()}><Text style={s.back}>رجوع</Text></Pressable><Text style={s.title}>التحديثات</Text><View style={{width:40}}/></View>
    <View style={s.card}>
      <View style={s.logo}><Text style={s.logoSmall}>الوسام</Text><Text style={s.logoBig}>الجنوبية</Text></View>
      {loading ? <ActivityIndicator size="large"/> : <>
        <Text style={s.version}>الإصدار الحالي {info?.currentVersion} ({info?.currentBuild})</Text>
        <Text style={s.latest}>آخر إصدار {info?.latestVersion} ({info?.latestBuild})</Text>
        {!!info?.notes && <Text style={s.notes}>{info.notes}</Text>}
        {info?.available ? <Pressable style={s.primary} onPress={install}><Text style={s.primaryText}>{progress === null ? "تنزيل وتثبيت التحديث" : `جاري التنزيل ${Math.round(progress * 100)}%`}</Text></Pressable> : <View style={s.ok}><Text style={s.okText}>أنت على آخر إصدار ✓</Text></View>}
        <Pressable style={s.secondary} onPress={refresh}><Text style={s.secondaryText}>فحص مرة أخرى</Text></Pressable>
      </>}
    </View>
    <Text style={s.help}>عند توفر APK جديد يتم تنزيله من داخل التطبيق، ثم يفتح مثبت أندرويد لإكمال التحديث فوق النسخة الحالية بدون حذفها.</Text>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:"#F4F7FB",padding:18},header:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",marginBottom:26},back:{color:"#1677FF",fontWeight:"900"},title:{fontSize:24,fontWeight:"900",color:"#102847"},card:{backgroundColor:"#fff",borderRadius:28,padding:22,alignItems:"stretch"},logo:{alignSelf:"center",width:150,height:150,borderRadius:75,borderWidth:8,borderColor:"#111",alignItems:"center",justifyContent:"center",marginBottom:18},logoSmall:{fontSize:16,fontWeight:"900",color:"#111"},logoBig:{fontSize:25,fontWeight:"900",color:"#111",marginTop:4},version:{textAlign:"center",fontWeight:"800",color:"#667085",marginTop:4},latest:{textAlign:"center",fontSize:18,fontWeight:"900",color:"#17233C",marginTop:10},notes:{textAlign:"right",color:"#475467",lineHeight:22,marginTop:18,backgroundColor:"#F8FAFC",padding:14,borderRadius:14},primary:{marginTop:18,backgroundColor:"#16A77A",paddingVertical:16,borderRadius:16},primaryText:{textAlign:"center",color:"#fff",fontWeight:"900"},secondary:{marginTop:10,borderWidth:1,borderColor:"#D0D5DD",paddingVertical:14,borderRadius:16},secondaryText:{textAlign:"center",color:"#344054",fontWeight:"900"},ok:{marginTop:18,backgroundColor:"#ECFDF3",padding:15,borderRadius:16},okText:{textAlign:"center",color:"#067647",fontWeight:"900"},help:{textAlign:"center",color:"#667085",lineHeight:21,marginTop:18,paddingHorizontal:8}
});
