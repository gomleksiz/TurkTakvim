import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase yapılandırması eksik");

    const body = await req.json();
    const { birth_date, dh, md, nd, oa } = body;

    if (!birth_date) throw new Error("birth_date zorunlu");

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data, error } = await supabase
      .from("fake_future")
      .upsert({ birth_date, dh: dh || null, md: md || null, nd: nd || null, oa: oa || null }, { onConflict: "birth_date" })
      .select("id, birth_date")
      .single();

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true, id: data.id, birth_date: data.birth_date }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
