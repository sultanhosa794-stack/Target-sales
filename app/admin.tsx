import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { api, businessDate, getStoredProfile, logout, Profile } from "../lib/backend";

type Employee={id:string;full_name:string;username:string;role:string};
type Daily={employee_id:string;shift_status?:string|null;assigned_location?:string|null;total_units?:number|null;total_points?:number|null;sales_status?:string|null;package_35?:number|null;package_58?:number|null;package_75?:number|null;package_104?:number|null};
type Sales={id:string;employee_id:string;status:string;total_units:number;total_points:number};
type Monthly={employee_id:string;attended_days?:number|null;total_points?:number|null;eligible_target_points?:number|null};
type Device={id:string;employee_id:string;device_label?:string|null;platform?:string|null;active?:boolean|null;migration_pending?:boolean|null};
type Region={id:string;name:string;shift_type?:string|null};
type Shift={employee_id:string;status:string;start_latitude?:number|null;start_longitude?:number|null;start_accuracy_m?:number|null;start_distance_m?:number|null;started_at?:string|null;end_latitude?:number|null;end_longitude?:number|null;end_accuracy_m?:number|null;end_distance_m?:number|null;end_from_start_distance_m?:number|null;ended_at?:string|null;absence_reason?:string|null};
type Section="dashboard"|"attendance"|"employees"|"daily"|"monthly"|"devices"|"approvals";
type Filter="all"|"open"|"ended"|"absent"|"not_started";

const isDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(`${v}T12:00:00`).getTime());
const moveDate=(v:string,days:number)=>{const d=new Date(`${v}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
const fmt=(v?:number|null)=>{const n=Number(v??0);return Number.isInteger(n)?String(n):n.toFixed(1)};
const salesLabel=(s?:string|null)=>s==="approved"?"معتمدة":s==="submitted"?"معلقة":s==="rejected"?"مرفوضة":"لا يوجد";
const timeLabel=(v?:string|null)=>v?new Date(v).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"}):"—";
const meters=(v?:number|null)=>v==null?"—":`${Math.round(Number(v))} م`;
const coord=(v?:number|null)=>v==null?"—":Number(v).toFixed(6);

export default function AdminScreen(){
 const router=useRouter();
 const [me,setMe]=useState<Profile|null>(null);
 const [employees,setEmployees]=useState<Employee[]>([]),[daily,setDaily]=useState<Daily[]>([]),[sales,setSales]=useState<Sales[]>([]),[monthly,setMonthly]=useState<Monthly[]>([]),[devices,setDevices]=useState<Device[]>([]),[shifts,setShifts]=useState<Shift[]>([]),[region,setRegion]=useState<Region|null>(null);
 const [section,setSection]=useState<Section>("dashboard"),[search,setSearch]=useState(""),[filter,setFilter]=useState<Filter>("all"),[selectedDate,setSelectedDate]=useState(businessDate()),[dateInput,setDateInput]=useState(businessDate());
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[busyId,setBusyId]=useState<string|null>(null);

 const load=useCallback(async()=>{try{
  const p=await getStoredProfile();
  if(!p)return router.replace("/");
  if(!["system_admin","manager","viewer"].includes(p.role))return router.replace("/home");
  setMe(p);
  const [year,month]=selectedDate.split("-").map(Number);
  const [people,ops,entries,months,devs,regions,shiftRows]=await Promise.all([
   api<Employee[]>("/rest/v1/profiles?select=id,full_name,username,role&active=eq.true&role=eq.employee&order=full_name.asc"),
   api<Daily[]>(`/rest/v1/daily_operations?select=employee_id,shift_status,assigned_location,total_units,total_points,sales_status,package_35,package_58,package_75,package_104&work_date=eq.${selectedDate}`),
   api<Sales[]>(`/rest/v1/sales_entries?select=id,employee_id,status,total_units,total_points&business_date=eq.${selectedDate}`),
   api<Monthly[]>(`/rest/v1/monthly_performance?select=employee_id,attended_days,total_points,eligible_target_points&year=eq.${year}&month=eq.${month}`),
   api<Device[]>("/rest/v1/device_bindings?select=id,employee_id,device_label,platform,active,migration_pending&order=bound_at.desc"),
   api<Region[]>("/rest/v1/regions?select=id,name,shift_type&active=eq.true&order=created_at.asc&limit=1"),
   api<Shift[]>(`/rest/v1/shifts?select=employee_id,status,start_latitude,start_longitude,start_accuracy_m,start_distance_m,started_at,end_latitude,end_longitude,end_accuracy_m,end_distance_m,end_from_start_distance_m,ended_at,absence_reason&business_date=eq.${selectedDate}`)
  ]);
  setEmployees(people??[]);setDaily(ops??[]);setSales(entries??[]);setMonthly(months??[]);setDevices(devs??[]);setRegion(regions?.[0]??null);setShifts(shiftRows??[]);
 }catch(e){Alert.alert("تعذر تحميل لوحة الإدارة",e instanceof Error?e.message:"حاول مرة أخرى")}finally{setLoading(false);setRefreshing(false)}},[router,selectedDate]);
 useEffect(()=>{setLoading(true);load()},[load]);

 const dm=useMemo(()=>new Map(daily.map(x=>[x.employee_id,x])),[daily]);
 const mm=useMemo(()=>new Map(monthly.map(x=>[x.employee_id,x])),[monthly]);
 const sm=useMemo(()=>new Map(sales.map(x=>[x.employee_id,x])),[sales]);
 const shm=useMemo(()=>new Map(shifts.map(x=>[x.employee_id,x])),[shifts]);
 const devm=useMemo(()=>{const m=new Map<string,Device>();for(const d of devices)if(!m.has(d.employee_id)||d.active)m.set(d.employee_id,d);return m},[devices]);
 const summary=useMemo(()=>{let open=0,ended=0,absent=0,notStarted=0,units=0,points=0,p35=0,p58=0,p75=0,p104=0,pending=0;for(const e of employees){const d=dm.get(e.id),s=d?.shift_status??shm.get(e.id)?.status;if(s==="open")open++;else if(s==="ended")ended++;else if(s==="absent")absent++;else notStarted++;units+=Number(d?.total_units??0);points+=Number(d?.total_points??0);p35+=Number(d?.package_35??0);p58+=Number(d?.package_58??0);p75+=Number(d?.package_75??0);p104+=Number(d?.package_104??0);if(sm.get(e.id)?.status==="submitted")pending++}return{open,ended,absent,notStarted,units,points,p35,p58,p75,p104,pending}},[employees,dm,shm,sm]);
 const visible=useMemo(()=>employees.filter(e=>{const d=dm.get(e.id),st=d?.shift_status??shm.get(e.id)?.status??"not_started",q=`${e.full_name} ${e.username} ${d?.assigned_location??""}`.toLowerCase();if(!q.includes(search.trim().toLowerCase()))return false;if((section==="employees"||section==="dashboard"||section==="attendance")&&filter!=="all"&&st!==filter)return false;if(section==="approvals"&&sm.get(e.id)?.status!=="submitted")return false;return true}),[employees,dm,shm,sm,search,filter,section]);
 const top=useMemo(()=>[...employees].sort((a,b)=>Number(mm.get(b.id)?.total_points??0)-Number(mm.get(a.id)?.total_points??0)).slice(0,5),[employees,mm]);
 const canEdit=me?.role==="system_admin"||me?.role==="manager",isToday=selectedDate===businessDate();
 const chooseDate=(v:string)=>{if(!isDate(v)){Alert.alert("تاريخ غير صحيح","اكتب التاريخ بالشكل 2026-09-11");return}setDateInput(v);setSelectedDate(v)};
 const shiftDate=(n:number)=>chooseDate(moveDate(selectedDate,n));
 const selectSection=(x:Section)=>{setSearch("");setFilter("all");setSection(x)};
 const openMap=async(lat?:number|null,lng?:number|null)=>{if(lat==null||lng==null)return Alert.alert("لا يوجد موقع","لم يتم حفظ إحداثيات GPS لهذا الحدث.");const url=`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;try{await Linking.openURL(url)}catch{Alert.alert("تعذر فتح الخريطة","حاول مرة أخرى")}};
 const markAbsent=(e:Employee)=>{if(!isToday)return Alert.alert("غير مسموح","رفع الغياب متاح لليوم الحالي فقط.");Alert.alert("رفع غياب",`تسجيل ${e.full_name} غائبًا اليوم؟`,[{text:"إلغاء",style:"cancel"},{text:"تسجيل",style:"destructive",onPress:async()=>{setBusyId(e.id);try{await api("/rest/v1/rpc/admin_mark_absent",{method:"POST",body:JSON.stringify({p_employee_id:e.id,p_reason:null})});await load()}catch(x){Alert.alert("تعذر تسجيل الغياب",x instanceof Error?x.message:"حاول مرة أخرى")}finally{setBusyId(null)}}}])};
 const review=async(s:Sales,decision:"approved"|"rejected")=>{setBusyId(s.id);try{await api("/rest/v1/rpc/review_sales_entry",{method:"POST",body:JSON.stringify({p_sales_entry_id:s.id,p_decision:decision,p_reason:decision==="rejected"?"إعادة إدخال المبيعات":null})});await load()}catch(e){Alert.alert("تعذر الاعتماد",e instanceof Error?e.message:"حاول مرة أخرى")}finally{setBusyId(null)}};

 if(loading)return <SafeAreaView style={[st.page,st.center]}><ActivityIndicator size="large" color="#32D6A0"/><Text style={st.muted}>جاري تحميل بيانات {selectedDate}…</Text></SafeAreaView>;
 const title=section==="dashboard"?"الرئيسية":section==="attendance"?"الحضور والشفتات":section==="employees"?"الموظفين":section==="daily"?"المبيعات اليومية":section==="monthly"?"التقارير الشهرية":section==="devices"?"الأجهزة المربوطة":"الاعتمادات المعلقة";
 const shiftName=region?.shift_type==="morning"?"صباح":region?.shift_type==="evening"?"مساء":"";

 return <SafeAreaView style={st.page}>
  <View style={st.topBar}>
   <View style={{flex:1}}><Text style={st.brand}>مبيعات الجنوبية</Text><Text style={st.brandSub}>{region?.name??"الجنوبية"} {shiftName} • {title}</Text></View>
   <View style={st.adminBubble}><Text style={st.adminInitial}>{me?.full_name?.trim()?.[0]??"س"}</Text></View>
  </View>
  <ScrollView style={st.scroll} contentContainerStyle={st.content} keyboardShouldPersistTaps="always" refreshControl={<RefreshControl tintColor="#32D6A0" refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load()}}/>}>
   <View style={st.hero}><View><Text style={st.heroSmall}>لوحة إدارة النظام</Text><Text style={st.heroTitle}>مرحبًا {me?.full_name?.split(" ")[0]??"سلطان"}</Text><Text style={st.heroDate}>{selectedDate}</Text></View><Text style={st.heroIcon}>▥</Text></View>

   <View style={st.menuGrid}>
    <Menu icon="⌂" label="الرئيسية" active={section==="dashboard"} onPress={()=>selectSection("dashboard")}/>
    <Menu icon="◉" label="الحضور والشفتات" active={section==="attendance"} onPress={()=>selectSection("attendance")}/>
    <Menu icon="👥" label="الموظفين" active={section==="employees"} onPress={()=>selectSection("employees")}/>
    <Menu icon="▤" label="المبيعات" active={section==="daily"} onPress={()=>selectSection("daily")}/>
    <Menu icon="▥" label="التقارير" active={section==="monthly"} onPress={()=>selectSection("monthly")}/>
    <Menu icon="📱" label="الأجهزة" active={section==="devices"} onPress={()=>selectSection("devices")}/>
    <Menu icon="✓" label={`الاعتمادات ${summary.pending?`(${summary.pending})`:""}`} active={section==="approvals"} onPress={()=>selectSection("approvals")}/>
    <Menu icon="🔔" label="الإشعارات" active={false} onPress={()=>router.push("/notifications")}/>
   </View>

   <View style={st.dateBox}><View style={st.dateRow}><Pressable style={st.dateArrow} onPress={()=>shiftDate(-1)}><Text style={st.dateArrowText}>‹</Text></Pressable><Pressable style={st.todayButton} onPress={()=>chooseDate(businessDate())}><Text style={st.todayText}>اليوم</Text></Pressable><Pressable style={st.dateArrow} onPress={()=>shiftDate(1)}><Text style={st.dateArrowText}>›</Text></Pressable></View><View style={st.dateEntry}><Pressable style={st.applyBtn} onPress={()=>chooseDate(dateInput)}><Text style={st.applyText}>عرض</Text></Pressable><TextInput value={dateInput} onChangeText={setDateInput} placeholder="2026-09-11" placeholderTextColor="#66778C" keyboardType="numbers-and-punctuation" style={st.dateInput} textAlign="center"/></View></View>

   {section==="dashboard"&&<>
    <Text style={st.sectionTitle}>ملخص اليوم</Text>
    <View style={st.stats}>
     <Stat icon="◎" label="نقاط اليوم" value={String(summary.points)} sub={`${summary.units} شريحة`}/>
     <Stat icon="👥" label="الحضور" value={`${summary.open+summary.ended}/${employees.length}`} sub={`غائب ${summary.absent} • لم يبدأ ${summary.notStarted}`}/>
     <Stat icon="▥" label="إجمالي الشرائح" value={String(summary.units)} sub={`35:${summary.p35}  58:${summary.p58}  75:${summary.p75}  104:${summary.p104}`}/>
     <Stat icon="✓" label="معلق للاعتماد" value={String(summary.pending)} sub="مبيعات تحتاج مراجعة"/>
    </View>
    <View style={st.panel}><View style={st.panelHead}><Text style={st.panelTitle}>أفضل 5 موظفين هذا الشهر</Text><Text style={st.panelLink}>حسب النقاط</Text></View>{top.map((e,i)=><View key={e.id} style={st.rankRow}><View style={st.rankBadge}><Text style={st.rankNo}>{i+1}</Text></View><Text style={st.rankPoints}>{fmt(mm.get(e.id)?.total_points)} نقطة</Text><Text numberOfLines={1} style={st.rankName}>{e.full_name}</Text></View>)}</View>
    <View style={st.quickGrid}><Quick label="الحضور والشفتات" icon="📍" onPress={()=>selectSection("attendance")}/><Quick label="الاعتمادات المعلقة" icon="✓" onPress={()=>selectSection("approvals")}/><Quick label="التحديثات" icon="⬆" onPress={()=>router.push("/update")}/><Quick label="الإشعارات" icon="🔔" onPress={()=>router.push("/notifications")}/></View>
   </>}

   <Text style={st.sectionTitle}>{section==="dashboard"?"متابعة الموظفين":title}</Text>
   <TextInput value={search} onChangeText={setSearch} placeholder="ابحث عن موظف أو موقع…" placeholderTextColor="#66778C" style={st.search} textAlign="right"/>
   {(section==="employees"||section==="dashboard"||section==="attendance")&&<View style={st.filters}><Filter label="الكل" active={filter==="all"} onPress={()=>setFilter("all")}/><Filter label="مفتوح" active={filter==="open"} onPress={()=>setFilter("open")}/><Filter label="منتهي" active={filter==="ended"} onPress={()=>setFilter("ended")}/><Filter label="غائب" active={filter==="absent"} onPress={()=>setFilter("absent")}/><Filter label="لم يبدأ" active={filter==="not_started"} onPress={()=>setFilter("not_started")}/></View>}
   {section==="approvals"&&visible.length===0&&<View style={st.empty}><Text style={st.emptyText}>لا توجد اعتمادات معلقة ✓</Text></View>}

   {visible.map(e=>{const d=dm.get(e.id),m=mm.get(e.id),s=sm.get(e.id),dev=devm.get(e.id),sh=shm.get(e.id),status=d?.shift_status??sh?.status??"not_started",target=Number(m?.eligible_target_points??0),total=Number(m?.total_points??0),pct=target>0?total/target*100:0;return <View key={e.id} style={st.card}>
    <View style={st.cardHead}><Pill status={status}/><View style={{flex:1}}><Text style={st.name}>{e.full_name}</Text><Text style={st.user}>@{e.username}</Text></View></View>
    <View style={st.locationStrip}><Text style={st.locationText}>📍 {d?.assigned_location??"لا يوجد موقع مسجل"}</Text></View>

    {(section==="dashboard"||section==="attendance"||section==="employees")&&<View style={st.gpsWrap}>
     <View style={st.gpsCard}><View style={st.gpsTitleRow}><Text style={st.gpsIcon}>▶</Text><Text style={st.gpsTitle}>بداية الشفت</Text></View><Text style={st.gpsValue}>{timeLabel(sh?.started_at)}</Text><Text style={st.gpsMeta}>GPS: {coord(sh?.start_latitude)}, {coord(sh?.start_longitude)}</Text><Text style={st.gpsMeta}>عن الموقع المعتمد: {meters(sh?.start_distance_m)} • دقة {meters(sh?.start_accuracy_m)}</Text><TouchableOpacity style={[st.mapBtn,sh?.start_latitude==null&&st.disabled]} disabled={sh?.start_latitude==null} onPress={()=>openMap(sh?.start_latitude,sh?.start_longitude)}><Text style={st.mapBtnText}>فتح موقع الحضور على الخريطة</Text></TouchableOpacity></View>
     <View style={st.gpsCard}><View style={st.gpsTitleRow}><Text style={st.gpsIcon}>■</Text><Text style={st.gpsTitle}>نهاية الشفت</Text></View><Text style={st.gpsValue}>{timeLabel(sh?.ended_at)}</Text><Text style={st.gpsMeta}>GPS: {coord(sh?.end_latitude)}, {coord(sh?.end_longitude)}</Text><Text style={st.gpsMeta}>من نقطة البداية: {meters(sh?.end_from_start_distance_m)} • دقة {meters(sh?.end_accuracy_m)}</Text><TouchableOpacity style={[st.mapBtn,sh?.end_latitude==null&&st.disabled]} disabled={sh?.end_latitude==null} onPress={()=>openMap(sh?.end_latitude,sh?.end_longitude)}><Text style={st.mapBtnText}>فتح موقع نهاية الشفت على الخريطة</Text></TouchableOpacity></View>
    </View>}

    {(section==="dashboard"||section==="employees"||section==="daily"||section==="approvals")&&<><View style={st.grid}><Mini label="الشرائح" value={String(d?.total_units??0)}/><Mini label="النقاط" value={String(d?.total_points??0)}/><Mini label="المبيعات" value={salesLabel(s?.status??d?.sales_status)}/></View><Text style={st.packages}>35: {d?.package_35??0}   •   58: {d?.package_58??0}   •   75: {d?.package_75??0}   •   104: {d?.package_104??0}</Text></>}
    {(section==="dashboard"||section==="monthly")&&<View style={st.grid}><Mini label="نقاط الشهر" value={fmt(m?.total_points)}/><Mini label="أيام الدوام" value={String(m?.attended_days??0)}/><Mini label="التحقيق" value={`${pct.toFixed(1)}%`}/></View>}
    {(section==="dashboard"||section==="devices")&&<View style={st.device}><Text style={st.deviceTitle}>📱 {dev?.device_label||"لا يوجد جهاز مربوط"}</Text>{dev&&<Text style={st.deviceMeta}>{dev.platform||"غير محدد"} • {dev.active?"نشط":"غير نشط"}{dev.migration_pending?" • تغيير جهاز معلّق":""}</Text>}</View>}
    {sh?.absence_reason&&<Text style={st.absenceReason}>سبب الغياب: {sh.absence_reason}</Text>}
    {canEdit&&isToday&&status==="not_started"&&(section==="dashboard"||section==="employees"||section==="attendance")&&<TouchableOpacity disabled={busyId===e.id} style={st.absent} onPress={()=>markAbsent(e)}><Text style={st.absentText}>تسجيل غياب الموظف</Text></TouchableOpacity>}
    {canEdit&&s?.status==="submitted"&&(section==="dashboard"||section==="approvals")&&<View style={st.actions}><TouchableOpacity style={st.reject} onPress={()=>review(s,"rejected")}><Text style={st.rejectText}>رفض وإعادة الإدخال</Text></TouchableOpacity><TouchableOpacity style={st.approve} onPress={()=>review(s,"approved")}><Text style={st.approveText}>اعتماد المبيعات</Text></TouchableOpacity></View>}
   </View>})}

   <TouchableOpacity style={st.logoutBtn} onPress={async()=>{await logout();router.replace("/")}}><Text style={st.logoutText}>تسجيل الخروج</Text></TouchableOpacity>
   <Text style={st.footer}>Target & Sales • إدارة أسهل وقرار أسرع</Text>
  </ScrollView>
 </SafeAreaView>
}

function Menu({icon,label,active,onPress}:{icon:string;label:string;active:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress} style={({pressed})=>[st.menuItem,active&&st.menuActive,pressed&&{opacity:.65}]}><Text style={st.menuIcon}>{icon}</Text><Text numberOfLines={1} style={st.menuLabel}>{label}</Text></Pressable>}
function Stat({icon,label,value,sub}:{icon:string;label:string;value:string;sub:string}){return <View style={st.stat}><Text style={st.statIcon}>{icon}</Text><Text style={st.statLabel}>{label}</Text><Text style={st.statValue}>{value}</Text><Text style={st.statSub}>{sub}</Text></View>}
function Mini({label,value}:{label:string;value:string}){return <View style={st.mini}><Text style={st.miniLabel}>{label}</Text><Text style={st.miniValue}>{value}</Text></View>}
function Filter({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable onPress={onPress} style={[st.filter,active&&st.filterActive]}><Text style={[st.filterText,active&&st.filterTextActive]}>{label}</Text></Pressable>}
function Quick({label,icon,onPress}:{label:string;icon:string;onPress:()=>void}){return <Pressable onPress={onPress} style={({pressed})=>[st.quick,pressed&&{opacity:.65}]}><Text style={st.quickIcon}>{icon}</Text><Text style={st.quickText}>{label}</Text></Pressable>}
function Pill({status}:{status:string}){const ended=status==="ended",absent=status==="absent",open=status==="open";return <View style={[st.pill,ended||open?st.pillGreen:absent?st.pillRed:st.pillYellow]}><Text style={[st.pillText,ended||open?st.pillTextGreen:absent?st.pillTextRed:st.pillTextYellow]}>{open?"الشفت مفتوح":ended?"تم إنهاء الشفت":absent?"غائب":"لم يبدأ"}</Text></View>}

const st=StyleSheet.create({
 page:{flex:1,backgroundColor:"#07131F"},center:{alignItems:"center",justifyContent:"center"},muted:{color:"#8EA0B5",marginTop:10},scroll:{flex:1},content:{padding:14,paddingBottom:60},
 topBar:{paddingHorizontal:16,paddingTop:10,paddingBottom:10,flexDirection:"row-reverse",alignItems:"center",borderBottomWidth:1,borderBottomColor:"#163047",backgroundColor:"#091827"},brand:{color:"#F5FAFF",fontSize:20,fontWeight:"900",textAlign:"right"},brandSub:{color:"#7F96AC",fontSize:11,fontWeight:"700",marginTop:2,textAlign:"right"},adminBubble:{width:42,height:42,borderRadius:21,backgroundColor:"#3A9BFF",alignItems:"center",justifyContent:"center",marginLeft:10},adminInitial:{color:"#fff",fontSize:19,fontWeight:"900"},
 hero:{backgroundColor:"#0D2031",borderWidth:1,borderColor:"#1C3A51",borderRadius:20,padding:16,marginBottom:12,flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between"},heroSmall:{color:"#7F96AC",textAlign:"right",fontWeight:"700"},heroTitle:{color:"#fff",textAlign:"right",fontSize:24,fontWeight:"900",marginTop:3},heroDate:{color:"#32D6A0",textAlign:"right",fontWeight:"900",marginTop:6},heroIcon:{fontSize:42,color:"#3A9BFF"},
 menuGrid:{flexDirection:"row-reverse",flexWrap:"wrap",gap:8,marginBottom:12},menuItem:{width:"48.7%",minHeight:52,backgroundColor:"#0D2031",borderWidth:1,borderColor:"#17364E",borderRadius:14,paddingHorizontal:12,paddingVertical:10,flexDirection:"row-reverse",alignItems:"center",gap:8},menuActive:{backgroundColor:"#164D88",borderColor:"#3A9BFF"},menuIcon:{fontSize:17,color:"#A8C8EA"},menuLabel:{flex:1,color:"#DCEBFA",textAlign:"right",fontWeight:"900",fontSize:12},
 dateBox:{backgroundColor:"#0D2031",borderWidth:1,borderColor:"#17364E",borderRadius:16,padding:12,marginBottom:14},dateRow:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10},dateArrow:{width:42,height:36,borderRadius:10,backgroundColor:"#132C41",alignItems:"center",justifyContent:"center"},dateArrowText:{color:"#fff",fontSize:25,fontWeight:"900"},todayButton:{backgroundColor:"#3A9BFF",borderRadius:10,paddingHorizontal:28,paddingVertical:9},todayText:{color:"#fff",fontWeight:"900"},dateEntry:{flexDirection:"row",gap:8,marginTop:10},dateInput:{flex:1,backgroundColor:"#091827",borderWidth:1,borderColor:"#1C3A51",borderRadius:10,padding:9,color:"#fff"},applyBtn:{backgroundColor:"#19B883",borderRadius:10,paddingHorizontal:22,justifyContent:"center"},applyText:{color:"#fff",fontWeight:"900"},
 sectionTitle:{textAlign:"right",fontSize:19,fontWeight:"900",color:"#F5FAFF",marginBottom:10,marginTop:5},stats:{flexDirection:"row-reverse",flexWrap:"wrap",gap:10,marginBottom:14},stat:{width:"48.5%",backgroundColor:"#0D2031",borderWidth:1,borderColor:"#17364E",borderRadius:17,padding:14,minHeight:135},statIcon:{fontSize:21,color:"#32D6A0",textAlign:"right"},statLabel:{textAlign:"right",color:"#9CB0C3",fontWeight:"800",marginTop:7},statValue:{textAlign:"right",fontSize:30,fontWeight:"900",color:"#fff",marginVertical:4},statSub:{textAlign:"right",color:"#6EDFB9",fontSize:11,fontWeight:"700"},
 panel:{backgroundColor:"#0D2031",borderWidth:1,borderColor:"#17364E",borderRadius:17,padding:14,marginBottom:14},panelHead:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",marginBottom:8},panelTitle:{color:"#fff",fontWeight:"900",fontSize:16},panelLink:{color:"#3A9BFF",fontWeight:"800",fontSize:11},rankRow:{flexDirection:"row",alignItems:"center",paddingVertical:8,borderTopWidth:1,borderTopColor:"#132C41",gap:8},rankBadge:{width:26,height:26,borderRadius:13,backgroundColor:"#17364E",alignItems:"center",justifyContent:"center"},rankNo:{color:"#A8C8EA",fontWeight:"900"},rankPoints:{color:"#32D6A0",fontWeight:"900",fontSize:12},rankName:{flex:1,textAlign:"right",color:"#E8F1FA",fontWeight:"800"},
 quickGrid:{flexDirection:"row-reverse",flexWrap:"wrap",gap:8,marginBottom:14},quick:{width:"48.7%",backgroundColor:"#0D2031",borderWidth:1,borderColor:"#17364E",borderRadius:14,padding:13,alignItems:"center",justifyContent:"center"},quickIcon:{fontSize:21,marginBottom:5},quickText:{color:"#DCEBFA",fontWeight:"900",textAlign:"center",fontSize:12},
 search:{backgroundColor:"#0D2031",color:"#fff",borderWidth:1,borderColor:"#17364E",borderRadius:14,padding:12,marginBottom:10},filters:{flexDirection:"row-reverse",flexWrap:"wrap",gap:7,marginBottom:12},filter:{paddingHorizontal:13,paddingVertical:8,borderRadius:12,backgroundColor:"#0D2031",borderWidth:1,borderColor:"#17364E"},filterActive:{backgroundColor:"#164D88",borderColor:"#3A9BFF"},filterText:{color:"#8EA0B5",fontWeight:"900",fontSize:12},filterTextActive:{color:"#fff"},
 card:{backgroundColor:"#0D2031",borderWidth:1,borderColor:"#17364E",borderRadius:18,padding:14,marginBottom:12},cardHead:{flexDirection:"row",gap:10,alignItems:"center"},name:{textAlign:"right",fontSize:16,fontWeight:"900",color:"#F5FAFF"},user:{textAlign:"right",color:"#6F859A",fontSize:11,marginTop:2},locationStrip:{backgroundColor:"#091827",borderRadius:11,padding:10,marginTop:10},locationText:{textAlign:"right",color:"#A9BDD0",fontWeight:"800",fontSize:12},
 gpsWrap:{gap:8,marginTop:10},gpsCard:{backgroundColor:"#091827",borderWidth:1,borderColor:"#17364E",borderRadius:13,padding:11},gpsTitleRow:{flexDirection:"row-reverse",alignItems:"center",gap:7},gpsIcon:{color:"#32D6A0",fontWeight:"900"},gpsTitle:{color:"#DCEBFA",fontWeight:"900",fontSize:13},gpsValue:{color:"#fff",textAlign:"right",fontSize:18,fontWeight:"900",marginTop:5},gpsMeta:{color:"#7F96AC",textAlign:"right",fontSize:10,marginTop:3},mapBtn:{backgroundColor:"#164D88",borderWidth:1,borderColor:"#3A9BFF",borderRadius:10,padding:9,marginTop:9},mapBtnText:{color:"#DDEEFF",fontWeight:"900",textAlign:"center",fontSize:11},disabled:{opacity:.35},
 grid:{flexDirection:"row-reverse",gap:7,marginTop:10},mini:{flex:1,backgroundColor:"#091827",borderRadius:11,padding:9,borderWidth:1,borderColor:"#132C41"},miniLabel:{textAlign:"center",color:"#7F96AC",fontSize:10,fontWeight:"700"},miniValue:{textAlign:"center",fontWeight:"900",color:"#fff",marginTop:4,fontSize:14},packages:{textAlign:"center",color:"#9CB0C3",fontWeight:"800",marginTop:9,fontSize:11},
 device:{backgroundColor:"#091827",borderRadius:11,padding:10,marginTop:10},deviceTitle:{textAlign:"right",color:"#DCEBFA",fontWeight:"900"},deviceMeta:{textAlign:"right",color:"#71879B",fontSize:10,marginTop:4},absenceReason:{textAlign:"right",color:"#FFBFC3",backgroundColor:"#33171C",borderRadius:9,padding:8,marginTop:9},
 pill:{borderRadius:99,paddingHorizontal:10,paddingVertical:6},pillGreen:{backgroundColor:"#113A31"},pillRed:{backgroundColor:"#3A191E"},pillYellow:{backgroundColor:"#3A3014"},pillText:{fontWeight:"900",fontSize:10},pillTextGreen:{color:"#62E1B6"},pillTextRed:{color:"#FF8E98"},pillTextYellow:{color:"#FFD76A"},
 absent:{marginTop:10,borderWidth:1,borderColor:"#8C4148",borderRadius:11,padding:10,backgroundColor:"#27151A"},absentText:{textAlign:"center",color:"#FF9CA5",fontWeight:"900"},actions:{flexDirection:"row",gap:8,marginTop:10},approve:{flex:1,backgroundColor:"#19B883",borderRadius:11,padding:11},approveText:{textAlign:"center",color:"#fff",fontWeight:"900",fontSize:11},reject:{flex:1,borderWidth:1,borderColor:"#8C4148",backgroundColor:"#27151A",borderRadius:11,padding:11},rejectText:{textAlign:"center",color:"#FF9CA5",fontWeight:"900",fontSize:11},
 empty:{backgroundColor:"#0D2031",padding:25,borderRadius:17,marginBottom:15,borderWidth:1,borderColor:"#17364E"},emptyText:{textAlign:"center",color:"#62E1B6",fontWeight:"900"},logoutBtn:{marginTop:8,borderWidth:1,borderColor:"#8C4148",backgroundColor:"#27151A",borderRadius:12,padding:12},logoutText:{textAlign:"center",color:"#FF9CA5",fontWeight:"900"},footer:{textAlign:"center",color:"#51677C",fontSize:10,marginTop:16}
});