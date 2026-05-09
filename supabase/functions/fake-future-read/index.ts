import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase yapılandırması eksik");

    const url         = new URL(req.url);
    let birth_date    = url.searchParams.get("birth_date");

    if (!birth_date && req.method === "POST") {
      const body = await req.json();
      birth_date = body.birth_date;
    }

    if (!birth_date) throw new Error("birth_date zorunlu");

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
      .from("fake_future")
      .select("dh, md, nd, oa")
      .eq("birth_date", birth_date)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true, data: data || null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
