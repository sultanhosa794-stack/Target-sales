import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithUsername, currentProfile } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{(async()=>{
    const {data}=await supabase.auth.getSession();
    if(data.session){
      try{const p=await currentProfile(); router.replace(p.role==='system_admin'||p.role==='manager'?'/admin':'/home');}catch{}
    }
  })()},[]);

  async function login(){
    if(!username.trim()||!password)return;
    setLoading(true);setError('');
    try{
      await signInWithUsername(username,password);
      const p=await currentProfile();
      router.replace(p.role==='system_admin'||p.role==='manager'?'/admin':'/home');
    }catch(e:any){setError(e?.message||'تعذر تسجيل الدخول');}
    finally{setLoading(false)}
  }

  return <SafeAreaView style={s.page}>
    <View style={s.hero}><View style={s.logo}><Text style={s.logoText}>ج</Text></View><Text style={s.title}>مبيعات الجنوبية</Text><Text style={s.sub}>الحضور • الشفت • المبيعات • التارجت</Text></View>
    <View style={s.card}>
      <Text style={s.cardTitle}>تسجيل الدخول</Text>
      <Text style={s.label}>اسم المستخدم</Text><TextInput value={username} onChangeText={setUsername} style={s.input} textAlign="right" autoCapitalize="none" placeholder="اسم المستخدم" />
      <Text style={s.label}>كلمة المرور</Text><TextInput value={password} onChangeText={setPassword} style={s.input} textAlign="right" secureTextEntry placeholder="كلمة المرور" onSubmitEditing={login}/>
      {!!error&&<Text style={s.error}>{error}</Text>}
      <TouchableOpacity style={[s.btn,loading&&{opacity:.6}]} onPress={login} disabled={loading}>{loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnText}>دخول</Text>}</TouchableOpacity>
    </View><Text style={s.version}>الإصدار الجديد 2.0</Text>
  </SafeAreaView>
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#F4F7FB',paddingHorizontal:22},hero:{alignItems:'center',paddingTop:70,paddingBottom:34},logo:{width:80,height:80,borderRadius:25,backgroundColor:'#17233C',alignItems:'center',justifyContent:'center',marginBottom:16},logoText:{color:'#fff',fontSize:36,fontWeight:'900'},title:{fontSize:29,fontWeight:'900',color:'#17233C'},sub:{marginTop:8,color:'#7B8796'},card:{backgroundColor:'#fff',borderRadius:28,padding:22,elevation:3},cardTitle:{fontSize:22,fontWeight:'900',textAlign:'right',marginBottom:20,color:'#17233C'},label:{textAlign:'right',fontWeight:'700',color:'#556274',marginBottom:7},input:{backgroundColor:'#F6F8FA',borderWidth:1,borderColor:'#E4E9EF',borderRadius:16,padding:15,fontSize:16,marginBottom:15},btn:{backgroundColor:'#159A74',borderRadius:17,paddingVertical:16,alignItems:'center',marginTop:5},btnText:{color:'#fff',fontWeight:'900',fontSize:17},error:{textAlign:'right',color:'#B42318',marginBottom:10},version:{textAlign:'center',color:'#A1AAB7',marginTop:20}});
