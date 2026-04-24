// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!cronSecret || token !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing env", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const before = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase.rpc("cleanup_expired_drafts", {
    p_before: before,
  });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, deleted: Number(data ?? 0), before }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
