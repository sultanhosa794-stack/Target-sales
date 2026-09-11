import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { currentProfile, signInWithUsername } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';

export default function Login(){
 const router=useRouter(); const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [loading,setLoading]=useState(false);const [checking,setChecking]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{(async()=>{try{const {data}=await supabase.auth.getSession();if(data.session){const p=await currentProfile();router.replace(p.role==='system_admin'||p.role==='manager'||p.role==='viewer'?'/admin':'/home')}}catch{}finally{setChecking(false)}})()},[]);
 async function login(){if(!username.trim()||!password)return;setLoading(true);setError('');try{await signInWithUsername(username,password);const p=await currentProfile();router.replace(p.role==='system_admin'||p.role==='manager'||p.role==='viewer'?'/admin':'/home')}catch(e:any){setError(e?.message||'تعذر تسجيل الدخول')}finally{setLoading(false)}}
 if(checking)return <SafeAreaView style={s.page}><View style={s.loading}><View style={s.mark}><Text style={s.markText}>ج</Text></View><ActivityIndicator size="large" color={C.primary}/></View></SafeAreaView>;
 return <SafeAreaView style={s.page}><KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}><View style={s.body}>
   <View style={s.brand}><View style={s.mark}><Text style={s.markText}>ج</Text></View><Text style={s.title}>مبيعات الجنوبية</Text><Text style={s.sub}>إدارة يوم العمل من مكان واحد</Text></View>
   <View style={s.card}><Text style={s.welcome}>أهلاً بك</Text><Text style={s.helper}>سجّل الدخول للوصول إلى الشفت، المبيعات والتارجت</Text>
    <Text style={s.label}>اسم المستخدم</Text><TextInput value={username} onChangeText={setUsername} style={s.input} textAlign="right" autoCapitalize="none" autoCorrect={false} placeholder="اكتب اسم المستخدم" placeholderTextColor={C.faint}/>
    <Text style={s.label}>كلمة المرور</Text><TextInput value={password} onChangeText={setPassword} style={s.input} textAlign="right" secureTextEntry placeholder="••••••••" placeholderTextColor={C.faint} onSubmitEditing={login}/>
    {!!error&&<View style={s.errorBox}><Text style={s.error}>{error}</Text></View>}
    <TouchableOpacity activeOpacity={.85} style={[s.btn,(loading||!username.trim()||!password)&&s.disabled]} onPress={login} disabled={loading||!username.trim()||!password}>{loading?<ActivityIndicator color="#fff"/>:<Text style={s.btnText}>دخول</Text>}</TouchableOpacity>
   </View>
   <Text style={s.footer}>نسخة تشغيل جديدة • المنطقة الجنوبية</Text>
 </View></KeyboardAvoidingView></SafeAreaView>
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:C.bg},body:{flex:1,paddingHorizontal:22,justifyContent:'center'},loading:{flex:1,alignItems:'center',justifyContent:'center',gap:24},brand:{alignItems:'center',marginBottom:30},mark:{width:76,height:76,borderRadius:24,backgroundColor:C.navy,alignItems:'center',justifyContent:'center',marginBottom:15,shadowColor:'#000',shadowOpacity:.12,shadowRadius:16,elevation:6},markText:{color:'#fff',fontSize:35,fontWeight:'900'},title:{fontSize:30,fontWeight:'900',color:C.ink},sub:{marginTop:6,color:C.muted,fontSize:14},card:{backgroundColor:C.card,borderRadius:R.xl,padding:22,borderWidth:1,borderColor:C.line},welcome:{textAlign:'right',fontSize:22,fontWeight:'900',color:C.ink},helper:{textAlign:'right',fontSize:12,color:C.muted,lineHeight:19,marginTop:5,marginBottom:20},label:{textAlign:'right',fontWeight:'800',fontSize:12,color:C.muted,marginBottom:7},input:{backgroundColor:C.bg,borderWidth:1,borderColor:C.line,borderRadius:R.md,paddingHorizontal:15,paddingVertical:14,fontSize:16,color:C.ink,marginBottom:15},errorBox:{backgroundColor:C.dangerSoft,borderRadius:R.sm,padding:11,marginBottom:11},error:{textAlign:'right',color:C.danger,fontSize:12,fontWeight:'700'},btn:{backgroundColor:C.primary,borderRadius:R.md,minHeight:54,alignItems:'center',justifyContent:'center',marginTop:2},btnText:{color:'#fff',fontWeight:'900',fontSize:16},disabled:{opacity:.45},footer:{textAlign:'center',color:C.faint,fontSize:11,marginTop:18}});
