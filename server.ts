import fs from 'fs';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Helper to get all available Gemini keys
  const getGeminiKeys = () => {
    let keys: string[] = [];
    
    // 1. Check comma-separated lists
    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEYS || process.env.VITE_GEMINI_API_KEY || "";
    if (keysString) {
      keys = keys.concat(keysString.split(',').map(k => k.trim()).filter(k => k.length > 0));
    }

    // 2. Check for individual variables like GEMINI_API_KEY_1, GEMINI_API_KEY_2
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('GEMINI_API_KEY_') && typeof value === 'string') {
        keys.push(value.trim());
      }
    }

    // Remove duplicates
    keys = [...new Set(keys)].filter(k => k.length > 0);
    
    if (keys.length === 0) {
      throw new Error("لم يتم العثور على مفاتيح API. يرجى التأكد من إضافة GEMINI_API_KEY_1, GEMINI_API_KEY_2 في Vercel.");
    }
    return keys;
  };

  function cleanAIReply(text: string): string {
    if (!text) return '';
    return text
      .replace(/style=["']color:\s*>\s*/gi, 'style="color: ')
      .replace(/color:\s*>\s*#/gi, 'color: #')
      .replace(/color:\s*>/gi, 'color:')
      .replace(/<span style="color:>\s*/gi, '<span style="color: ');
  }

  // API Route for AI Car Assessment
  app.post("/api/gemini/assess-car", async (req, res) => {
    try {
      const keys = getGeminiKeys();
      let lastError = null;
      const { adDetails, messages, role, userMessage } = req.body;
      
      const systemInstruction = `أنت خبير جزائري محترف في تقييم السيارات (Market Auto DZ). عليك أن تستمد معلوماتك عن السوق جزئيا من البيانات الخارجية وتكون على اطلاع دائم بالسوق والأسعار. وعند اكتمال تطوير المنصة ستستقي بياناتك المباشرة منها أيضاً. اسمك "الخبير الآلي". مهمتك هي مساعدة البائع والمشتري في الوصول إلى سعر عادل وتوضيح حالة السيارة.
      تحدث بالدارجة الجزائرية الواضحة والمهذبة.
      كن صريحاً جداً بشأن السعر وحالة السيارة.
      ملاحظة هامة جداً: في الجزائر، غالباً ما يختصر الناس الأصفار في الأسعار. فمثلاً إذا كتب شخص "77" فهو يقصد غالباً "77 مليون سنتيم" (770,000 دج)، وإذا كتب "120" فهو يقصد "120 مليون سنتيم". خذ هذا بعين الاعتبار في تحليلك للسعر.

      يرجى تنظيم إجابتك لتكون واضحة باستخدام تنسيق Markdown.
      هام جداً بشأن التلوين: استخدم وسوم HTML سليمة تماماً لتلوين النصوص والأشياء التي تذكرها (تأكد من إغلاق الوسوم وعدم إضافة أي رموز > زائدة داخل الخاصية style):
      - الأشياء الجيدة والممتازة لونها بالأخضر هكذا: <span style="color: #4ade80">النص هنا</span>
      - الأشياء المتوسطة والمقبولة لونها بالبرتقالي هكذا: <span style="color: #f97316">النص هنا</span>
      - الأشياء السيئة والسلبية (أو المصاريف الكبيرة) لونها بالأحمر هكذا: <span style="color: #ef4444">النص هنا</span>

      يجب أن يشمل تقييمك:
      1. **نظرة عامة**: رأيك السريع.
      2. **تحليل الصور وتبرير الحكم**: إذا تم إرفاق صور مع الطلب، قم بتحليلها بدقة لتقييم حالة الهيكل (الصبيغة، الصدمات)، الصالون، العجلات، والمحرك إن وجد. **وضح سبب حكمك بشكل دقيق** (مثلاً: "لاحظت اختلاف لون الرفرف الأمامي"، أو "وجود فجوة غير طبيعية بين الباب والهيكل"، أو "آثار فك في براغي غطاء المحرك"). لا تكتفِ بإعطاء النتيجة النهائية فقط، بل اشرح للمستخدم ما رأيته بالضبط في الصور أو استنتجته من الوصف لتبني الثقة.
      3. **تحليل حالة السيارة ومصاريف الترقيع**: توقع المصاريف المحتملة في المحرك، الهيكل، نظام التعليق، والكهرباء بناءً على وصف الإعلان والصور وسنة الصنع والممشى. **مهم جداً**: استخدم أداة بحث جوجل (googleSearch) للبحث عن أحدث أسعار قطع الغيار والمحركات في السوق الجزائري، (لاسيما في الـ Casse)، فمثلاً محرك ياريس 1.3 قد يصل سعره إلى 44 مليون سنتيم (440,000 دج) أو أكثر. أعطِ تقديرات واقعية ودقيقة جداً تعكس الأسعار الحالية للسوق لتجنب تضليل المشتري.
      4. **تحليل السعر**: قارن السعر المطلوب بحالة السوق الحالية، واقترح مجالاً سعرياً عادلاً. **تحذير صارم جداً**: سوق السيارات في الجزائر يعيش حالة تضخم جنونية غير مسبوقة! سيارات قديمة مثل كليو كومبيس 2007 تباع بأسعار تتراوح بين 100 إلى 140 مليون سنتيم وهذا هو **السعر العادي والطبيعي** في السوق الجزائري حالياً. يُمنع منعاً باتاً أن تقول عن سعر 100 مليون أو 120 مليون لسيارة كليو 2007 أنه "سعر خيالي" أو "غير منطقي". يجب أن تكون تحليلاتك واقعية ومُحدثة (Mise à jour) ومبنية على هذا التضخم. إذا كان السعر يتماشى مع هذا التضخم، اعتبره سعراً عادياً في السوق ولا تنتقده لمجرد أنه يبدو مرتفعاً مقارنة بالماضي.
      5. **نصيحة أخيرة للمشتري**: نصيحة صريحة ومباشرة عما إذا كان يستحق شراء السيارة أم لا. راعِ ظروف المشتري ذي الميزانية المحدودة (الزوالي)، وانصحه بواقعية إذا كانت السيارة تناسب ميزانيته أو ستتعبه بمصاريف الصيانة والترقيع.

      لتقديم رسم بياني لتوقعات مصاريف الإصلاح والتجديد (بالدينار الجزائري)، قم دائماً بتضمين كتلة JSON في نهاية ردك بالتنسيق التالي بالضبط (يجب أن يكون بالدينار الجزائري وليس بملايين السنتيمات في الرسم البياني):
      \`\`\`json
      {
        "repairCosts": [
          {"name": "المحرك", "cost": 40000},
          {"name": "الهيكل", "cost": 0},
          {"name": "نظام التعليق", "cost": 15000},
          {"name": "الكهرباء", "cost": 5000}
        ]
      }
      \`\`\`
      ضع القيمة 0 إذا كنت تتوقع أن الجزء سليم أو لا يتطلب مصاريف. استنتج هذه التكاليف بناءً على حالة السيارة في الإعلان وسنة صنعها كخبير.`;

      let textContent = `معلومات الإعلان:
العنوان: ${adDetails.title || 'غير متوفر'}
السعر: ${adDetails.price ? adDetails.price + ' دج' : 'غير متوفر'}
سوموني (أعلى عرض): ${adDetails.samouni ? adDetails.samouni + ' دج' : 'غير متوفر'}
الولاية: ${adDetails.wilaya || 'غير متوفر'}
الماركة: ${adDetails.brand || 'غير متوفر'}
سنة الصنع: ${adDetails.year || 'غير متوفر'}
المسافة المقطوعة: ${adDetails.mileage ? adDetails.mileage + ' كم' : 'غير متوفر'}
الوصف: ${adDetails.description || 'غير متوفر'}
الطاقة: ${adDetails.fuelType || 'غير متوفر'}
ناقل الحركة: ${adDetails.transmission || 'غير متوفر'}
الطلاء (معاود/أصلية): ${adDetails.paint || 'غير متوفر'}

رسالة المستخدم (${role === 'seller' ? 'البائع' : 'المشتري'}):
${userMessage}
`;

      const contentsPart: any[] = [textContent];

      if (adDetails.images && Array.isArray(adDetails.images)) {
        // Fetch up to 3 images to avoid payload size issues or timeouts
        for (const imgUrl of adDetails.images.slice(0, 3)) {
          try {
             const imgRes = await fetch(imgUrl);
             if (imgRes.ok) {
                const arrayBuffer = await imgRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
                contentsPart.push({
                   inlineData: {
                     data: buffer.toString('base64'),
                     mimeType: mimeType
                   }
                });
             }
          } catch (e) {
             console.error('Failed to fetch image for AI assessment:', e);
          }
        }
      }

      // Try keys randomly or sequentially until one succeeds
      const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];

      let isRateLimited = false;

      for (let i = 0; i < shuffledKeys.length; i++) {
        for (const modelName of modelsToTry) {
          try {
            const ai = new GoogleGenAI({
              apiKey: shuffledKeys[i],
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });

            let response;
            try {
              response = await ai.models.generateContent({
                model: modelName,
                contents: contentsPart,
                config: {
                  systemInstruction: systemInstruction,
                  tools: [{ googleSearch: {} }],
                  ...(modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
                },
              });
            } catch (searchErr) {
              // Fallback without search if grounding or search tool fails
              response = await ai.models.generateContent({
                model: modelName,
                contents: contentsPart,
                config: {
                  systemInstruction: systemInstruction,
                  ...(modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
                },
              });
            }

            const rawReplyText = response.text || response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
            const replyText = cleanAIReply(rawReplyText);
            if (replyText) {
              return res.json({ reply: replyText });
            }
          } catch (error: any) {
            console.warn(`Retry notice for key index ${i} (${modelName}):`, error.message);
            lastError = error;
            if (error?.message?.includes('429') || error?.message?.includes('Quota exceeded') || error?.status === 'RESOURCE_EXHAUSTED') {
                isRateLimited = true;
            }
          }
        }
      }

      // If all keys failed
      if (isRateLimited) {
        return res.status(429).json({ error: "عذراً، تم تجاوز الحد المسموح به للطلبات المجانية في الوقت الحالي (ضغط كبير على النظام). يرجى المحاولة مرة أخرى بعد دقيقة." });
      }
      throw lastError || new Error("جميع مفاتيح API فشلت");
    } catch (error) {
      console.error("Final Error from Gemini:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تقييم السيارة. الرجاء المحاولة مرة أخرى." });
    }
  });

  // API Route for Freeform AI Expert Chat
  app.post("/api/gemini/expert-chat", async (req, res) => {
    try {
      const keys = getGeminiKeys();
      let lastError = null;
      const { message, history } = req.body;
      
      const systemInstruction = `أنت "الخبير الآلي لسوق السيارات الجزائري" (Market Auto DZ). مستشار مستمر ومحترف ومستقل بالدارجة الجزائرية الفصيحة والمهذبة والمحبوبة.
مهمتك إجابة أي سؤال للمستخدم بخصوص السيارات، أسعارها، محركاتها، أسعار قطع الغيار في الـ Casse، ومقارنة السيارات، والمشاورات قبل الشراء أو البيع.

قواعد أساسية يجب الالتزام بها:
1. **الأسعار والواقع الجزائري**: سوق السيارات بالجزائر يشهد تضخماً كبيراً جداً بسبب محدودية الاستيراد والطلب العالي. اعتبر هذا التضخم واقعاً طبيعياً وعادياً ولا تنتقده لمجرد ارتفاعه مقارنة بالماضي (مثال: كليو كومبيس 2007 بـ 100-140 مليون سنتيم، ياريس 2014 بـ 200-240 مليون سنتيم، كليو 3 بـ 130-160 مليون، غولف 7 بـ 280-350 مليون هي أسعار عادية وجارية اليوم).
2. **أسعار المحركات وقطع الغيار في الكاس (Casse)**: كن خبيراً بأسعار المحركات المستوردة والمستعملة في الجزائر (مثال: محرك ياريس 1.3 VVTi يترواح سعره في الكاس بين 40 إلى 50 مليون سنتيم 400,000-500,000 دج؛ محرك رينو 1.5 dCi بين 25 و35 مليون سنتيم؛ محرك 1.6 HDi بين 30 و40 مليون سنتيم؛ محرك Volkswagen 2.0 TDI بين 50 و70 مليون سنتيم).
3. **مصدر البيانات**: يستمد الخبير معلوماته من متابعته المستمرة لمجموعات فيسبوك للمستعمل، وموقع واد كنيس (Ouedkniss)، وسوق السيارات في مختلف الولايات (العاصمة، وهران، سطيف، باتنة، قسنطينة، شلف، إلخ) وتحليلات محرك جوجل.
4. **التنسيق والتلوين**: استخدم تنسيق Markdown، واحرص على استخدام وسوم HTML لتلوين الإجابات:
   - النقاط الإيجابية والممتازة: <span style="color: #4ade80">النص الأخضر</span>
   - النقاط المتوسطة والتحذيرات: <span style="color: #f97316">النص البرتقالي</span>
   - العيوب الخطيرة أو المحركات المكلفة جداً: <span style="color: #ef4444">النص الأحمر</span>
5. اختصر الإجابة وركز على إعطاء معلومات دقيقة، نصيحة صريحة ومباشرة للمستخدم.`;

      let textContent = `سؤال المستخدم: ${message || ''}\n`;
      if (history && Array.isArray(history) && history.length > 0) {
        textContent = `سجل المحادثة السابقة:\n` + history.map((h: any) => `${h.role === 'user' ? 'المستخدم' : 'الخبير'}: ${h.text}`).join('\n') + `\n\nالسؤال الجديد: ${message}`;
      }

      const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];

      let isRateLimited = false;

      for (let i = 0; i < shuffledKeys.length; i++) {
        for (const modelName of modelsToTry) {
          try {
            const ai = new GoogleGenAI({
              apiKey: shuffledKeys[i],
              httpOptions: {
                headers: { 'User-Agent': 'aistudio-build' }
              }
            });

            let response;
            try {
              response = await ai.models.generateContent({
                model: modelName,
                contents: textContent,
                config: {
                  systemInstruction: systemInstruction,
                  tools: [{ googleSearch: {} }],
                  ...(modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
                },
              });
            } catch (searchErr) {
              response = await ai.models.generateContent({
                model: modelName,
                contents: textContent,
                config: {
                  systemInstruction: systemInstruction,
                  ...(modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
                },
              });
            }

            const rawReplyText = response.text || response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
            const replyText = cleanAIReply(rawReplyText);
            if (replyText) {
              return res.json({ reply: replyText });
            }
          } catch (error: any) {
            console.warn(`Retry notice for key index ${i} (${modelName}) in expert-chat:`, error.message);
            lastError = error;
            if (error?.message?.includes('429') || error?.message?.includes('Quota exceeded') || error?.status === 'RESOURCE_EXHAUSTED') {
              isRateLimited = true;
            }
          }
        }
      }

      if (isRateLimited) {
        return res.status(429).json({ error: "عذراً، هناك ضغط كبير على الخدمة حالياً. يرجى المحاولة بعد دقيقة." });
      }
      throw lastError || new Error("جميع مفاتيح API فشلت");
    } catch (error) {
      console.error("Final Error from Gemini expert-chat:", error);
      res.status(500).json({ error: "حدث خطأ أثناء التواصل مع الخبير الآلي." });
    }
  });

  // API Route for Market Analysis (Grounded in Real External Platforms + Growing Platform Posts)
  app.post("/api/gemini/market-analysis", async (req, res) => {
    try {
      const keys = getGeminiKeys();
      let lastError = null;
      const { adDetails, marketData, focusBrand, searchQuery, totalPlatformAds } = req.body;

      const marketItems = Array.isArray(marketData) ? marketData : [];
      const activeItems = marketItems.filter((m: any) => m?.status !== 'sold');
      const numericPrices = activeItems
        .map((m: any) => Number(m?.price))
        .filter((p: number) => !isNaN(p) && p > 50000);

      const sortedPrices = [...numericPrices].sort((a, b) => a - b);
      const computedAvg = sortedPrices.length > 0
        ? Math.round(sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length)
        : 0;
      const computedMedian = sortedPrices.length > 0
        ? sortedPrices[Math.floor(sortedPrices.length / 2)]
        : 0;
      const computedMin = sortedPrices.length > 0 ? sortedPrices[0] : 0;
      const computedMax = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : 0;

      // Compute real per-wilaya averages from platform posts
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

      // Dynamic weight: grows as more listings are posted on the platform
      const matchingCount = activeItems.length;
      const platformWeightPercent = matchingCount === 0
        ? 0
        : Math.min(85, Math.max(15, Math.round((matchingCount / 25) * 85)));

      const subjectLabel = adDetails?.title
        ? `${adDetails.brand || ''} ${adDetails.model || ''} ${adDetails.year || ''} (${adDetails.title})`.trim()
        : [focusBrand, searchQuery].filter(Boolean).join(' ').trim() || 'سوق السيارات المستعملة في الجزائر (رينو، هيونداي، فولكسفاغن، داسيا، بيجو)';

      const systemInstruction = `أنت محلل اقتصادي جزائري دقيق ومتخصص في سوق السيارات بالجزائر (Market Auto DZ).
مهمتك تقديم تحليل سوقي دقيق ومفهوم جداً للشخص العادي (بالعربية الواضحة والدارجة الجزائرية المهذبة) يجمع بين:
- المعطيات الواقعية الحقيقية من المنصات والأسواق الجزائرية (Ouedkniss واد كنيس، Facebook Marketplace DZ، أسواق تيجلابين وعين أرنات سطيف)
- والمعطيات الفعلية المسجلة في منشورات هذه المنصة (وزن بيانات المنصة الحالية: ${platformWeightPercent}% بناءً على ${matchingCount} منشور نشط).

يجب أن يشمل التحليل:
1. السوق اليومي (dailyMarket): 6 فترات من اليوم (من الصباح حتى الليل) توضح حركة السعر والطلب خلال اليوم الواحد.
2. السوق الأسبوعي (weeklyMarket): 7 أيام الأسبوع (السبت إلى الجمعة، مع الإشارة لأسواق الجمعة والسبت مثل تيجلابين وعين أرنات سطيف) بمقارنة سعر العرض مقابل السعر العادل الفعلي ومستوى النشاط.
3. التطور الشهري وتوقعات الأشهر القادمة (monthlyForecast): 10 نقاط زمنية متصلة (4 أشهر ماضية + هذا الشهر + 5 أشهر قادمة) توضح:
   - actualPrice: السعر المسجل للأشهر الماضية والحالية (يُترك غير محدد للأشهر المستقبلية، ويُملأ في الشهر الحالي).
   - forecastPrice: السعر المتوقع (يبدأ من هذا الشهر لربط المنحنى ويمتد لـ 5 أشهر قادمة).
   - optimisticPrice: السعر في حالة نزول/فرصة شراء (للمستقبل والشهر الحالي).
   - pessimisticPrice: السعر في حالة ارتفاع/طلب قوي (للمستقبل والشهر الحالي).
   - trendColor: "green" (فرصة/انخفاض أو استقرار جيد) | "amber" (استقرار حذر) | "red" (ارتفاع متوقع).
   - simpleReason: سبب مبسط من جملة واحدة يفهمه المواطن العادي.
4. شرح مبسط جداً للمواطن العادي (simpleCitizenGuide) بدون مصطلحات معقدة، مع توضيح الأسعار بالدينار الجزائري والمليون سنتيم (1,500,000 دج = 150 مليون سنتيم).`;

      const targetDesc = adDetails?.title
        ? `معلومات الإعلان الحالي:
العنوان: ${adDetails.title}
الماركة والموديل: ${adDetails.brand || ''} ${adDetails.model || ''}
السعر المطلوب: ${adDetails.price ? adDetails.price + ' دج' : 'غير متوفر'}
الولاية: ${adDetails.wilaya || 'غير متوفر'}
سنة الصنع: ${adDetails.year || 'غير متوفر'}
المسافة: ${adDetails.mileage ? adDetails.mileage + ' كم' : 'غير متوفر'}
المحرك والطاقة: ${adDetails.engine || ''} ${adDetails.fuelType || ''}`
        : `الموضوع المطلوب تحليله في السوق الجزائري: ${subjectLabel}`;

      const statsSummary = numericPrices.length > 0
        ? `إحصائيات حقيقية من إعلانات المنصة (${numericPrices.length} منشور مطابق): المتوسط ${computedAvg} دج، الوسيط ${computedMedian} دج، الأدنى ${computedMin} دج، الأعلى ${computedMax} دج. إحصائيات الولايات من المنصة: ${JSON.stringify(wilayaStats)}`
        : `لا توجد إعلانات مطابقة كافية بعد في المنصة (0 منشور مطابق لهذا التحديد)، اعتمد على الأسعار الحقيقية في المنصات والأسواق الجزائرية الآن.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          trendData: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER },
              },
              required: ["name", "price"],
            },
          },
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
          "recommendation", "bestTimeToBuy", "explanation", "priceFactors"
        ],
      };

      const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];

      let isRateLimited = false;
      for (let i = 0; i < shuffledKeys.length; i++) {
        for (const modelName of modelsToTry) {
          try {
            const ai = new GoogleGenAI({
              apiKey: shuffledKeys[i],
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });

            // Step 1: Real Google Search grounding for live Algerian platform prices (Ouedkniss, Facebook DZ, souks)
            let groundedBrief = '';
            let sources: { title: string; uri: string }[] = [];
            try {
              const searchRes = await ai.models.generateContent({
                model: modelName,
                contents: `ابحث في مواقع السيارات الجزائرية الحقيقية (Ouedkniss واد كنيس، Autobip، أسعار سوق السيارات في الجزائر 2025-2026) عن متوسط الأسعار الفعلية المعروضة حالياً لـ: ${subjectLabel}. أعطِ ملخصاً مختصراً بالأرقام بالدينار الجزائري والمليون سنتيم.`,
                config: {
                  tools: [{ googleSearch: {} }],
                  ...(modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
                },
              });
              groundedBrief = (searchRes.text || '').trim();
              const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks;
              if (Array.isArray(chunks)) {
                const seenUris = new Set<string>();
                sources = chunks
                  .map((c: any) => c?.web)
                  .filter((w: any) => w?.uri && w?.title && !seenUris.has(w.uri) && seenUris.add(w.uri))
                  .slice(0, 5)
                  .map((w: any) => ({ title: String(w.title), uri: String(w.uri) }));
              }
            } catch (groundErr: any) {
              console.warn(`Search grounding skipped for ${modelName}:`, groundErr?.message);
            }

            // Step 2: Combine real external grounded brief + real platform posts into structured JSON
            const textContent = `${targetDesc}
${statsSummary}
${groundedBrief ? `نتائج البحث الحقيقي من المنصات الجزائرية الآن:\n${groundedBrief}\n` : ''}
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

            return res.json({
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
            console.warn(`Retry notice for key index ${i} (${modelName}) in market-analysis:`, error.message);
            lastError = error;
            if (error?.message?.includes('429') || error?.message?.includes('Quota exceeded') || error?.status === 'RESOURCE_EXHAUSTED') {
                isRateLimited = true;
            }
          }
        }
      }

      if (isRateLimited) {
        return res.status(429).json({ error: "عذراً، تم تجاوز الحد المسموح به للطلبات المجانية في الوقت الحالي." });
      }
      throw lastError || new Error("جميع مفاتيح API فشلت");

    } catch (error) {
      console.error("Final Error from Gemini in market-analysis:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تحليل السوق." });
    }
  });

  // API Route for Smart AI Search & Filter Assistant
  app.post("/api/gemini/smart-search", async (req, res) => {
    try {
      const keys = getGeminiKeys();
      let lastError = null;
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
مهمتك قراءة طلب المستخدم بالدارجة الجزائرية أو العربية أو الفرنسية وفهم ما يبحث عنه بدقة:
1. استخراج الفلاتر تلقائياً (extractedFilters):
   - انتبه للأسعار في الجزائر: "150 مليون" = 1500000 دج (1 مليون سنتيم = 10000 دج).
   - إذا ذكر المستخدم "قل من 180 مليون" -> maxPrice = 1800000.
   - إذا ذكر "بين 120 و 160 مليون" -> minPrice = 1200000، maxPrice = 1600000.
   - إذا ذكر ولاية (مثلاً سطيف، الجزائر، وهران، باتنة، قسنطينة...) -> ضعها في wilaya مطابقة للأسماء الرسمية العربية.
   - إذا ذكر محركاً (مثل 1.5 dCi -> "1.5" أو "DCI"، 1.6 HDi -> "1.6" أو "HDI") -> ضعه في engine، وإذا ذكر بنزين/ديزل/غاز/كهرباء -> ضعه في fuelType.
   - إذا ذكر المسافة المقطوعة (مثلاً "ماشية قل من 200 ألف") -> maxMileage = 200000.
   - إذا ذكر الماركة (Renault, Hyundai, Volkswagen, Peugeot, Dacia, Toyota, Kia...) -> ضعها بالإنجليزية في brand.
2. فحص قائمة الإعلانات الحقيقية المتوفرة (ads) واختيار أفضل الخيارات المتاحة وترتيبها من الأفضل للأقل (أقصى حد 4 خيارات) في bestMatches:
   - تجنب ترشيح الإعلانات المباعة (status === 'sold') كأولوية.
   - أعطِ كل إعلان درجة توافق (matchScore من 0 إلى 100)، وسبب واضح ومقنع بالدارجة الجزائرية (reason) يوضح لماذا هذا الإعلان هو أفضل خيار حسب السعر والمكان والمحرك والمسافة والحالة، مع نقاط القوة (pros) وأي تنبيهات (warnings مثل نقص الزيت أو السخونة أو الكيلومتراج).
   - يجب أن يكون adId مطابقاً تماماً لـ id موجود في القائمة المرسلة!
   - إذا لم يوجد تطابق 100%، اقترح أقرب البدائل الواقعية واشرح للمستخدم لماذا.
3. اكتب ملخصاً ودياً (assistantSummary) بالدارجة/العربية يوجّه المشتري نحو الخيار الأفضل.`;

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

      const textContent = `طلب المستخدم:\n"${userQuery}"\n\nقائمة الإعلانات المتوفرة في المنصة (${compactAds.length} إعلان):\n${JSON.stringify(compactAds)}`;

      const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
      let isRateLimited = false;

      for (let i = 0; i < shuffledKeys.length; i++) {
        for (const modelName of modelsToTry) {
          try {
            const ai = new GoogleGenAI({
              apiKey: shuffledKeys[i],
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });

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

            const text = (response.text || "").trim();
            if (!text) throw new Error("Empty response");
            return res.json(JSON.parse(text));
          } catch (error: any) {
            console.warn(`Retry notice for key index ${i} (${modelName}) in smart-search:`, error.message);
            lastError = error;
            if (error?.message?.includes('429') || error?.message?.includes('Quota exceeded') || error?.status === 'RESOURCE_EXHAUSTED') {
              isRateLimited = true;
            }
          }
        }
      }

      if (isRateLimited) {
        return res.status(429).json({ error: "عذراً، تم تجاوز الحد المسموح به للطلبات المجانية في الوقت الحالي." });
      }
      throw lastError || new Error("جميع مفاتيح API فشلت");
    } catch (error) {
      console.error("Final Error from Gemini in smart-search:", error);
      res.status(500).json({ error: "حدث خطأ أثناء البحث الذكي." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
