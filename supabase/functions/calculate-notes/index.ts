import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Pillar { animal: string; element: string; }
interface MilestoneEntry {
  age: number; title: string; type: string;
  critYear: number; animal: string; element: string; interaction: string;
  isPast: boolean; isPresent: boolean;
}
interface RequestBody {
  name?: string;
  gender: "female" | "male";
  birthDate: string;
  birthYear: number;
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  interactions: { yearMonth: string; yearDay: string; monthDay: string };
  currentAge: number;
  over60: boolean;
  allMilestones: MilestoneEntry[];
  currentMilestone?: MilestoneEntry;
  nextMilestone?: MilestoneEntry;
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

const ixLabel: Record<string, string> = {
  trine:   "Üçlü Uyum (güç ve akış)",
  secret:  "Gizli Dostluk (sessiz destek)",
  clash:   "Zıtlık/Gerilim (dikkat, dönüşüm baskısı)",
  neutral: "Nötr",
  same:    "Aynı enerji (yoğunlaşma)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY yapılandırılmamış");

    const body: RequestBody = await req.json();
    const {
      name, gender, birthDate, birthYear,
      yearPillar, monthPillar, dayPillar,
      interactions, currentAge, over60,
      allMilestones = [],
    } = body;

    const genderTR   = gender === "female" ? "Kadın" : "Erkek";
    const cycleYears = gender === "female" ? "7" : "8";

    const pastMilestones    = allMilestones.filter(m => m.isPast);
    const presentMilestone  = allMilestones.find(m => m.isPresent);
    const futureMilestones  = allMilestones.filter(m => !m.isPast && !m.isPresent);

    const formatMilestone = (m: MilestoneEntry) =>
      `  • ${m.critYear} yılı (${m.age} yaş) — ${m.element} ${m.animal} · ${m.title} · Doğum hayvanıyla: ${ixLabel[m.interaction] ?? m.interaction}${m.interaction === 'clash' ? ' ⚠️' : ''}`;

    const prompt = `Sen 12 Hayvanlı Türk Takvimi (BaZi) astrolojisinde uzman, derin tarihsel bilgiye sahip bir yorumcusun.
Yorumların Türkçe, sıcak, içgörülü ve mistik ama gerçekçi olsun. Her alan 4-5 cümle olsun.

━━ KİŞİ BİLGİLERİ ━━
- ${name ? `İsim: ${name}` : "İsimsiz"}
- Cinsiyet: ${genderTR} (${cycleYears} yıllık biyolojik döngü)
- Yaş: ${currentAge} · Doğum Yılı: ${birthYear}
- Yıl Sütunu (Sosyal Vitrin): ${yearPillar.element} ${yearPillar.animal}
- Ay Sütunu (Duygusal Temel): ${monthPillar.element} ${monthPillar.animal}
- Gün Sütunu (Öz Kimlik): ${dayPillar.element} ${dayPillar.animal}
- Sütun etkileşimleri: Yıl×Ay ${ixLabel[interactions.yearMonth]}, Yıl×Gün ${ixLabel[interactions.yearDay]}, Ay×Gün ${ixLabel[interactions.monthDay]}

━━ GEÇMİŞ KRİTİK DÖNEMLER ━━
${pastMilestones.length ? pastMilestones.map(formatMilestone).join('\n') : '  (yok)'}

━━ MEVCUT DÖNEM ━━
${presentMilestone ? formatMilestone(presentMilestone) : '  (kritik eşikte değil)'}

━━ GELECEK KRİTİK DÖNEMLER ━━
${futureMilestones.length ? futureMilestones.map(formatMilestone).join('\n') : '  (yok)'}
${over60 ? '\n- Bu kişi 60 yıllık büyük kozmik döngüyü tamamlamıştır.' : ''}

━━ YORUM KURALLARI ━━
1. dogumHaritasi: Üç sütunun yarattığı kişilik enerjisini açıkla. Yıl hayvanının element uyumunu ve genel yaşam temalarını belirt.
2. mevcutDonem: Mevcut dönemi ve yakın geçmişteki 1-2 kritik yılı ele al. O yıllarda dünyada veya Türkiye'de yaşanan önemli olayları (krizler, dönüşümler, fırsatlar) o yılın hayvanı ile doğum hayvanının uyumu çerçevesinde yorumla. Kötü etkileşim (clash) varsa "dikkat" uyarısı ver.
3. gelecekDonem: Önümüzdeki 2-3 kritik yılı spesifik yıllarıyla belirt (örn: "2031 yılında Metal Köpek enerjisiyle..."). Clash yıllarında açıkça uyar: "Bu yıl dikkat gerektiren bir dönemdir". Üçlü uyum veya gizli dostluk varsa güçlü destek dönemlerini vurgula.
4. buyukKutlama: ${over60 ? '60 yıllık kozmik döngüyü tamamlamanın derin anlamını ve nadir bilgelik evresini kutla.' : 'Bu kişi henüz 60 yıllık döngüyü tamamlamadı, bu alanı boş bırak.'}`;

    const res = await fetch(
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

    if (!res.ok) throw new Error(`Gemini API hatası: ${await res.text()}`);

    const gemini = await res.json();
    const parts = gemini.candidates?.[0]?.content?.parts;
    if (!parts?.length) throw new Error(`Gemini yanıtı beklenmeyen formatta: ${JSON.stringify(gemini)}`);

    const outputPart = parts.find((p: { thought?: boolean; text?: string }) => !p.thought && p.text) ?? parts[parts.length - 1];
    const parsed = JSON.parse(outputPart.text);

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
