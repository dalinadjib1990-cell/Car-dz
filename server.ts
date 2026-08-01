import fs from 'fs';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
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
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];

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
                  temperature: 0.7,
                  tools: [{ googleSearch: {} }]
                },
              });
            } catch (searchErr) {
              // Fallback without search if grounding or search tool fails
              response = await ai.models.generateContent({
                model: modelName,
                contents: contentsPart,
                config: {
                  systemInstruction: systemInstruction,
                  temperature: 0.7,
                },
              });
            }

            const rawReplyText = response.text || response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
            const replyText = cleanAIReply(rawReplyText);
            if (replyText) {
              return res.json({ reply: replyText });
            }
          } catch (error: any) {
            console.error(`Error with key index ${i} using model ${modelName}:`, error.message);
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
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];

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
                  temperature: 0.7,
                  tools: [{ googleSearch: {} }]
                },
              });
            } catch (searchErr) {
              response = await ai.models.generateContent({
                model: modelName,
                contents: textContent,
                config: {
                  systemInstruction: systemInstruction,
                  temperature: 0.7,
                },
              });
            }

            const rawReplyText = response.text || response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
            const replyText = cleanAIReply(rawReplyText);
            if (replyText) {
              return res.json({ reply: replyText });
            }
          } catch (error: any) {
            console.error(`Error with key index ${i} using model ${modelName} in expert-chat:`, error.message);
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

  // API Route for Market Analysis
  app.post("/api/gemini/market-analysis", async (req, res) => {
    try {
      const keys = getGeminiKeys();
      let lastError = null;
      const { adDetails, marketData } = req.body;
      
      const systemInstruction = `أنت خبير جزائري محترف متخصص في تحليل سوق السيارات بالجزائر (Market Auto DZ AI Analyst). عليك أن تستمد معلوماتك عن السوق جزئيا من البيانات الخارجية المتاحة لك من خلال معرفتك المسبقة وتكون على اطلاع دائم بالسوق الجزائري (العاصمة، سطيف، وهران، قسنطينة، باتنة، إلخ).
مهمتك هي تحليل الإعلان وتزويد المواطن الجزائري بتحليل مفصل، دقيق وسهل الفهم يوضح ماذا يعني السعر العادل ومعدل الأسعار في مختلف الولايات (خوصوصاً سطيف والعاصمة).
يجب أن ترد بصيغة JSON فقط، بدون أي نصوص إضافية، وفقاً للهيكل التالي بالضبط:
{
  "trendData": [
    {"name": "قبل 6 أشهر", "price": 1900000},
    {"name": "قبل 3 أشهر", "price": 1950000},
    {"name": "الشهر الماضي", "price": 2000000},
    {"name": "هذا الشهر", "price": 2050000}
  ],
  "marketStatus": "Rising" | "Stable" | "Falling",
  "fairPrice": 2000000,
  "fairPriceMin": 1850000,
  "fairPriceMax": 2150000,
  "nationalAvgPrice": 1980000,
  "fairPriceDefinition": "السعر العادل هو القيمة السوقية الحقيقية التي تتوازن فيها حالة السيارة (الكيلومتراج، الهيكل، الصباغة) مع العرض والطلب الحقيقي في الجزائر بدون مضاربة أو تبخيس.",
  "supplyDemand": "High" | "Medium" | "Low",
  "avgSellingTime": "12",
  "similarListings": 15,
  "regionalComparison": [
    {"region": "الجزائر العاصمة", "price": 2050000, "diffText": "+3.5% عن المعدل"},
    {"region": "سطيف (سوق عين أرنات)", "price": 1940000, "diffText": "-2.0% سعر تنافسي"},
    {"region": "وهران", "price": 2000000, "diffText": "مطابق للمعدل"},
    {"region": "قسنطينة", "price": 1970000, "diffText": "-0.5% مقبول جداً"},
    {"region": "باتنة", "price": 1920000, "diffText": "-3.0% مناسب للبيع"}
  ],
  "recommendation": "Negotiate",
  "bestTimeToBuy": "أسعار هذا الموديل مستقرة حالياً، التفاوض في أسواق سطيف وباتنة يمنحك حسماً أفضل.",
  "explanation": "السعر المطلوب قاطوعي وقريب من المعدل الوطني. ننصح بالتفاوض على السعر العادل بناء على حالة المعاودة والكيلومتراج.",
  "priceFactors": [
    {"factor": "سنة التصنيع والكيلومتراج", "impact": "محدد أولي للأساس", "value": "معدل 15,000 كم/سنة"},
    {"factor": "الطلاء والصباغة (معاودة)", "impact": "تأثير 5 إلى 15 مليون سنتيم", "value": "السيارة النظيفة بدون صباغة تحافظ على سعرها العادل"},
    {"factor": "فارق الولايات (سطيف والعاصمة)", "impact": "تأثير بين 2% إلى 5%", "value": "سوق سطيف يميل لتقديم أسعار أكثر مرونة من العاصمة"}
  ]
}
ملاحظة: المبالغ تكون بالدينار الجزائري (دج).
تنبيه صارم: الأسعار الحالية في الجزائر مرتفعة (مثلاً السيارات المستعملة تتراوح بين 120 مليون و300 مليون سنتيم حسب الفئة). تقييماتك للمجال السعري يجب أن تعتمد الواقع الحالي للسوق الجزائري كمعيار طبيعي.`;

      let textContent = adDetails.title ? `معلومات الإعلان الحالي:
العنوان: ${adDetails.title || 'غير متوفر'}
السعر: ${adDetails.price ? adDetails.price + ' دج' : 'غير متوفر'}
سوموني (أعلى عرض): ${adDetails.samouni ? adDetails.samouni + ' دج' : 'غير متوفر'}
الولاية: ${adDetails.wilaya || 'غير متوفر'}
الماركة: ${adDetails.brand || 'غير متوفر'}
سنة الصنع: ${adDetails.year || 'غير متوفر'}
المسافة المقطوعة: ${adDetails.mileage ? adDetails.mileage + ' كم' : 'غير متوفر'}

بيانات السوق المتاحة (سيارات مشابهة):
${JSON.stringify(marketData || [])}` : `طلب تحليل عام للسوق الجزائري للسيارات، يرجى تقديم نظرة عامة عن الأسعار، أكثر السيارات مبيعاً والتوجه الحالي للسوق.
بيانات السوق الحالية:
${JSON.stringify(marketData || [])}`;

      // Try keys randomly or sequentially until one succeeds
      const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];

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
                contents: textContent,
                config: {
                  systemInstruction: systemInstruction,
                  temperature: 0.5,
                  tools: [{ googleSearch: {} }]
                },
              });
            } catch (searchErr) {
              response = await ai.models.generateContent({
                model: modelName,
                contents: textContent,
                config: {
                  systemInstruction: systemInstruction,
                  temperature: 0.5,
                },
              });
            }

            let responseText = response.text || response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
            if (!responseText) {
              // Retry without search tool if text was empty
              const fallbackRes = await ai.models.generateContent({
                model: modelName,
                contents: textContent,
                config: {
                  systemInstruction: systemInstruction,
                  temperature: 0.5,
                },
              });
              responseText = fallbackRes.text || fallbackRes.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
            }

            if (!responseText) throw new Error("Empty response");
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              responseText = jsonMatch[0];
            } else {
              responseText = responseText.replace(/\`\`\`(json)?/g, '').trim();
            }
            
            if (!responseText) throw new Error("Empty response");
            
            try {
              return res.json(JSON.parse(responseText));
            } catch (e) {
              throw new Error("Invalid JSON: " + responseText.substring(0, 100));
            }

          } catch (error: any) {
            console.error(`Error with key index ${i} using model ${modelName} in market-analysis:`, error.message);
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
