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
4. buyukKutlama: ${over60 ? '60 yıllık kozmik döngüyü tamamlamanın derin anlamını ve nadir bilgelik evresini kutla.' : 'Bu kişi henüz 60 yıllık döngüyü tamamlamadı, bu alanı boş bırak.'}
5. onemliAnlar: Tüm dönemlerden (geçmiş + gelecek) sadece TRINE, SECRET ve CLASH etkileşimli olanları seç. Maksimum 10 madde, KRONOLOJİK SIRA ile (eski yıldan yeni yıla). Her madde için:
   - yil, yas: tablodakinin aynısı
   - hayvan, element: o kritik yılın hayvanı ve elementi
   - tip: "olumlu" (TRINE/SECRET) veya "uyari" (CLASH)
   - baslik: 2-4 kelime, ŞİİRSEL ve İÇGÖRÜLÜ (düz "Kariyer Atılımı" yerine "Yıldızının Parladığı Yıl", "Köprüden Geçiş", "Sabır Dönemi", "Yeniden Doğuş", "Kalbinin Sınavı", "Bereket Yılı", "İçsel Yolculuk" gibi)
   - aciklama: 2-3 cümle. Şu yapıda yaz:
     • Yıl geçmişse: "Yaşamış olabilirsiniz", "Hatırlarsanız o dönemde", "Belki o yıllarda…" tonu (sertçe varsayma)
     • Yıl gelecekse: "Bu yıl … için elverişli olabilir" / "Bu dönemde dikkatli olmak faydalıdır" tonu (kesin tahmin değil, hazırlık)
     • Mutlaka o yılın hayvanı ile doğum hayvanının ilişkisine değin (örn: "At, doğum hayvanınız Köpek ile aksiyon-liderlik üçlüsünde yer alır")
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
        gender,
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
