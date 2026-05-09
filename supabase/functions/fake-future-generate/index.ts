import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseSchema = {
  type: "OBJECT",
  required: ["dh", "md", "nd", "oa"],
  properties: {
    dh: { type: "STRING" },
    md: { type: "STRING" },
    nd: { type: "STRING" },
    oa: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["y", "t", "b", "ac", "a"],
        properties: {
          y:  { type: "INTEGER" },
          t:  { type: "STRING" },
          b:  { type: "STRING" },
          ac: { type: "STRING" },
          a:  { type: "INTEGER" },
        },
      },
    },
  },
};

interface Pillar { animal: string; element: string; }
interface RequestBody {
  birth_date: string;
  gender: "female" | "male";
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  genel_yorum?: string;
  onemli_anlar_text?: string;
}

function generateCode(): string {
  // URL-safe, unambiguous chars (no 0/O, 1/I/L)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY yapılandırılmamış");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase yapılandırması eksik");

    const body: RequestBody = await req.json();
    const { birth_date, gender, yearPillar, monthPillar, dayPillar, genel_yorum, onemli_anlar_text } = body;

    if (!birth_date) throw new Error("birth_date zorunlu");

    const birthYear   = parseInt(birth_date.split("-")[0]);
    const currentYear = new Date().getFullYear();
    const genderTR    = gender === "female" ? "Kadın" : "Erkek";

    const prompt = `Sen 12 Hayvanlı Türk Takvimi astrolojisinde uzman, eğlence amaçlı kişiselleştirilmiş yorumlar yazan bir asistansın.
Görevin: verilen kişi bilgilerini ve yazarın notlarını kullanarak gerçekçi, ikna edici bir astroloji profili oluşturmak.
Dil: Türkçe. Ton: mistik, içgörülü, kişisel ve spesifik.

━━ KİŞİ BİLGİLERİ ━━
Doğum Tarihi: ${birth_date} · Cinsiyet: ${genderTR}
Vitrin (Yıl Sütunu): ${yearPillar.element} ${yearPillar.animal}
İç Dünya (Ay Sütunu): ${monthPillar.element} ${monthPillar.animal}
Öz Kimlik (Gün Sütunu): ${dayPillar.element} ${dayPillar.animal}
Doğum Yılı: ${birthYear} · Mevcut Yıl: ${currentYear}

━━ GENEL YORUM İPUÇLARI ━━
Aşağıdaki özellikleri astrolojik dile dönüştür (birebir tekrarlama, sembolik ve şiirsel bir dille ifade et):
${genel_yorum?.trim() || "(özel not yok — sütunlara dayanarak özgün bir karakter yorumu yaz)"}

━━ ÖNEMLİ ANLAR İPUÇLARI ━━
Aşağıdaki olayları astrolojik dile dönüştür:
${onemli_anlar_text?.trim() || "(özel not yok — sütun etkileşimlerine göre anlamlı dönemler oluştur)"}

━━ ÇIKTI KURALLARI ━━
1. dh (Doğum Haritası): 4-5 cümle. Üç sütunu ve karakteri yorumla. Genel yorum ipuçlarını astrolojik metafora dönüştür.
2. md (Mevcut Dönem): 3-4 cümle. ${currentYear} civarındaki dönemi yorumla.
3. nd (Sonraki Dönem): 3-4 cümle. Yakın geleceği yorumla.
4. oa (Önemli Anlar): ${currentYear - 2} ile ${currentYear + 10} arası, 5-7 önemli an.
   Her an için:
   • y: takvim yılı (tam sayı)
   • t: "o" (olumlu / fırsat) veya "u" (uyarı / dikkat gerektiren dönem)
   • b: 2-4 kelimeli şiirsel başlık
   • ac: 2-3 cümle; kişisel ve spesifik
   • a: o yıldaki yaş (${birthYear} doğumlu baz al)
   Önemli anlar ipuçlarındaki olayları astrolojik dile dönüştür. Geçmiş ve gelecek anlar birlikte olabilir.

━━ YASAK ━━
• İpuçlarını birebir kopyalama; astrolojik metafora dönüştür
• "Tembel", "beceriksiz" gibi doğrudan hakaret içeren sözcükler kullanma; sembolik dil kullan
• "Boşanma", "ayrılık", "ölüm" yazma
• 8'den fazla önemli an üretme
• Geçmiş yıllara atıfta "2018'de doğan çocuğunuz", "evlendiğiniz yıl" gibi varsayımsal olay isimlendirmeleri kullanma.
  Bunun yerine açık uçlu ifadeler kullan: "2018'de hayatınızda gerçekleşen köklü değişim", "o dönemde yaşanan dönüşüm", "o yılın getirdiği kırılma noktası" gibi.
  Eğer geçmiş bir yıla bağlı başka bir önemli an varsa "o değişimin meyveleri", "o dönemde atılan adımın yankısı" gibi referans ver.
  Geçmiş yıllar için daima "yaşamış olabilirsiniz", "hissettiyseniz", "o dönemde bir değişim olduysa" tonunu koru.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            thinkingConfig: { thinkingBudget: -1 },
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      }
    );

    if (!geminiRes.ok) throw new Error(`Gemini API hatası: ${await geminiRes.text()}`);

    const gemini = await geminiRes.json();
    const parts  = gemini.candidates?.[0]?.content?.parts;
    if (!parts?.length) throw new Error("Gemini yanıtı beklenmeyen formatta");

    const outputPart = parts.find((p: { thought?: boolean; text?: string }) => !p.thought && p.text) ?? parts[parts.length - 1];
    const generated  = JSON.parse(outputPart.text);

    if (Array.isArray(generated.oa)) {
      generated.oa = generated.oa.map((item: Record<string, unknown>) => ({
        ...item,
        t: String(item.t).startsWith("o") ? "o" : "u",
      }));
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Preserve existing code if the row already exists
    const { data: existing } = await supabase
      .from("fake_future")
      .select("code")
      .eq("birth_date", birth_date)
      .maybeSingle();

    const code = existing?.code ?? generateCode();

    const { error: dbErr } = await supabase
      .from("fake_future")
      .upsert(
        { birth_date, code, dh: generated.dh, md: generated.md, nd: generated.nd, oa: generated.oa },
        { onConflict: "birth_date" }
      );

    if (dbErr) throw new Error(`DB hatası: ${dbErr.message}`);

    return new Response(JSON.stringify({ success: true, code, data: generated }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
