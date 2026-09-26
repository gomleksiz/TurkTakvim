import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY  = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Pillar { animal: string; element: string; }
interface MilestoneEntry {
  age: number; title: string;
  type: string;                 // "mucel" | "buyuk" | "zit" | "uyum" | "dost"
  critYear: number; animal: string; element: string;
  interaction: string;          // yılın hayvanı × doğum yılı hayvanı
  isPast: boolean; isPresent: boolean;
  score?: number;               // −4 … +4: üç sütun + element
  tone?: string;                // "destek" | "denge" | "dikkat"
  elementRelation?: string;     // "besler" | "ayni" | "verir" | "yonetir" | "sinirlar"
}
interface MucelInfo {
  number: number; chapter: string;
  startYear: number; endYear: number; nextMucelYear: number;
}
interface RequestBody {
  name?: string;
  gender?: "female" | "male";   // eski sürüm gönderir; müçel mantığı kullanmaz
  birthDate: string;
  birthYear: number;
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  interactions: { yearMonth: string; yearDay: string; monthDay: string };
  currentAge: number;
  over60: boolean;
  mucel?: MucelInfo;
  thisYear?: MilestoneEntry;
  allMilestones: MilestoneEntry[];
  currentMilestone?: MilestoneEntry;
  nextMilestone?: MilestoneEntry;
}

const responseSchema = {
  type: "OBJECT",
  required: ["dogumHaritasi", "mevcutDonem", "gelecekDonem", "buyukKutlama", "onemliAnlar"],
  properties: {
    dogumHaritasi: { type: "STRING" },
    mevcutDonem:   { type: "STRING" },
    gelecekDonem:  { type: "STRING" },
    buyukKutlama:  { type: "STRING" },
    onemliAnlar: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["yil", "yas", "tip", "baslik", "aciklama", "hayvan", "element"],
        properties: {
          yil:      { type: "INTEGER" },
          yas:      { type: "INTEGER" },
          tip:      { type: "STRING" },   // "olumlu" | "uyari"
          baslik:   { type: "STRING" },
          aciklama: { type: "STRING" },
          hayvan:   { type: "STRING" },
          element:  { type: "STRING" },
        },
      },
    },
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
      mucel, thisYear,
      allMilestones = [],
    } = body;

    const typeLabel: Record<string, string> = {
      mucel: "Müçel yılı (doğum hayvanı döner)",
      buyuk: "Büyük müçel (hayvan ve element birlikte döner)",
      zit:   "Zıt yıl (karşıt hayvanın yılı)",
      uyum:  "Uyum yılı (üçlü uyum hayvanı)",
      dost:  "Dost yılı (gizli dost)",
      notr:  "Nötr yıl (özel ilişki yok)",
    };
    const toneLabel: Record<string, string> = {
      destek: "Destek yılı", denge: "Dengeli yıl", dikkat: "Dikkat yılı",
    };
    const elemLabel: Record<string, string> = {
      besler:   "yılın elementi kişiyi besler",
      ayni:     "aynı element",
      verir:    "kişi yılın elementini besler (emek ister)",
      yonetir:  "kişi yılın elementini sınırlar (çabayla kazanç)",
      sinirlar: "yılın elementi kişiyi sınırlar (baskı)",
    };

    const pastMilestones   = allMilestones.filter(m => m.isPast);
    const futureMilestones = allMilestones.filter(m => !m.isPast);

    const formatMilestone = (m: MilestoneEntry) => {
      let line = `  • ${m.critYear} yılı (${m.age} yaş) — ${m.element} ${m.animal} · ${typeLabel[m.type] ?? m.title} · Doğum hayvanıyla: ${ixLabel[m.interaction] ?? m.interaction}`;
      if (m.elementRelation) line += ` · Element: ${elemLabel[m.elementRelation] ?? m.elementRelation}`;
      if (m.tone) line += ` · Genel ton: ${toneLabel[m.tone] ?? m.tone} (puan ${m.score})`;
      return line;
    };

    const prompt = `Sen 12 Hayvanlı Türk Takvimi ve müçel geleneği konusunda uzman, derin tarihsel bilgiye sahip bir yorumcusun.
Yorumların Türkçe, sıcak, içgörülü ve mistik ama gerçekçi olsun. Kısa ve net cümleler kur. Her alan 4-5 cümle olsun.

━━ MÜÇEL SİSTEMİ ━━
- Doğum hayvanı her 12 yılda bir döner: müçel yılı (12, 24, 36… yaş; geleneksel sayımla 13, 25, 37…). Bir dönem kapanır, yenisi açılır. Gelenekte bu yıl dikkatle ve paylaşarak karşılanır.
- 60 yaş büyük müçeldir: hayvan ve element birlikte döner, ikinci doğum sayılır.
- Müçelin ortasında (6, 18, 30… yaş) karşıt hayvanın yılı gelir: zıt yıl. Gerilim ve değişim getirebilir.
- Üçlü uyum hayvanlarının yılları destek, gizli dostun yılı sessiz destek getirir.
- Her yılın genel tonu iki şeyden gelir: yılın hayvanının üç doğum hayvanıyla (yıl, ay, gün) ilişkisi ve yılın elementinin kişinin elementiyle ilişkisi. Ton: Destek, Dengeli veya Dikkat.
- 12 yıllık dönemler: 0–11 Çocukluk, 12–23 Gençlik, 24–35 Kuruluş, 36–47 Olgunlaşma, 48–59 Deneyim, 60–71 İkinci bahar, 72–83 Bilgelik, 84+ Aksakallık.

━━ KİŞİ BİLGİLERİ ━━
- ${name ? `İsim: ${name}` : "İsimsiz"}${gender ? ` · Cinsiyet: ${gender === "female" ? "Kadın" : "Erkek"}` : ""}
- Yaş: ${currentAge} · Takvim doğum yılı: ${birthYear}
- Yıl Sütunu (Vitrin): ${yearPillar.element} ${yearPillar.animal} — kişinin elementi: ${yearPillar.element}
- Ay Sütunu (İç Dünya): ${monthPillar.element} ${monthPillar.animal}
- Gün Sütunu (Öz Kimlik): ${dayPillar.element} ${dayPillar.animal}
- Sütun etkileşimleri: Yıl×Ay ${ixLabel[interactions.yearMonth]}, Yıl×Gün ${ixLabel[interactions.yearDay]}, Ay×Gün ${ixLabel[interactions.monthDay]}
${mucel ? `- Şu an ${mucel.number}. müçel dönemi: ${mucel.chapter} (${mucel.startYear}–${mucel.endYear}). Sıradaki müçel yılı: ${mucel.nextMucelYear}.` : ""}
${thisYear ? `- Bu yıl:\n${formatMilestone(thisYear)}` : ""}

━━ GEÇMİŞ ÖNEMLİ YILLAR ━━
${pastMilestones.length ? pastMilestones.map(formatMilestone).join('\n') : '  (yok)'}

━━ GELECEK ÖNEMLİ YILLAR ━━
${futureMilestones.length ? futureMilestones.map(formatMilestone).join('\n') : '  (yok)'}
${over60 ? '\n- Bu kişi 60 yaşındaki büyük müçeli geçmiştir.' : ''}

━━ YORUM KURALLARI ━━
1. dogumHaritasi: Üç sütunun yarattığı kişilik enerjisini açıkla. Kişinin elementini ve içinde bulunduğu müçel dönemini belirt.
2. mevcutDonem: Bu yılı ve içinde bulunulan müçel dönemini yorumla. Bu yılın genel tonuna sadık kal: Dikkat yılında nazikçe uyar, Destek yılında fırsatları vurgula, Dengeli yılda sakin bir ton kullan. Yılın hayvanı ile doğum hayvanının ilişkisini ve element ilişkisini açıkla.
3. gelecekDonem: Sıradaki müçel yılını, sıradaki zıt yılı ve önümüzdeki 2-3 önemli yılı spesifik yıllarıyla belirt (örn: "2031 yılında Metal Domuz enerjisiyle..."). Zıt yıllarda açıkça uyar: "Bu yıl dikkat gerektiren bir dönemdir". Uyum ve dost yıllarında destekleyici dönemleri vurgula.
4. buyukKutlama: ${over60 ? '60 yaşındaki büyük müçelin (60 yıllık döngünün tamamlanmasının) derin anlamını ve nadir bilgelik evresini kutla.' : 'Bu kişi henüz 60 yaşındaki büyük müçele ulaşmadı, bu alanı boş bırak.'}
5. onemliAnlar: Tüm yıllardan (geçmiş + gelecek) seç. Maksimum 10 madde, KRONOLOJİK SIRA ile (eski yıldan yeni yıla). Geçmiş ve gelecekten dengeli seç.
   - tip: Uyum ve dost yıllarından genel tonu "Destek yılı" olanlar → "olumlu". Zıt yıllar ve genel tonu "Dikkat yılı" olanlar → "uyari". Müçel yılları genel tonuna göre.
   - yil, yas: tablodakinin aynısı
   - hayvan, element: o yılın hayvanı ve elementi
   - baslik: 2-4 kelime, ŞİİRSEL ve İÇGÖRÜLÜ (düz "Kariyer Atılımı" yerine "Yıldızının Parladığı Yıl", "Köprüden Geçiş", "Sabır Dönemi", "Yeniden Doğuş", "Kalbinin Sınavı", "Bereket Yılı", "İçsel Yolculuk" gibi)
   - aciklama: 2-3 cümle. Şu yapıda yaz:
     • Yıl geçmişse: "Yaşamış olabilirsiniz", "Hatırlarsanız o dönemde", "Belki o yıllarda…" tonu (sertçe varsayma)
     • Yıl gelecekse: "Bu yıl … için elverişli olabilir" / "Bu dönemde dikkatli olmak faydalıdır" tonu (kesin tahmin değil, hazırlık)
     • Mutlaka o yılın hayvanı ile doğum hayvanının ilişkisine değin (örn: "At, doğum hayvanınız Köpek ile aksiyon-liderlik üçlüsünde yer alır")
     • Müçel yılıysa yeni dönemin başladığını, zıt yılsa dönemin ortasındaki sınavı belirt.
     • Yaş grubuna uygun YAŞAM OLAYI öner (aşağıdaki rehbere göre)

   ━ YAŞAM EVRELERİNDE TİPİK OLAYLAR ━

   ÇOCUKLUK (0–12)
     Olumlu: ailede mutluluk dönemi, yetenek keşfi, sevgi dolu bir dönem, sağlıklı büyüme
     Uyari: ailede gerginlik, taşınma zorluğu, okul stresine maruz kalma

   ERGENLIK (13–17)
     Olumlu: kişiliğin parladığı yıl, yetenek keşfi, akademik başarı, önemli bir dostluk, ilk gönül bağı
     Uyari: aile-kimlik çatışması, akademik zorluk, içe kapanma dönemi

   GENÇ YETIŞKINLIK (18–24)
     Olumlu: üniversite/yurt dışı yolculuğu, ilk ciddi iş, bağımsızlığa adım, ciddi bir aşk, yeni şehir
     Uyari: kariyer belirsizliği, ilk büyük ayrılık, maddi sıkıntı, ailesinden uzaklaşmak

   KURULUŞ (25–35)
     Olumlu: kariyer atılımı, evlilik veya derin ortaklık, ilk çocuk, ev/araba alma, anlamlı bir terfi
     Uyari: ilişkide gerginlik veya ayrılık, iş kaybı, maddi zorluk, ailede sınanma

   OLGUNLAŞMA (36–49)
     Olumlu: kariyer zirvesi, aile genişlemesi (ikinci çocuk olabilir, ilk çocuk için sınırda), yeni girişim, önemli bir başarı
     Uyari: orta yaş içsel sorgulaması, iş değişikliği zorluğu, ilişkide sınav, ebeveyn sağlığı endişesi

   GEÇIŞ (50–64)
     Olumlu: kariyer olgunluğu, çocukların başarısı (mezuniyet/evlilik), ilk torun, anlamlı seyahat, yeni hobi
     Uyari: sağlık bilinci ön plana çıkar, çocukların evden ayrılışı, kariyer değişimi zorluğu, ebeveyn kaybı ihtimali

   HASAT (65–74)
     Olumlu: emeklilik özgürlüğü, torunlarla bağ, anlamlı yolculuklar, manevi olgunluk, hobiler
     Uyari: sağlığa özen, yakın çevrede kayıp acısı, fiziksel sınırlara saygı, yalnızlık duygusu

   BILGELIK (75+)
     Olumlu: aile bağlarının güçlenmesi, bilgelik paylaşımı, huzurlu anlar, manevi derinlik
     Uyari: sağlığa azami dikkat, dengeli ve sakin yaşam, kaybı kabullenme, bağımsızlık endişesi

   ━ KESİN YASAKLAR ━
   • 45+ yaşa "İLK çocuk" önerme (ikinci çocuk istisna). 50+ yaşa hiç "çocuk" önerme.
   • 65+ yaşa "yeni iş kur", "kariyere başla", "üniversite başla", "ilk evlilik" deme.
   • 70+ yaşa "gençlik enerjisi", "yoğun aktivite" gibi yaşa uymayan ifadeler kullanma.
   • HİÇBİR yaşa kesin "ÖLÜM" / "ciddi hastalık" / "boşanma garantisi" deme. Bunun yerine yumuşat:
     - "ailede zorlu bir dönem" / "ilişkilerde gerginlik" / "sağlığa dikkat etmenin önemi"
   • Geçmiş zorluklar için "yaşadınız" demek yerine "yaşamış olabilirsiniz" de — kişi yaşamamış olabilir.
   • Kötü olay GARANTISI verme; "X olacak" yerine "X için dikkatli olmak iyi olur" tonu.`;

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

    // Veritabanına kaydet (hata olursa sessizce geç, yanıtı engelleme)
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      await supabase.from("ai_requests").insert({
        name:           name || null,
        gender:         gender ?? null,
        birth_date:     birthDate,
        birth_year:     birthYear,
        current_age:    currentAge,
        over_60:        over60,
        year_animal:    yearPillar.animal,
        year_element:   yearPillar.element,
        month_animal:   monthPillar.animal,
        month_element:  monthPillar.element,
        day_animal:     dayPillar.animal,
        day_element:    dayPillar.element,
        dogum_haritasi: parsed.dogumHaritasi ?? null,
        mevcut_donem:   parsed.mevcutDonem   ?? null,
        gelecek_donem:  parsed.gelecekDonem  ?? null,
        buyuk_kutlama:  parsed.buyukKutlama  ?? null,
        onemli_anlar:   parsed.onemliAnlar   ?? null,
      });
    } catch (_dbErr) { /* DB hatası yanıtı engellemesin */ }

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
