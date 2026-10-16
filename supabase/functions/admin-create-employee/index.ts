import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const randomPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let value = "";
  crypto.getRandomValues(new Uint32Array(12)).forEach((n) => value += chars[n % chars.length]);
  return value;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ ok: false, message: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const publishable = publishableKeys.default ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !publishable) return out({ ok: false, message: "server_config" }, 500);

    const authorization = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return out({ ok: false, message: "unauthorized" }, 401);

    const admin = createClient(url, keys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: me, error: profileError } = await admin
      .from("profiles").select("role").eq("auth_user_id", user.id).maybeSingle();
    if (profileError || me?.role !== "system_admin") return out({ ok: false, message: "not_allowed" }, 403);

    const body = await req.json();
    const fullName = String(body?.full_name ?? "").trim();
    if (fullName.length < 2) return out({ ok: false, message: "invalid_name" }, 400);

    // The canonical RPC atomically creates credentials and assigns the active evening region.
    const username = `emp_${crypto.randomUUID().slice(0, 8)}_${String(Math.floor(100000 + Math.random() * 900000))}`;
    const password = randomPassword();
    const { data: id, error: createError } = await caller.rpc("admin_create_employee", {
      p_full_name: fullName,
      p_username: username,
      p_password: password,
    });
    if (createError || !id) {
      console.error("admin-create-employee: canonical RPC failed");
      return out({ ok: false, message: "create_failed" }, 500);
    }
    return out({ ok: true, id, username, password });
  } catch {
    console.error("admin-create-employee: request failed");
    return out({ ok: false, message: "create_failed" }, 500);
  }
});
