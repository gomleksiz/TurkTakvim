import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Pillar { animal: string; element: string; }
interface MilestoneEntry {
  age: number;
  type: string;                 // "mucel" | "buyuk" | "zit"
  title: string;
  critYear: number; animal: string; element: string;
  interaction: string; isPast: boolean; isPresent: boolean;
}
interface CrossIx {
  labelA: string; labelB: string;
  animalA: string; animalB: string;
  weight?: number;              // Öz Kimlik × Öz Kimlik 3, Vitrin × Vitrin 2, İç Dünya × İç Dünya 2, diğerleri 1
  type: string; label: string; icon: string;
}
interface ElementPair { value: number; text: string; }
interface PhasePeriod {
  startYear: number; endYear: number; phase: string;
  p1StartAge: number; p2StartAge: number;
}
interface PartnerData {
  name?: string;
  gender?: "female" | "male";   // eski sürüm gönderir; müçel mantığı kullanmaz
  birthDate: string;
  birthYear: number;
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  currentAge: number;
  milestones: MilestoneEntry[];
}
interface RequestBody {
  partner1: PartnerData;
  partner2: PartnerData;
  crossInteractions: CrossIx[];
  compatScore: number;          // 0–100
  elementHarmony?: { year: ElementPair; day: ElementPair };
  phaseSyncPeriods: PhasePeriod[];
  currentYear: number;
}

const responseSchema = {
  type: "OBJECT",
  required: ["dogumUyumu", "zamanAkisi", "zirveDonemleri", "onemliAnlar"],
  properties: {
    dogumUyumu:      { type: "STRING" },
    zamanAkisi:      { type: "STRING" },
    zirveDonemleri:  { type: "STRING" },
    onemliAnlar: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["yil", "tip", "baslik", "aciklama"],
        properties: {
          yil:      { type: "INTEGER" },
          tip:      { type: "STRING" },   // "uyum" | "dikkat" | "donusum"
          baslik:   { type: "STRING" },
          aciklama: { type: "STRING" },
        },
      },
    },
  },
};

const ixLabel: Record<string, string> = {
  trine:   "Üçlü Uyum",
  secret:  "Gizli Dostluk",
  clash:   "Zıtlık / Gerilim",
  neutral: "Nötr",
  same:    "Aynı Hayvan",
};

// Puan 0–100 (hepsi nötr ≈ 50). Sayfadaki scoreInfo() ile aynı eşikler.
function scoreLabel(score: number): string {
  if (score >= 75) return "Nadir Ruh İkizi";
  if (score >= 65) return "Güçlü Uyum";
  if (score >= 55) return "Dengeli Ortaklık";
  if (score >= 45) return "Emek İsteyen Uyum";
  return "Dönüştürücü Gerilim";
}

const typeLabel: Record<string, string> = {
  mucel: "müçel yılı",
  buyuk: "büyük müçel",
  zit:   "zıt yıl",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY yapılandırılmamış");

    const body: RequestBody = await req.json();
    const { partner1: p1, partner2: p2, crossInteractions, compatScore, elementHarmony, phaseSyncPeriods, currentYear } = body;

    const n1 = p1.name || "Birinci Kişi";
    const n2 = p2.name || "İkinci Kişi";
    const ageDiff = Math.abs(p1.birthYear - p2.birthYear);
    const older = p1.birthYear < p2.birthYear ? n1 : n2;

    const ixSummary = crossInteractions
      .map(ix => `  • ${ix.labelA} (${ix.animalA}) × ${ix.labelB} (${ix.animalB}): ${ixLabel[ix.type] ?? ix.type} ${ix.type === 'clash' ? '⚡' : ix.type === 'trine' ? '✨' : ix.type === 'secret' ? '🤝' : ''}${ix.weight && ix.weight > 1 ? ` (ağırlık ×${ix.weight})` : ''}`)
      .join('\n');

    const syncSummary = phaseSyncPeriods.length
      ? phaseSyncPeriods.map(p => `  • ${p.startYear}–${p.endYear}: ${p.phase} dönemi (${n1} ${p.p1StartAge} yaş, ${n2} ${p.p2StartAge} yaş)`).join('\n')
      : '  (örtüşen müçel dönemi bulunamadı)';

    const sharedMilestoneYears = new Set([
      ...p1.milestones.map(m => m.critYear),
      ...p2.milestones.map(m => m.critYear),
    ]);
    const bothInSameYear = [...sharedMilestoneYears].filter(y =>
      p1.milestones.some(m => m.critYear === y) &&
      p2.milestones.some(m => m.critYear === y)
    );

    const sharedYearDesc = bothInSameYear.length
      ? bothInSameYear.map(y => {
          const m1 = p1.milestones.find(m => m.critYear === y)!;
          const m2 = p2.milestones.find(m => m.critYear === y)!;
          return `  • ${y}: ${n1} ${m1.age} yaşında ${typeLabel[m1.type] ?? m1.title} · ${n2} ${m2.age} yaşında ${typeLabel[m2.type] ?? m2.title}`;
        }).join('\n')
      : '  (aynı yılda müçel ya da zıt yıl yok)';

    const genderTR = (g?: string) => g === 'female' ? 'Kadın, ' : g === 'male' ? 'Erkek, ' : '';

    const prompt = `Sen 12 Hayvanlı Türk Takvimi ve müçel geleneği konusunda uzman, iki kişinin uyumunu yorumlayan bilge bir danışmansın.
Yorumların Türkçe, sıcak, içgörülü ve yapıcı olsun. Kısa ve net cümleler kur. Her alan 3-5 cümle. Spesifik yıl adları (örn "2031'de") kullan.

━━ MÜÇEL SİSTEMİ ━━
- Doğum hayvanı her 12 yılda bir döner: müçel yılı (12, 24, 36… yaş). Bir 12 yıllık dönem kapanır, yenisi açılır. 60 yaş büyük müçeldir.
- Müçelin ortasında (6, 18, 30… yaş) karşıt hayvanın yılı gelir: zıt yıl.
- 12 yıllık dönemler: 0–11 Çocukluk, 12–23 Gençlik, 24–35 Kuruluş, 36–47 Olgunlaşma, 48–59 Deneyim, 60–71 İkinci bahar, 72–83 Bilgelik, 84+ Aksakallık.

━━ KİŞİLER ━━
• ${n1} (${genderTR(p1.gender)}${p1.currentAge} yaş, Doğum: ${p1.birthYear})
  Vitrin: ${p1.yearPillar.element} ${p1.yearPillar.animal} · İç Dünya: ${p1.monthPillar.element} ${p1.monthPillar.animal} · Öz Kimlik: ${p1.dayPillar.element} ${p1.dayPillar.animal}
• ${n2} (${genderTR(p2.gender)}${p2.currentAge} yaş, Doğum: ${p2.birthYear})
  Vitrin: ${p2.yearPillar.element} ${p2.yearPillar.animal} · İç Dünya: ${p2.monthPillar.element} ${p2.monthPillar.animal} · Öz Kimlik: ${p2.dayPillar.element} ${p2.dayPillar.animal}
• Yaş farkı: ${ageDiff} yıl (büyük olan: ${older})

━━ DOĞUM HARİTASI ÇAPRAZ ETKİLEŞİMLERİ (9 Kombinasyon) ━━
${ixSummary}
${elementHarmony ? `• Vitrin elementleri: ${elementHarmony.year.text}\n• Öz Kimlik elementleri: ${elementHarmony.day.text}\n` : ''}• Genel Uyum Puanı: ${compatScore}/100 → ${scoreLabel(compatScore)} (Öz Kimlik × Öz Kimlik en çok sayılır)

━━ AYNI MÜÇEL DÖNEMİNDE OLDUKLARI YILLAR ━━
${syncSummary}

━━ AYNI YILDA MÜÇEL YA DA ZIT YIL ━━
${sharedYearDesc}

━━ YORUM KURALLARI ━━
1. dogumUyumu: Üç sütun çapraz etkileşimlerini yorumla. Özellikle trine/gizli dostluk/clash olan kombinasyonları vurgula.
   Çiftlerin en güçlü ortak enerjisini ve en büyük gerilim noktasını belirt.
2. zamanAkisi: Yaş farkının getirdiği faz kaymalarını açıkla. Hangisi hayatın hangi evresinde birbirinden ne kadar ileride?
   Aynı müçel döneminde oldukları yılları vurgula — "İkisi birden Kuruluş dönemindeyken" gibi ifadeler kullan.
3. zirveDonemleri: Yakın gelecekte (${currentYear}–${currentYear + 15}) her iki partnerin müçel ya da zıt yıllarının çakıştığı ya da birbirini desteklediği yılları tespit et.
   Aynı yılda ikisinin de müçel ya da zıt yılı varsa özellikle belirt. Üçlü uyum yıllarını vurgula.
4. onemliAnlar: Gelecekteki önemli yılları sırala (maks 8 madde, kronolojik). Her madde için:
   - yil: takvim yılı (${currentYear} veya sonrası)
   - tip: "uyum" (her iki kişi için destekleyici etkileşim) | "dikkat" (zıt yıl ya da her iki tarafın da zor eşiği) | "donusum" (müçel yılı, büyük müçel ya da aynı anda iki dönüm)
   - baslik: 2-4 kelime, şiirsel
   - aciklama: 2-3 cümle. Her iki kişinin o yıldaki durumunu belirt. Clash varsa dikkat uyarısı ver; trine/gizli dostluk varsa potansiyeli vurgula.

━━ YASAK ━━
• "Boşanacaklar" / "Ayrılacaklar" / "Ölüm" kesinlikle yazma. Yerine "zorlayıcı dönem", "ilişkide sınav" de.
• Geçmiş olaylar için kesin varsayımda bulunma; "yaşamış olabilirsiniz" tonu kullan.
• Yıllar kesin tahmin değil, "olasılık ve hazırlık" çerçevesinde sun.`;

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
    if (!parts?.length) throw new Error(`Gemini yanıtı beklenmeyen formatta`);

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
