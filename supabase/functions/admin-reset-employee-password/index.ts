import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return out({ok:false,message:"method_not_allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!;
  const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}");
  const secret=keys.default??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishable=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")??"{}").default??Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!secret||!publishable)return out({ok:false,message:"server_config"},500);
  const auth=req.headers.get("Authorization")??"";
  const caller=createClient(url,publishable,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const {data:{user},error:userError}=await caller.auth.getUser();
  if(userError||!user)return out({ok:false,message:"unauthorized"},401);
  const {data:me}=await admin.from("profiles").select("role").eq("auth_user_id",user.id).maybeSingle();
  if(me?.role!=="system_admin")return out({ok:false,message:"not_allowed"},403);
  const body=await req.json();
  const employeeId=String(body?.employee_id??"");
  const password=String(body?.password??"");
  if(!/^[0-9]{6}$/.test(password))return out({ok:false,message:"password_must_be_6_digits"},400);
  const {data:p,error:pe}=await admin.from("profiles").select("id,role,active,auth_user_id").eq("id",employeeId).eq("role","employee").maybeSingle();
  if(pe||!p)return out({ok:false,message:"employee_not_found"},404);
  const email=`u-${p.id}@target-sales.local`;
  let uid=p.auth_user_id;
  if(uid){
   const {error}=await admin.auth.admin.updateUserById(uid,{password});
   if(error)throw error;
  }else{
   const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{profile_id:p.id,role:p.role}});
   if(error||!created.user)throw error??new Error("create_user_failed");
   uid=created.user.id;
   const {error:linkError}=await admin.from("profiles").update({auth_user_id:uid,updated_at:new Date().toISOString()}).eq("id",p.id);
   if(linkError)throw linkError;
  }
  return out({ok:true});
 }catch(e){console.error(e);return out({ok:false,message:"reset_failed"},500)}
});