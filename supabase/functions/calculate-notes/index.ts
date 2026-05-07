import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

interface RequestBody {
  name: string;
  birthdate: string;
  otherInfo?: string;
}

function calculateAge(birthdate: string): number {
  const today = new Date();
  const birthDate = new Date(birthdate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getZodiacSign(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 22)) return "Scorpio";
  if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((
    (month === 1 && day >= 20) || (month === 2 && day <= 18)
  )) return "Aquarius";
  return "Pisces";
}

serve(async (req) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    const { name, birthdate, otherInfo } = await req.json() as RequestBody;

    if (!name || !birthdate) {
      return new Response(
        JSON.stringify({ error: "name and birthdate are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const birthDateObj = new Date(birthdate);
    const age = calculateAge(birthdate);
    const zodiac = getZodiacSign(birthDateObj);

    const prompt = `
      You are a professional astrologer and life coach. 
      Based on the following information, write a personalized and insightful 'final note' for the person.
      
      Name: ${name}
      Age: ${age}
      Zodiac Sign: ${zodiac}
      Additional Information: ${otherInfo || "None provided"}
      
      The note should be warm, encouraging, and slightly mystical, but also grounded in practical advice.
    `;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    
    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${JSON.stringify(geminiData)}`);
    }

    const finalNote = geminiData.candidates[0].content.parts[0].text;

    return new Response(
      JSON.stringify({
        name,
        age,
        zodiac,
        finalNote,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
