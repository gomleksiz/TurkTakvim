import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Pillar { animal: string; element: string; }
interface Milestone {
  age: number; title: string; type: string;
  critYear: number; animal: string; element: string; interaction: string;
}
interface RequestBody {
  name?: string;
  gender: "female" | "male";
  birthDate: string;
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  interactions: { yearMonth: string; yearDay: string; monthDay: string };
  currentAge: number;
  over60: boolean;
  currentMilestone?: Milestone;
  nextMilestone?: Milestone;
}

const responseSchema = {
  type: "OBJECT",
  required: ["dogumHaritasi", "mevcutDonem", "gelecekDonem", "buyukKutlama"],
  properties: {
    dogumHaritasi: { type: "STRING" },
    mevcutDonem:   { type: "STRING" },
    gelecekDonem:  { type: "STRING" },
    buyukKutlama:  { type: "STRING" },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY yapılandırılmamış");

    const body: RequestBody = await req.json();
    const {
      name, gender, birthDate,
      yearPillar, monthPillar, dayPillar,
      interactions, currentAge, over60,
      currentMilestone, nextMilestone,
    } = body;

    const genderTR = gender === "female" ? "Kadın" : "Erkek";
    const cycleYears = gender === "female" ? "7" : "8";

    const ixLabel: Record<string, string> = {
      trine:   "Üçlü Uyum — güçlü akış ve destek",
      secret:  "Gizli Dostluk — sessiz koruma",
      clash:   "Zıtlık / Gerilim — dönüşüm baskısı",
      neutral: "Nötr",
      same:    "Aynı enerji — yoğunlaşma",
    };

    const prompt = `Sen 12 Hayvanlı Türk Takvimi (BaZi) astrolojisinde uzman bir yorumcusun. \
Kısa, sıcak, içgörülü ve Türkçe yorumlar yazıyorsun. \
Her alan 2-3 cümle olsun. Mistik ama gerçekçi bir ton kullan.

Kişi bilgileri:
- ${name ? `İsim: ${name}` : "İsimsiz"}
- Cinsiyet: ${genderTR} (${cycleYears} yıllık biyolojik döngü)
- Yaş: ${currentAge}
- Yıl Sütunu (Dış Hayvan / Sosyal Vitrin): ${yearPillar.element} ${yearPillar.animal}
- Ay Sütunu (İçsel Hayvan / Duygusal Temel): ${monthPillar.element} ${monthPillar.animal}
- Gün Sütunu (Gerçek Hayvan / Öz Kimlik): ${dayPillar.element} ${dayPillar.animal}
- Yıl×Ay etkileşimi: ${ixLabel[interactions.yearMonth] ?? interactions.yearMonth}
- Yıl×Gün etkileşimi: ${ixLabel[interactions.yearDay] ?? interactions.yearDay}
- Ay×Gün etkileşimi: ${ixLabel[interactions.monthDay] ?? interactions.monthDay}
${currentMilestone
  ? `- Mevcut kritik dönem: ${currentMilestone.age} yaş · ${currentMilestone.title} \
(${currentMilestone.element} ${currentMilestone.animal} yılı · \
${ixLabel[currentMilestone.interaction] ?? currentMilestone.interaction})`
  : ""}
${nextMilestone
  ? `- Bir sonraki kritik dönem: ${nextMilestone.age} yaş · ${nextMilestone.title} \
(${nextMilestone.element} ${nextMilestone.animal} yılı · \
${ixLabel[nextMilestone.interaction] ?? nextMilestone.interaction})`
  : ""}

Alanları şöyle doldur:
- dogumHaritasi: Üç sütunun birlikte yarattığı kişilik enerjisi.
- mevcutDonem: Şu anki dönemin teması ve kişisel mesaj.
- gelecekDonem: Bir sonraki döneme hazırlık önerisi.
- buyukKutlama: ${over60
  ? "60 yıllık kozmik döngüyü tamamlamanın anlam ve kutlaması."
  : "Bu kişi henüz 60 yıllık döngüyü tamamlamadı, bu alanı boş bırak."}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${GEMINI_API_KEY}`,
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

    if (!res.ok) throw new Error(`Gemini API hatası: ${await res.text()}`);

    const gemini = await res.json();
    const parsed = JSON.parse(gemini.candidates[0].content.parts[0].text);

    return new Response(JSON.stringify({ success: true, ...parsed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
