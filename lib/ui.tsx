import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { C, R } from './theme';

export function ScreenTitle({eyebrow,title,right}:{eyebrow?:string,title:string,right?:ReactNode}){
  return <View style={s.titleRow}><View style={s.titleText}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.title}>{title}</Text></View>{right}</View>;
}
export function Pill({text,tone='neutral'}:{text:string,tone?:'neutral'|'success'|'warning'|'danger'|'info'}){
  const map:any={neutral:[C.bg,C.muted],success:[C.successSoft,C.success],warning:[C.warningSoft,C.warning],danger:[C.dangerSoft,C.danger],info:[C.infoSoft,C.info]};
  return <View style={[s.pill,{backgroundColor:map[tone][0]}]}><Text style={[s.pillText,{color:map[tone][1]}]}>{text}</Text></View>;
}
export function Metric({label,value,sub,style}:{label:string,value:string|number,sub?:string,style?:ViewStyle}){
  return <View style={[s.metric,style]}><Text style={s.metricLabel}>{label}</Text><Text numberOfLines={2} style={s.metricValue}>{value}</Text>{sub?<Text style={s.metricSub}>{sub}</Text>:null}</View>;
}
export function Button({title,onPress,disabled,variant='primary'}:{title:string,onPress:()=>void,disabled?:boolean,variant?:'primary'|'secondary'|'danger'|'ghost'}){
  const box:any={primary:s.primary,secondary:s.secondary,danger:s.danger,ghost:s.ghost};const txt:any={primary:s.primaryText,secondary:s.secondaryText,danger:s.primaryText,ghost:s.ghostText};
  return <TouchableOpacity activeOpacity={.8} disabled={disabled} onPress={onPress} style={[s.button,box[variant],disabled&&s.disabled]}><Text style={[s.buttonText,txt[variant]]}>{title}</Text></TouchableOpacity>;
}
export function Section({title,right,children}:{title:string,right?:ReactNode,children:ReactNode}){
  return <View style={s.section}><View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text>{right}</View>{children}</View>;
}
const s=StyleSheet.create({titleRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:14},titleText:{flex:1},eyebrow:{textAlign:'right',fontSize:12,fontWeight:'800',color:C.primary,marginBottom:4},title:{textAlign:'right',fontSize:24,fontWeight:'900',color:C.ink},pill:{alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:6,borderRadius:99},pillText:{fontSize:11,fontWeight:'900'},metric:{backgroundColor:C.card,borderRadius:R.lg,padding:16,borderWidth:1,borderColor:C.line,minHeight:96},metricLabel:{textAlign:'right',color:C.muted,fontSize:12,fontWeight:'700'},metricValue:{textAlign:'right',color:C.ink,fontSize:23,fontWeight:'900',marginTop:8},metricSub:{textAlign:'right',color:C.faint,fontSize:11,marginTop:5},button:{minHeight:52,borderRadius:R.md,alignItems:'center',justifyContent:'center',paddingHorizontal:16,paddingVertical:14},buttonText:{fontSize:15,fontWeight:'900'},primary:{backgroundColor:C.primary},secondary:{backgroundColor:C.card,borderWidth:1,borderColor:C.line},danger:{backgroundColor:C.danger},ghost:{backgroundColor:'transparent'},primaryText:{color:'#fff'},secondaryText:{color:C.ink},ghostText:{color:C.primary},disabled:{opacity:.42},section:{marginTop:24},sectionHead:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',marginBottom:12},sectionTitle:{textAlign:'right',fontSize:18,fontWeight:'900',color:C.ink}});
