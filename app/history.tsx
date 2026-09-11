import { useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { currentProfile } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { C, R } from '@/lib/theme';
import { Metric, Pill, ScreenTitle } from '@/lib/ui';

const nowRiyadh=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});
export default function History(){
 const router=useRouter();const [rows,setRows]=useState<any[]>([]);const [summary,setSummary]=useState<any>();const [refreshing,setRefreshing]=useState(false);
 async function load(){const p=await currentProfile();const d=nowRiyadh(),y=+d.slice(0,4),m=+d.slice(5,7);const start=`${d.slice(0,7)}-01`;const [r,s]=await Promise.all([supabase.from('daily_operations').select('*').eq('employee_id',p.id).gte('work_date',start).lte('work_date',d).order('work_date',{ascending:false}),supabase.from('monthly_performance').select('*').eq('employee_id',p.id).eq('year',y).eq('month',m).maybeSingle()]);if(r.error)throw r.error;setRows(r.data||[]);setSummary(s.data)}
 useEffect(()=>{load().catch(()=>{})},[]);
 return <SafeAreaView style={st.page}><ScrollView contentContainerStyle={st.wrap} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true);await load();setRefreshing(false)}}/>}>
  <ScreenTitle eyebrow="السجل" title="متابعة الشهر" right={<TouchableOpacity onPress={()=>router.back()}><Text style={st.back}>رجوع</Text></TouchableOpacity>}/>
  <View style={st.metrics}><Metric label="النقاط" value={Math.round(Number(summary?.total_points||0))} style={st.metric}/><Metric label="أيام الدوام" value={summary?.attended_days||0} style={st.metric}/><Metric label="المطلوب" value={Math.round(Number(summary?.eligible_target_points||0))} style={st.metric}/></View>
  <Text style={st.section}>تفاصيل الأيام</Text>
  {rows.map(r=>{const absent=r.attendance_status==='absent'||r.shift_status==='absent';const present=r.attendance_status==='present';const tone=absent?'danger':present?'success':'neutral';const state=absent?'غائب':present?'حاضر':'بدون دوام';return <View style={st.card} key={r.work_date}><View style={st.top}><View><Text style={st.date}>{r.work_date}</Text><Text style={st.loc}>{r.assigned_location||'بدون موقع'}</Text></View><Pill text={state} tone={tone as any}/></View><View style={st.row}><DayStat label="الشرائح" value={r.total_units||0}/><DayStat label="النقاط" value={Math.round(Number(r.total_points||0))}/><DayStat label="التارجت" value={absent?0:Math.round(Number(r.eligible_target_points||0))}/></View>{absent&&<Text style={st.absent}>يوم غياب — لا يوجد تارجت مطلوب.</Text>}</View>})}
 </ScrollView></SafeAreaView>}
function DayStat({label,value}:{label:string,value:string|number}){return <View style={st.dayStat}><Text style={st.dsLabel}>{label}</Text><Text style={st.dsValue}>{value}</Text></View>}
const st=StyleSheet.create({page:{flex:1,backgroundColor:C.bg},wrap:{padding:18,paddingBottom:50},back:{color:C.primary,fontWeight:'900',fontSize:12},metrics:{flexDirection:'row-reverse',gap:8,marginTop:20},metric:{flex:1,minHeight:88,padding:12},section:{textAlign:'right',fontSize:18,fontWeight:'900',color:C.ink,marginTop:24,marginBottom:11},card:{backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:R.lg,padding:14,marginBottom:9},top:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'flex-start'},date:{textAlign:'right',fontWeight:'900',fontSize:14,color:C.ink},loc:{textAlign:'right',fontSize:10,color:C.muted,marginTop:3},row:{flexDirection:'row-reverse',gap:7,marginTop:12},dayStat:{flex:1,backgroundColor:C.bg,borderRadius:R.sm,padding:9},dsLabel:{textAlign:'right',fontSize:9,color:C.faint},dsValue:{textAlign:'right',fontWeight:'900',fontSize:14,color:C.ink,marginTop:3},absent:{textAlign:'right',color:C.danger,fontSize:10,fontWeight:'800',marginTop:10}});
