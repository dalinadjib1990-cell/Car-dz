import { GoogleGenAI, Type } from "@google/genai";

export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let keys: string[] = [];
    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEYS || process.env.VITE_GEMINI_API_KEY || "";
    if (keysString) {
      keys = keys.concat(keysString.split(',').map(k => k.trim()).filter(k => k.length > 0));
    }
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('GEMINI_API_KEY_') && typeof value === 'string') {
        keys.push(value.trim());
      }
    }
    keys = [...new Set(keys)].filter(k => k.length > 0);
    if (keys.length === 0) {
      return res.status(500).json({ error: "لم يتم العثور على مفاتيح API." });
    }

    const { userQuery, ads } = req.body;
    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({ error: "يرجى كتابة طلب البحث أولاً." });
    }

    const compactAds = (Array.isArray(ads) ? ads : []).slice(0, 60).map((a: any) => ({
      id: a.id,
      title: a.title,
      brand: a.brand,
      model: a.model,
      year: a.year,
      price: a.price,
      mileage: a.mileage || 0,
      engine: a.engine || '',
      gearbox: a.gearbox || '',
      fuelType: a.fuelType || '',
      wilaya: a.wilaya || '',
      condition: a.condition || '',
      engineRating: a.engineRating || 10,
      bodyRating: a.bodyRating || 10,
      oilConsumption: a.oilConsumption || 'none',
      overheats: Boolean(a.overheats),
      repairsCount: Array.isArray(a.repairs) ? a.repairs.length : 0,
      status: a.status || 'active',
      isNegotiable: Boolean(a.isNegotiable),
    }));

    const systemInstruction = `أنت المساعد الذكي للبحث وفلترة السيارات في منصة Market Auto DZ الجزائرية.
استخرج الفلاتر تلقائياً (1 مليون سنتيم = 10000 دج)، وابحث وسط الإعلانات الحقيقية لاقتراح أفضل الخيارات المرتبطة بالطلب مع توضيح السبب بالدارجة/العربية.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        extractedFilters: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            wilaya: { type: Type.STRING },
            fuelType: { type: Type.STRING },
            engine: { type: Type.STRING },
            minPrice: { type: Type.NUMBER },
            maxPrice: { type: Type.NUMBER },
            maxMileage: { type: Type.NUMBER },
            minYear: { type: Type.NUMBER },
            maxYear: { type: Type.NUMBER },
            searchText: { type: Type.STRING },
          },
        },
        bestMatches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              adId: { type: Type.STRING },
              matchScore: { type: Type.NUMBER },
              badgeLabel: { type: Type.STRING },
              reason: { type: Type.STRING },
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["adId", "matchScore", "badgeLabel", "reason", "pros", "warnings"],
          },
        },
        assistantSummary: { type: Type.STRING },
        suggestedRefinements: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["extractedFilters", "bestMatches", "assistantSummary", "suggestedRefinements"],
    };

    const textContent = `طلب المستخدم:\n"${userQuery}"\n\nقائمة الإعلانات:\n${JSON.stringify(compactAds)}`;
    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
    const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];

    for (let i = 0; i < Math.min(shuffledKeys.length, 3); i++) {
      for (const modelName of modelsToTry) {
        try {
          const ai = new GoogleGenAI({
            apiKey: shuffledKeys[i],
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });
          const response = await ai.models.generateContent({
            model: modelName,
            contents: textContent,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema,
              ...(modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: "LOW" as any } } : {}),
            },
          });
          return res.status(200).json(JSON.parse((response.text || "{}").trim()));
        } catch {
          // Try next model/key seamlessly
        }
      }
    }

    return res.status(429).json({ error: "عذراً، تم تجاوز الحد المسموح به للطلبات المجانية في الوقت الحالي." });
  } catch {
    return res.status(500).json({ error: "حدث خطأ أثناء البحث الذكي." });
  }
}
