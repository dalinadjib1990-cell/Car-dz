import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let keys: string[] = [];
    const keysString =
      process.env.GEMINI_API_KEYS ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEYS ||
      process.env.VITE_GEMINI_API_KEY ||
      "";
    if (keysString) {
      keys = keys.concat(keysString.split(",").map((k) => k.trim()).filter((k) => k.length > 0));
    }

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("GEMINI_API_KEY_") && typeof value === "string") {
        keys.push(value.trim());
      }
    }

    keys = [...new Set(keys)].filter((k) => k.length > 0);
    if (keys.length === 0) {
      return res.status(500).json({ error: "لم يتم العثور على مفاتيح API." });
    }

    let lastError: any = null;
    const { adDetails, marketData, focusBrand, searchQuery, totalPlatformAds } = req.body;

    const marketItems = Array.isArray(marketData) ? marketData : [];
    const activeItems = marketItems.filter((m: any) => m?.status !== "sold");
    const numericPrices = activeItems
      .map((m: any) => Number(m?.price))
      .filter((p: number) => !isNaN(p) && p > 50000);

    const sortedPrices = [...numericPrices].sort((a, b) => a - b);
    const computedAvg =
      sortedPrices.length > 0
        ? Math.round(sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length)
        : 0;
    const computedMedian =
      sortedPrices.length > 0 ? sortedPrices[Math.floor(sortedPrices.length / 2)] : 0;
    const computedMin = sortedPrices.length > 0 ? sortedPrices[0] : 0;
    const computedMax = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : 0;

    const wilayaBuckets: Record<string, number[]> = {};
    activeItems.forEach((m: any) => {
      const p = Number(m?.price);
      if (m?.wilaya && !isNaN(p) && p > 50000) {
        if (!wilayaBuckets[m.wilaya]) wilayaBuckets[m.wilaya] = [];
        wilayaBuckets[m.wilaya].push(p);
      }
    });
    const wilayaStats = Object.entries(wilayaBuckets)
      .map(([wilaya, prices]) => ({
        wilaya,
        count: prices.length,
        avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const matchingCount = activeItems.length;
    const platformWeightPercent =
      matchingCount === 0 ? 0 : Math.min(85, Math.max(15, Math.round((matchingCount / 25) * 85)));

    const subjectLabel = adDetails?.title
      ? `${adDetails.brand || ""} ${adDetails.model || ""} ${adDetails.year || ""} (${adDetails.title})`.trim()
      : [focusBrand, searchQuery].filter(Boolean).join(" ").trim() ||
        "سوق السيارات المستعملة في الجزائر (رينو، هيونداي، فولكسفاغن، داسيا، بيجو)";

    const systemInstruction = `أنت محلل اقتصادي جزائري دقيق ومتخصص في سوق السيارات بالجزائر (Market Auto DZ).
مهمتك تقديم تحليل سوقي دقيق ومفهوم جداً للشخص العادي يجمع بين:
- المعطيات الواقعية الحقيقية من المنصات والأسواق الجزائرية (Ouedkniss واد كنيس، Facebook Marketplace DZ، أسواق تيجلابين وعين أرنات سطيف)
- والمعطيات الفعلية المسجلة في منشورات هذه المنصة (وزن بيانات المنصة الحالية: ${platformWeightPercent}% بناءً على ${matchingCount} منشور نشط).`;

    const targetDesc = adDetails?.title
      ? `معلومات الإعلان الحالي:
العنوان: ${adDetails.title}
الماركة والموديل: ${adDetails.brand || ""} ${adDetails.model || ""}
السعر المطلوب: ${adDetails.price ? adDetails.price + " دج" : "غير متوفر"}
الولاية: ${adDetails.wilaya || "غير متوفر"}
سنة الصنع: ${adDetails.year || "غير متوفر"}
المسافة: ${adDetails.mileage ? adDetails.mileage + " كم" : "غير متوفر"}
المحرك والطاقة: ${adDetails.engine || ""} ${adDetails.fuelType || ""}`
      : `الموضوع المطلوب تحليله في السوق الجزائري: ${subjectLabel}`;

    const statsSummary =
      numericPrices.length > 0
        ? `إحصائيات حقيقية من إعلانات المنصة (${numericPrices.length} منشور مطابق): المتوسط ${computedAvg} دج، الوسيط ${computedMedian} دج، الأدنى ${computedMin} دج، الأعلى ${computedMax} دج. إحصائيات الولايات: ${JSON.stringify(wilayaStats)}`
        : `لا توجد إعلانات مطابقة كافية بعد في المنصة (0 منشور مطابق لهذا التحديد)، اعتمد على الأسعار الحقيقية في المنصات والأسواق الجزائرية الآن.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        dailyMarket: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              avgPrice: { type: Type.NUMBER },
              fairPrice: { type: Type.NUMBER },
              demandScore: { type: Type.NUMBER },
              note: { type: Type.STRING },
            },
            required: ["label", "avgPrice", "fairPrice", "demandScore", "note"],
          },
        },
        dailySummary: { type: Type.STRING },
        weeklyMarket: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              marketPrice: { type: Type.NUMBER },
              fairPrice: { type: Type.NUMBER },
              activityScore: { type: Type.NUMBER },
              note: { type: Type.STRING },
            },
            required: ["label", "marketPrice", "fairPrice", "activityScore", "note"],
          },
        },
        weeklySummary: { type: Type.STRING },
        monthlyForecast: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              actualPrice: { type: Type.NUMBER },
              forecastPrice: { type: Type.NUMBER },
              optimisticPrice: { type: Type.NUMBER },
              pessimisticPrice: { type: Type.NUMBER },
              isForecast: { type: Type.BOOLEAN },
              trendColor: { type: Type.STRING },
              simpleReason: { type: Type.STRING },
            },
            required: ["label", "isForecast", "trendColor", "simpleReason"],
          },
        },
        monthlySummary: { type: Type.STRING },
        simpleCitizenGuide: {
          type: Type.OBJECT,
          properties: {
            verdictTitle: { type: Type.STRING },
            simpleMeaning: { type: Type.STRING },
            buyerAdvice: { type: Type.STRING },
            sellerAdvice: { type: Type.STRING },
            expectedChangeText: { type: Type.STRING },
          },
          required: ["verdictTitle", "simpleMeaning", "buyerAdvice", "sellerAdvice", "expectedChangeText"],
        },
        marketStatus: { type: Type.STRING },
        fairPrice: { type: Type.NUMBER },
        fairPriceMin: { type: Type.NUMBER },
        fairPriceMax: { type: Type.NUMBER },
        nationalAvgPrice: { type: Type.NUMBER },
        fairPriceDefinition: { type: Type.STRING },
        supplyDemand: { type: Type.STRING },
        avgSellingTime: { type: Type.STRING },
        similarListings: { type: Type.NUMBER },
        regionalComparison: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              region: { type: Type.STRING },
              price: { type: Type.NUMBER },
              diffText: { type: Type.STRING },
            },
            required: ["region", "price", "diffText"],
          },
        },
        recommendation: { type: Type.STRING },
        bestTimeToBuy: { type: Type.STRING },
        explanation: { type: Type.STRING },
        priceFactors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              factor: { type: Type.STRING },
              impact: { type: Type.STRING },
              value: { type: Type.STRING },
            },
            required: ["factor", "impact", "value"],
          },
        },
      },
      required: [
        "dailyMarket", "dailySummary", "weeklyMarket", "weeklySummary",
        "monthlyForecast", "monthlySummary", "simpleCitizenGuide",
        "marketStatus", "fairPrice", "fairPriceMin", "fairPriceMax",
        "nationalAvgPrice", "fairPriceDefinition", "supplyDemand",
        "avgSellingTime", "similarListings", "regionalComparison",
        "recommendation", "bestTimeToBuy", "explanation", "priceFactors",
      ],
    };

    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
    const maxTries = Math.min(shuffledKeys.length, 3);
    const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
    let isRateLimited = false;

    let groundedBrief = "";
    let sources: { title: string; uri: string }[] = [];
    try {
      const groundAi = new GoogleGenAI({
        apiKey: shuffledKeys[0],
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const searchRes = await groundAi.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `ابحث في مواقع السيارات الجزائرية الحقيقية (Ouedkniss واد كنيس، Autobip، أسعار سوق السيارات في الجزائر 2025-2026) عن متوسط الأسعار الفعلية المعروضة حالياً لـ: ${subjectLabel}. أعطِ ملخصاً مختصراً بالأرقام بالدينار الجزائري والمليون سنتيم.`,
        config: { tools: [{ googleSearch: {} }] },
      });
      groundedBrief = (searchRes.text || "").trim();
      const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        const seenUris = new Set<string>();
        sources = chunks
          .map((c: any) => c?.web)
          .filter((w: any) => w?.uri && w?.title && !seenUris.has(w.uri) && seenUris.add(w.uri))
          .slice(0, 5)
          .map((w: any) => ({ title: String(w.title), uri: String(w.uri) }));
      }
    } catch {
      // Silently proceed using platform data & Algerian market knowledge if grounding quota is limited
    }

    for (let i = 0; i < maxTries; i++) {
      for (const modelName of modelsToTry) {
        try {
          const ai = new GoogleGenAI({
            apiKey: shuffledKeys[i],
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          });

          const textContent = `${targetDesc}
${statsSummary}
${groundedBrief ? `نتائج البحث الحقيقي من المنصات الجزائرية الآن:\n${groundedBrief}\n` : ""}
عينة من المنشورات الفعلية على المنصة:
${JSON.stringify(activeItems.slice(0, 15).map((m: any) => ({ title: m.title, brand: m.brand, model: m.model, year: m.year, price: m.price, wilaya: m.wilaya, mileage: m.mileage })))}`;

          const response = await ai.models.generateContent({
            model: modelName,
            contents: textContent,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema,
              ...(modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            },
          });

          const responseText = (response.text || "").trim();
          if (!responseText) throw new Error("Empty response");
          const parsed = JSON.parse(responseText);

          return res.status(200).json({
            ...parsed,
            sources,
            platformTelemetry: {
              totalPlatformAds: Number(totalPlatformAds) || marketItems.length,
              matchingPlatformAds: matchingCount,
              platformAvgPrice: computedAvg,
              platformMinPrice: computedMin,
              platformMaxPrice: computedMax,
              platformWeightPercent,
              externalWeightPercent: 100 - platformWeightPercent,
            },
          });
        } catch (error: any) {
          lastError = error;
          if (error?.message?.includes("429") || error?.message?.includes("Quota exceeded") || error?.status === "RESOURCE_EXHAUSTED") {
            isRateLimited = true;
          }
        }
      }
    }

    if (isRateLimited) {
      return res.status(429).json({ error: "عذراً، تم تجاوز الحد المسموح به للطلبات المجانية في الوقت الحالي." });
    }
    return res.status(500).json({ error: lastError?.message || "حدث خطأ أثناء تحليل السوق." });
  } catch (error: any) {
    console.error("Final Error from Gemini:", error);
    return res.status(500).json({ error: "حدث خطأ أثناء تحليل السوق." });
  }
}

