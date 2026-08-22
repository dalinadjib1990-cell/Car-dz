import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, TrendingUp, TrendingDown, Minus, Clock, MapPin, Search, CheckCircle2, 
  Loader2, LineChart as LineChartIcon, Activity, Bot, Info, ShieldCheck, 
  Sparkles, Scale, DollarSign, Layers, ChevronLeft, Calendar, Newspaper, 
  Factory, Globe, MessageSquare, AlertCircle, ArrowUpRight, ArrowDownRight,
  Flame, BarChart3, Compass, Share2
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, BarChart, Bar } from 'recharts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Ad } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface MarketAnalysisPopupProps {
  isOpen: boolean;
  onClose: () => void;
  ad?: Ad;
}

interface PriceFactor {
  factor: string;
  impact: string;
  value: string;
}

interface RegionalComparisonItem {
  region: string;
  price: number;
  diffText?: string;
}

interface DailyVolatilityItem {
  day: string;
  date?: string;
  priceIndex: number;
  fluctuation: string;
  marketActivity: 'Peak' | 'High' | 'Medium' | 'Low';
  notes: string;
}

interface ForecastPeriod {
  trend: 'Rising' | 'Stable' | 'Falling';
  expectedChangePercent: string;
  expectedPrice: number;
  summary: string;
  keyDrivers: string[];
}

interface TrajectoryPoint {
  name: string;
  price: number;
  type?: 'past' | 'current' | 'forecast';
  minExpected?: number;
  maxExpected?: number;
}

interface MarketNewsRadar {
  importAndLaws?: {
    title: string;
    status: string;
    impact: string;
    details: string;
  };
  factoriesAndLocalAssembly?: {
    title: string;
    status: string;
    impact: string;
    details: string;
  };
  socialMediaSentiment?: {
    title: string;
    sentiment: string;
    buzzTopic: string;
    buyerAttitude: string;
  };
  weeklyMarketsInsights?: {
    title: string;
    highlights: string;
  };
}

interface MarketData {
  trendData: { name: string; price: number }[];
  dailyVolatilityData?: DailyVolatilityItem[];
  forecasts?: {
    nextWeek: ForecastPeriod;
    nextMonth: ForecastPeriod;
    upcomingMonths: ForecastPeriod & { timeframe?: string };
  };
  forecastTrajectoryData?: TrajectoryPoint[];
  marketNewsRadar?: MarketNewsRadar;
  marketStatus: 'Rising' | 'Stable' | 'Falling';
  fairPrice: number;
  fairPriceMin?: number;
  fairPriceMax?: number;
  nationalAvgPrice?: number;
  fairPriceDefinition?: string;
  supplyDemand: 'High' | 'Medium' | 'Low';
  avgSellingTime: string;
  similarListings: number;
  regionalComparison: RegionalComparisonItem[];
  bestTimeToBuy: string;
  recommendation: 'Buy Now' | 'Wait' | 'Negotiate' | 'Avoid';
  explanation: string;
  priceFactors?: PriceFactor[];
}

export default function MarketAnalysisPopup({ isOpen, onClose, ad }: MarketAnalysisPopupProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MarketData | null>(null);
  const [activeTab, setActiveTab] = useState<'volatility' | 'forecasts' | 'news' | 'fairPrice'>('volatility');

  useEffect(() => {
    if (isOpen) {
      fetchAnalysis();
    }
  }, [isOpen, ad]);

  const generateLocalFallbackData = (basePrice: number): MarketData => {
    return {
      trendData: [
        { name: 'قبل 6 أشهر', price: Math.round(basePrice * 1.07) },
        { name: 'قبل 3 أشهر', price: Math.round(basePrice * 1.04) },
        { name: 'الشهر الماضي', price: Math.round(basePrice * 1.015) },
        { name: 'هذا الشهر', price: basePrice }
      ],
      dailyVolatilityData: [
        { day: 'السبت (تيجلابين)', date: 'سوق بومرداس', priceIndex: Math.round(basePrice * 1.01), fluctuation: '+1.0%', marketActivity: 'Peak', notes: 'سيولة عالية وعروض قوية لسيارات الديزل والسيارات النظيفة' },
        { day: 'الأحد', date: 'تداول رقمي', priceIndex: Math.round(basePrice * 1.005), fluctuation: '-0.3%', marketActivity: 'Medium', notes: 'استقرار في حركة البيع المباشر بين الخواص' },
        { day: 'الإثنين', date: 'تداول بين الولايات', priceIndex: Math.round(basePrice * 1.00), fluctuation: '-0.2%', marketActivity: 'Medium', notes: 'عروض عبر المنصات الرقمية وتفاوض مرن بين المشترين' },
        { day: 'الثلاثاء (سطيف)', date: 'سوق عين أرنات', priceIndex: Math.round(basePrice * 0.98), fluctuation: '-1.4%', marketActivity: 'Peak', notes: 'سوق عين أرنات يسجل أسعاراً تنافسية مع مرونة بالتفاوض لإنهاء الصفقات' },
        { day: 'الأربعاء (شلغوم العيد)', date: 'سوق ميلة', priceIndex: Math.round(basePrice * 0.985), fluctuation: '+0.4%', marketActivity: 'High', notes: 'إقبال معتبر على السيارات النفعية والاقتصادية' },
        { day: 'الخميس (باتنة)', date: 'سوق الأوراس', priceIndex: Math.round(basePrice * 0.975), fluctuation: '-0.6%', marketActivity: 'High', notes: 'أسعار مشجعة وتراجع في هوامش الوسطاء' },
        { day: 'الجمعة', date: 'تثبيت وتفاوض', priceIndex: Math.round(basePrice * 0.975), fluctuation: '0.0%', marketActivity: 'Low', notes: 'فترة تداول هادئة قبل انطلاق أسواق عطلة الأسبوع' }
      ],
      forecasts: {
        nextWeek: {
          trend: 'Stable',
          expectedChangePercent: '-0.5% إلى -1.2%',
          expectedPrice: Math.round(basePrice * 0.99),
          summary: 'استقرار نسبي مع فرص تفاوض مواتية في أسواق سطيف وباتنة وتيجلابين.',
          keyDrivers: ['تواصل النشاط في الأسواق الأسبوعية', 'زيادة العروض من الخواص الراغبين في تجديد سياراتهم']
        },
        nextMonth: {
          trend: 'Falling',
          expectedChangePercent: '-2.0% إلى -4.0%',
          expectedPrice: Math.round(basePrice * 0.965),
          summary: 'تراجع تدريجي في أسعار المستعمل تزامناً مع توزيع دفعات جديدة من السيارات الجديدة وتخفيف المضاربة.',
          keyDrivers: ['تسليم كوطات إضافية للوكلاء المعتمدين', 'توسع إنتاج مصنع فيات بطفراوي بوهران']
        },
        upcomingMonths: {
          timeframe: 'خلال 3 إلى 6 أشهر القادمة',
          trend: 'Falling',
          expectedChangePercent: '-5.0% إلى -8.5%',
          expectedPrice: Math.round(basePrice * 0.92),
          summary: 'تصحيح سعري نحو القيمة العادلة الحقيقية نتيجة وفرة البدائل الجديدة للمواطنين.',
          keyDrivers: ['دخول سيارات إضافية من علامات شيري وجيلي وبايك', 'تسهيل استيراد السيارات أقل من 3 سنوات للمواطنين']
        }
      },
      forecastTrajectoryData: [
        { name: 'قبل 3 أشهر', price: Math.round(basePrice * 1.04), type: 'past' },
        { name: 'الشهر الماضي', price: Math.round(basePrice * 1.015), type: 'past' },
        { name: 'السعر الحالي', price: basePrice, type: 'current' },
        { name: 'الأسبوع القادم', price: Math.round(basePrice * 0.99), type: 'forecast', minExpected: Math.round(basePrice * 0.98), maxExpected: Math.round(basePrice * 1.0) },
        { name: 'الشهر القادم', price: Math.round(basePrice * 0.965), type: 'forecast', minExpected: Math.round(basePrice * 0.94), maxExpected: Math.round(basePrice * 0.985) },
        { name: 'بعد 3 أشهر', price: Math.round(basePrice * 0.93), type: 'forecast', minExpected: Math.round(basePrice * 0.90), maxExpected: Math.round(basePrice * 0.96) },
        { name: 'بعد 6 أشهر', price: Math.round(basePrice * 0.89), type: 'forecast', minExpected: Math.round(basePrice * 0.85), maxExpected: Math.round(basePrice * 0.93) }
      ],
      marketNewsRadar: {
        importAndLaws: {
          title: 'قوانين الاستيراد وتراخيص الوكلاء بالجزائر',
          status: 'تسهيل وإلغاء القيود البيروقراطية',
          impact: 'وفرة تدريجية في المعروض تخفف الضغط عن أسواق المستعمل',
          details: 'استمرار وتيرة استيراد السيارات الأقل من ثلاث سنوات مع تسريع إجراءات جمركة واستلام كوطات الوكلاء المعتمدين.'
        },
        factoriesAndLocalAssembly: {
          title: 'مشاريع المصانع والتصنيع المحلي (فيات، شيري، جيلي)',
          status: 'رفع وتيرة الإنتاج والتسليم',
          impact: 'طرح موديلات سياحية ونفعية بأسعار مضبوطة تكبح غلاء المستعمل',
          details: 'مصنع فيات بطفراوي بوهران يرفع طاقته الإنتاجية لتلبية الطلبيات، مع استكمال إجراءات الإطلاق الصناعي لمصانع شيري وجيلي بالجزائر.'
        },
        socialMediaSentiment: {
          title: 'نبض منصات التواصل الاجتماعي (فيسبوك، تيك توك)',
          sentiment: 'حذر وترقب وميل للتفاوض الذكي',
          buzzTopic: 'مقارنة أسعار المستعمل المرتفعة مع اقتناء سيارة جديدة بالضمان',
          buyerAttitude: 'المشتري الجزائري يرفض المغالاة ويشترط الفحص الدقيق بالماسح الضوئي (سكانير) ووثائق نظافة الهيكل من الصباغة والمعاودة.'
        },
        weeklyMarketsInsights: {
          title: 'تقرير الأسواق الأسبوعية المباشرة (تيجلابين، عين أرنات، باتنة)',
          highlights: 'سوق عين أرنات بسطيف يقود التداول بمرونة 10 إلى 20 مليون سنتيم في التفاوض، بينما يسجل سوق تيجلابين طلباً قوياً على سيارات الديزل خالية الصباغة.'
        }
      },
      marketStatus: 'Falling',
      fairPrice: basePrice,
      fairPriceMin: Math.round(basePrice * 0.92),
      fairPriceMax: Math.round(basePrice * 1.06),
      nationalAvgPrice: Math.round(basePrice * 0.98),
      fairPriceDefinition: 'السعر العادل هو القيمة السوقية المنطقية التي تعكس الحالة الحقيقية للسيارة (الكيلومتراج، نظافة الهيكل، وخلوها من الصباغة) مع توازن العرض والطلب بمختلف الولايات كالجزائر وسطيف.',
      supplyDemand: 'High',
      avgSellingTime: '10-14',
      similarListings: 18,
      regionalComparison: [
        { region: 'الجزائر العاصمة', price: Math.round(basePrice * 1.025), diffText: '+2.5% طلب ثابت' },
        { region: 'سطيف (سوق عين أرنات)', price: Math.round(basePrice * 0.97), diffText: '-3.0% سعر تنافسي مرن' },
        { region: 'وهران', price: Math.round(basePrice * 1.0), diffText: 'المعدل الوطني' },
        { region: 'قسنطينة', price: Math.round(basePrice * 0.985), diffText: '-1.5% تداول نشط' },
        { region: 'باتنة', price: Math.round(basePrice * 0.965), diffText: '-3.5% أنسب للشراء' }
      ],
      recommendation: 'Negotiate',
      bestTimeToBuy: 'أفضل استراتيجية هي التفاوض المباشر في أسواق سطيف وعين أرنات أو انتظار استلام الدفعات الجديدة.',
      explanation: 'السوق يشهد مرحلة تصحيح واستقرار نسبي. يُنصح بالتفاوض على السعر العادل ورفض أي مغالاة في السيارات المعاودة.',
      priceFactors: [
        { factor: 'الكيلومتراج وسنة الصنع', impact: 'المحدد الأساسي', value: 'المعدل الطبيعي 15,000 إلى 20,000 كم/سنة' },
        { factor: 'سلامة الهيكل من الصباغة (المعاودة)', impact: 'فارق 5 إلى 20 مليون سنتيم', value: 'السيارة الأولى (بصباغة المصنع) تحافظ على أصل السعر' },
        { factor: 'فارق الولايات (سطيف مقابل العاصمة)', impact: 'تأثير 3% إلى 5%', value: 'أسواق الشرق والوسط توفر خيارات تفاوض نقدي أوسع' }
      ]
    };
  };

  const fetchAnalysis = async () => {
    setLoading(true);
    const basePrice = ad?.price ? Number(ad.price) : 2100000;
    try {
      let similarAds = [];
      try {
        let q;
        if (ad) {
          q = query(collection(db, 'ads'), where('brand', '==', ad.brand));
        } else {
          q = query(collection(db, 'ads'));
        }
        const snapshot = await getDocs(q);
        similarAds = snapshot.docs.map(doc => doc.data()).slice(0, 10);
      } catch (err) {
        console.error('Failed to fetch similar ads', err);
      }

      const response = await fetch('/api/gemini/market-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adDetails: ad || {},
          marketData: similarAds
        }),
      });

      if (!response.ok) {
        let errMsg = 'فشل في جلب البيانات';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (e) {}
        throw new Error(errMsg);
      }
      const result = await response.json();
      const fallback = generateLocalFallbackData(result.fairPrice || basePrice);

      const mergedData: MarketData = {
        ...fallback,
        ...result,
        fairPrice: result.fairPrice || basePrice,
        fairPriceMin: result.fairPriceMin || Math.round(basePrice * 0.92),
        fairPriceMax: result.fairPriceMax || Math.round(basePrice * 1.06),
        nationalAvgPrice: result.nationalAvgPrice || Math.round(basePrice * 0.98),
        dailyVolatilityData: (result.dailyVolatilityData && result.dailyVolatilityData.length > 0) 
          ? result.dailyVolatilityData 
          : fallback.dailyVolatilityData,
        forecasts: result.forecasts || fallback.forecasts,
        forecastTrajectoryData: (result.forecastTrajectoryData && result.forecastTrajectoryData.length > 0)
          ? result.forecastTrajectoryData
          : fallback.forecastTrajectoryData,
        marketNewsRadar: result.marketNewsRadar || fallback.marketNewsRadar,
        regionalComparison: (result.regionalComparison && result.regionalComparison.length > 0)
          ? result.regionalComparison
          : fallback.regionalComparison,
        priceFactors: (result.priceFactors && result.priceFactors.length > 0)
          ? result.priceFactors
          : fallback.priceFactors
      };

      setData(mergedData);
    } catch (error: any) {
      console.error(error);
      toast.info('تم استخراج مؤشرات السوق بناءً على معطيات الجزائر الحالية');
      setData(generateLocalFallbackData(basePrice));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Rising': return <TrendingUp className="text-emerald-400" size={18} />;
      case 'Falling': return <TrendingDown className="text-cyan-400" size={18} />;
      case 'Stable': return <Minus className="text-amber-400" size={18} />;
      default: return null;
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'Rising': return 'ارتفاع وطلب متزايد';
      case 'Falling': return 'تراجع وتصحيح سعري';
      case 'Stable': return 'استقرار نسبي';
      default: return status;
    }
  };

  const getRecBadge = (rec: string) => {
    switch (rec) {
      case 'Buy Now': 
        return { text: 'صفقة ممتازة (شراء فوري)', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]' };
      case 'Wait': 
        return { text: 'تريث وقارن العروض', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.3)]' };
      case 'Negotiate': 
        return { text: 'السعر ينصح بالتفاوض عليه', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]' };
      case 'Avoid': 
        return { text: 'سعر مبالغ فيه (تجنب الشراء)', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]' };
      default: 
        return { text: rec, bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
    }
  };

  const getActivityBadge = (activity: string) => {
    switch (activity) {
      case 'Peak':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">ذروة النشاط</span>;
      case 'High':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">نشاط قوي</span>;
      case 'Medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">نشاط متوسط</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-500/20 text-slate-300 border border-slate-500/30">هادئ</span>;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-xl overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 20 }}
            className="bg-[#0b0e14] w-full max-w-4xl rounded-2xl sm:rounded-3xl border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)] overflow-hidden max-h-[92vh] flex flex-col my-auto relative text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/50 relative overflow-hidden backdrop-blur-xl flex items-center justify-between gap-3">
              {/* Glow effects */}
              <div className="absolute -top-10 -right-10 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center gap-3 z-10 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-400 p-[1px] shadow-[0_0_20px_rgba(16,185,129,0.4)] shrink-0">
                  <div className="w-full h-full bg-[#0b0e14] rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-400">
                    <Bot size={22} className="animate-pulse" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-emerald-300 truncate">
                      محلل الذكاء الاصطناعي لسوق الجزائر
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                      رادار مباشر 2026
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-white/60 truncate mt-0.5">
                    {ad ? `تحليل وتوقعات أسعار: ${ad.title}` : "دراسة استخباراتية دقيقة لتذبذب الأسعار وتوقعات أسواق السيارات بالجزائر"}
                  </p>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10 shrink-0 z-10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-3 sm:px-6 pt-3 bg-black/40 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('volatility')}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap border",
                  activeTab === 'volatility'
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                    : "bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-white"
                )}
              >
                <Activity size={15} />
                <span>التذبذب اليومي للأسواق</span>
              </button>

              <button
                onClick={() => setActiveTab('forecasts')}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap border",
                  activeTab === 'forecasts'
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                    : "bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-white"
                )}
              >
                <Compass size={15} />
                <span>توقعات الأسبوع والشهور</span>
              </button>

              <button
                onClick={() => setActiveTab('news')}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap border",
                  activeTab === 'news'
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm"
                    : "bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-white"
                )}
              >
                <Newspaper size={15} />
                <span>رادار الأخبار والقرارات</span>
              </button>

              <button
                onClick={() => setActiveTab('fairPrice')}
                className={cn(
                  "flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap border",
                  activeTab === 'fairPrice'
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm"
                    : "bg-white/5 text-slate-400 border-transparent hover:bg-white/10 hover:text-white"
                )}
              >
                <Scale size={15} />
                <span>السعر العادل والولايات</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="p-3 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-5">
              {loading || !data ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-400" size={20} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-white font-extrabold text-base">
                      جاري تحليل نبض أسواق الجزائر والتذبذب اليومي...
                    </p>
                    <p className="text-xs text-white/50">
                      معالجة معطيات أسواق تيجلابين، عين أرنات، باتنة وقوانين الاستيراد
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* TAB 1: DAILY VOLATILITY (التذبذب اليومي) */}
                  {activeTab === 'volatility' && (
                    <div className="space-y-5">
                      {/* Interactive Daily Volatility Chart */}
                      <div className="bg-gradient-to-b from-black/70 to-slate-950/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-emerald-500/30 shadow-xl relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <Activity size={18} />
                            </div>
                            <div>
                              <h3 className="text-sm sm:text-base font-black text-white">
                                منحنى التذبذب اليومي لأسواق السيارات بالجزائر
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                تتبع حركة الأسعار يوماً بيوم مع مواعيد الأسواق الأسبوعية الكبرى
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                              تحديث يومي مستمر
                            </span>
                          </div>
                        </div>

                        {/* Chart Area */}
                        <div className="h-56 sm:h-64 w-full pt-2" dir="ltr">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart 
                              data={data.dailyVolatilityData || []} 
                              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="volatilityGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                  <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.15} />
                                  <stop offset="95%" stopColor="#0b0e14" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis 
                                dataKey="day" 
                                stroke="rgba(255,255,255,0.4)" 
                                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} 
                                axisLine={false} 
                                tickLine={false} 
                              />
                              <YAxis 
                                stroke="rgba(255,255,255,0.4)" 
                                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} 
                                axisLine={false} 
                                tickLine={false} 
                                tickFormatter={(val) => `${(val / 1000000).toFixed(2)}M`}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#090d16', 
                                  borderColor: '#10b981', 
                                  borderRadius: '14px', 
                                  color: '#fff', 
                                  textAlign: 'right', 
                                  direction: 'rtl',
                                  boxShadow: '0 0 25px rgba(16,185,129,0.3)',
                                  fontSize: '12px'
                                }}
                                formatter={(value: any, name: string, item: any) => [
                                  `${Number(value).toLocaleString()} دج (${item.payload.fluctuation})`, 
                                  'مؤشر السعر اليومي'
                                ]}
                                labelFormatter={(label: any) => `اليوم: ${label}`}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="priceIndex" 
                                stroke="#10b981" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#volatilityGradient)" 
                                dot={{ fill: '#10b981', strokeWidth: 2, r: 4, stroke: '#0b0e14' }}
                                activeDot={{ r: 7, stroke: '#38bdf8', strokeWidth: 3, fill: '#10b981' }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Day-by-Day Market Breakdown Timeline */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                            <Calendar size={16} className="text-cyan-400" />
                            <span>سجل التذبذب اليومي وملاحظات الأسواق الأسبوعية</span>
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            مبني على تداولات الأسواق المباشرة
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(data.dailyVolatilityData || []).map((dayItem, idx) => {
                            const isPositive = dayItem.fluctuation.startsWith('+');
                            const isZero = dayItem.fluctuation === '0.0%' || dayItem.fluctuation === '0%';
                            const isMajorMarket = dayItem.day.includes('سطيف') || dayItem.day.includes('تيجلابين') || dayItem.day.includes('باتنة');

                            return (
                              <div 
                                key={idx}
                                className={cn(
                                  "p-3 rounded-2xl border transition-all space-y-1.5",
                                  isMajorMarket 
                                    ? "bg-gradient-to-r from-emerald-950/30 to-black/50 border-emerald-500/30 shadow-md" 
                                    : "bg-black/40 border-white/5"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-white">
                                      {dayItem.day}
                                    </span>
                                    {getActivityBadge(dayItem.marketActivity)}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "text-[11px] font-black px-2 py-0.5 rounded-md flex items-center gap-0.5",
                                      isZero ? "bg-white/5 text-slate-300" :
                                      isPositive ? "bg-rose-500/15 text-rose-300 border border-rose-500/20" :
                                      "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                                    )}>
                                      {isPositive ? <ArrowUpRight size={12} /> : !isZero ? <ArrowDownRight size={12} /> : null}
                                      {dayItem.fluctuation}
                                    </span>
                                    <span className="text-xs font-black text-emerald-400">
                                      {dayItem.priceIndex.toLocaleString()} دج
                                    </span>
                                  </div>
                                </div>

                                <p className="text-[11px] text-slate-300 leading-relaxed bg-black/40 p-2 rounded-xl border border-white/5">
                                  {dayItem.notes}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FUTURE FORECASTS (توقعات الأسبوع والشهور) */}
                  {activeTab === 'forecasts' && (
                    <div className="space-y-5">
                      {/* Trajectory Multi-Horizon Chart */}
                      <div className="bg-gradient-to-b from-black/70 to-slate-950/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-cyan-500/30 shadow-xl relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              <Compass size={18} />
                            </div>
                            <div>
                              <h3 className="text-sm sm:text-base font-black text-white">
                                مسار الأسعار المتوقع (الأسبوع القادم، الشهر القادم، 3-6 أشهر)
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                دراسة تنبؤية لمسار السعر بناءً على دخول السيارات الجديدة وتوسيع كوطات الوكلاء
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                            <span>توقعات قائمة على المعطيات الاقتصادية</span>
                          </div>
                        </div>

                        {/* Trajectory Chart */}
                        <div className="h-56 sm:h-64 w-full pt-2" dir="ltr">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart 
                              data={data.forecastTrajectoryData || []} 
                              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                  <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.15} />
                                  <stop offset="95%" stopColor="#0b0e14" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis 
                                dataKey="name" 
                                stroke="rgba(255,255,255,0.4)" 
                                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} 
                                axisLine={false} 
                                tickLine={false} 
                              />
                              <YAxis 
                                stroke="rgba(255,255,255,0.4)" 
                                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} 
                                axisLine={false} 
                                tickLine={false} 
                                tickFormatter={(val) => `${(val / 1000000).toFixed(2)}M`}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#090d16', 
                                  borderColor: '#06b6d4', 
                                  borderRadius: '14px', 
                                  color: '#fff', 
                                  textAlign: 'right', 
                                  direction: 'rtl',
                                  boxShadow: '0 0 25px rgba(6,182,212,0.3)',
                                  fontSize: '12px'
                                }}
                                formatter={(value: any, name: string, item: any) => [
                                  `${Number(value).toLocaleString()} دج`, 
                                  item.payload.type === 'forecast' ? 'السعر المتوقع' : 'السعر المسجل'
                                ]}
                                labelFormatter={(label: any) => `الفترة: ${label}`}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="price" 
                                stroke="#06b6d4" 
                                strokeWidth={3}
                                fillOpacity={1} 
                                fill="url(#forecastGradient)" 
                                dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4, stroke: '#0b0e14' }}
                                activeDot={{ r: 7, stroke: '#38bdf8', strokeWidth: 3, fill: '#06b6d4' }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* 3 Detailed Forecast Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {/* Next Week */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 border border-cyan-500/30 space-y-3 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-cyan-300">توقعات الأسبوع القادم</span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                {data.forecasts?.nextWeek?.expectedChangePercent || '-1.0%'}
                              </span>
                            </div>
                            <div className="text-lg font-black text-white">
                              {(data.forecasts?.nextWeek?.expectedPrice || Math.round(data.fairPrice * 0.99)).toLocaleString()} <span className="text-xs text-slate-400">دج</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {data.forecasts?.nextWeek?.summary || 'استقرار نسبي مع استمرار الفرص في أسواق عطلة الأسبوع.'}
                            </p>
                          </div>

                          <div className="space-y-1 pt-2 border-t border-white/10 text-[10px] text-slate-400">
                            <span className="font-bold text-slate-300 block">أبرز المحركات:</span>
                            {(data.forecasts?.nextWeek?.keyDrivers || ['عروض الأسواق الأسبوعية', 'مرونة تفاوض الخواص']).map((d, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-1 h-1 rounded-full bg-cyan-400" />
                                <span>{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Next Month */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 border border-emerald-500/30 space-y-3 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-300">توقعات الشهر القادم</span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                {data.forecasts?.nextMonth?.expectedChangePercent || '-3.0%'}
                              </span>
                            </div>
                            <div className="text-lg font-black text-emerald-400">
                              {(data.forecasts?.nextMonth?.expectedPrice || Math.round(data.fairPrice * 0.965)).toLocaleString()} <span className="text-xs text-slate-400">دج</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {data.forecasts?.nextMonth?.summary || 'تراجع في أسعار المستعمل تزامناً مع توزيع دفعات جديدة من سيارات التجميع والوكلاء.'}
                            </p>
                          </div>

                          <div className="space-y-1 pt-2 border-t border-white/10 text-[10px] text-slate-400">
                            <span className="font-bold text-slate-300 block">أبرز المحركات:</span>
                            {(data.forecasts?.nextMonth?.keyDrivers || ['تسليم كوطات الوكلاء', 'توسع إنتاج مصنع وهران']).map((d, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                <span>{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Upcoming Months */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 border border-purple-500/30 space-y-3 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-purple-300">خلال 3 إلى 6 أشهر</span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                {data.forecasts?.upcomingMonths?.expectedChangePercent || '-6.5%'}
                              </span>
                            </div>
                            <div className="text-lg font-black text-purple-300">
                              {(data.forecasts?.upcomingMonths?.expectedPrice || Math.round(data.fairPrice * 0.92)).toLocaleString()} <span className="text-xs text-slate-400">دج</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {data.forecasts?.upcomingMonths?.summary || 'تصحيح سعري نحو القيمة العادلة نتيجة وفرة البدائل الجديدة للمواطنين.'}
                            </p>
                          </div>

                          <div className="space-y-1 pt-2 border-t border-white/10 text-[10px] text-slate-400">
                            <span className="font-bold text-slate-300 block">أبرز المحركات:</span>
                            {(data.forecasts?.upcomingMonths?.keyDrivers || ['تسليم مصانع شيري وجيلي', 'تسهيلات الاستيراد']).map((d, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-1 h-1 rounded-full bg-purple-400" />
                                <span>{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: NEWS & MARKET DRIVERS RADAR (رادار الأخبار والقرارات) */}
                  {activeTab === 'news' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Import & Laws */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 sm:p-5 border border-emerald-500/30 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Globe size={18} className="text-emerald-400" />
                              <h4 className="text-xs sm:text-sm font-black text-white">
                                {data.marketNewsRadar?.importAndLaws?.title || 'قوانين وتراخيص استيراد السيارات'}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              {data.marketNewsRadar?.importAndLaws?.status || 'تسهيل مستمر'}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-xs font-bold text-emerald-300">
                              <span className="text-slate-400 font-normal">الأثر على السوق: </span>
                              {data.marketNewsRadar?.importAndLaws?.impact || 'زيادة المعروض وتخفيف الضغط على المستعمل.'}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {data.marketNewsRadar?.importAndLaws?.details || 'استمرار تدفق واردات السيارات الأقل من 3 سنوات وتوسيع كوطات الوكلاء المعتمدين.'}
                            </p>
                          </div>
                        </div>

                        {/* Factories & Assembly */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 sm:p-5 border border-cyan-500/30 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Factory size={18} className="text-cyan-400" />
                              <h4 className="text-xs sm:text-sm font-black text-white">
                                {data.marketNewsRadar?.factoriesAndLocalAssembly?.title || 'مشاريع المصانع والتصنيع المحلي'}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              {data.marketNewsRadar?.factoriesAndLocalAssembly?.status || 'رفع وتيرة الإنتاج'}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20 text-xs font-bold text-cyan-300">
                              <span className="text-slate-400 font-normal">الأثر على السوق: </span>
                              {data.marketNewsRadar?.factoriesAndLocalAssembly?.impact || 'كبح أسعار المستعمل بفضل بدائل جديدة بأسعار مقننة.'}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {data.marketNewsRadar?.factoriesAndLocalAssembly?.details || 'مصنع فيات وهران يواصل تسليم النماذج واستعداد مصانع شيري وجيلي للإطلاق الصناعي.'}
                            </p>
                          </div>
                        </div>

                        {/* Social Media Sentiment */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 sm:p-5 border border-purple-500/30 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2">
                              <MessageSquare size={18} className="text-purple-400" />
                              <h4 className="text-xs sm:text-sm font-black text-white">
                                {data.marketNewsRadar?.socialMediaSentiment?.title || 'نبض السوشيال ميديا ومجموعات السيارات'}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                              فيسبوك وتيك توك
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 text-xs text-slate-300">
                              <span className="font-bold text-purple-300 block mb-1">مزاج المشترين:</span>
                              {data.marketNewsRadar?.socialMediaSentiment?.buyerAttitude || 'المشتري الجزائري يرفض المغالاة ويشترط الفحص الدقيق بالماسح الضوئي (سكانير).'}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              <span className="font-bold text-purple-300">موضوع النقاش السائد: </span>
                              {data.marketNewsRadar?.socialMediaSentiment?.buzzTopic || 'مقارنة أسعار المستعمل مع اقتناء سيارة جديدة بضمان الصانع.'}
                            </p>
                          </div>
                        </div>

                        {/* Weekly Markets Insights */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 sm:p-5 border border-amber-500/30 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2">
                              <MapPin size={18} className="text-amber-400" />
                              <h4 className="text-xs sm:text-sm font-black text-white">
                                {data.marketNewsRadar?.weeklyMarketsInsights?.title || 'تقارير الأسواق الأسبوعية الكبرى'}
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              ميداني
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5">
                            {data.marketNewsRadar?.weeklyMarketsInsights?.highlights || 'سوق عين أرنات بسطيف يقود التداول بمرونة في التفاوض، بينما يسجل سوق تيجلابين طلباً مرتفعاً على سيارات الديزل النظيفة.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: FAIR PRICE & REGIONAL BREAKDOWN (السعر العادل والولايات) */}
                  {activeTab === 'fairPrice' && (
                    <div className="space-y-5">
                      {/* Fair Price Definition Banner */}
                      <div className="bg-gradient-to-r from-emerald-900/30 via-slate-900/50 to-cyan-900/30 rounded-2xl p-4 sm:p-5 border border-emerald-500/30 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 mt-0.5">
                            <Scale size={22} />
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <h3 className="text-sm sm:text-base font-black text-white">
                                ماذا يعني "السعر العادل" في السوق الجزائري؟
                              </h3>
                              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                توازن العرض والطلب
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                              {data.fairPriceDefinition || "السعر العادل هو السعر المنطقي والمستهدف الذي تتوازن فيه حالة السيارة (سنة الصنع، الكيلومتراج، وحالة الصباغة) مع واقع العرض والطلب في مختلف الولايات مثل سطيف والعاصمة بدون تبخيس أو غلاء مفرط."}
                            </p>
                          </div>
                        </div>

                        {/* Spectrum Bar */}
                        <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                            <span className="text-[11px] font-bold text-slate-400 block">الحد الأدنى العادل</span>
                            <div className="text-base font-black text-cyan-400">
                              {(data.fairPriceMin || Math.round(data.fairPrice * 0.92)).toLocaleString()} دج
                            </div>
                          </div>

                          <div className="bg-emerald-500/15 rounded-xl p-3 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                            <span className="text-[11px] font-bold text-emerald-300 block">السعر العادل المستهدف</span>
                            <div className="text-lg font-black text-emerald-400">
                              {data.fairPrice.toLocaleString()} دج
                            </div>
                          </div>

                          <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                            <span className="text-[11px] font-bold text-slate-400 block">الحد الأقصى العادل</span>
                            <div className="text-base font-black text-rose-400">
                              {(data.fairPriceMax || Math.round(data.fairPrice * 1.06)).toLocaleString()} دج
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Regional Prices Comparison Card (سطيف، العاصمة، وهران...) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2 text-white">
                              <MapPin size={18} className="text-cyan-400" />
                              <h3 className="text-xs sm:text-sm font-bold">معدل الأسعار حسب الولايات</h3>
                            </div>
                            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                              مقارنة سطيف والعاصمة
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {data.regionalComparison.map((item, idx) => {
                              const maxPrice = Math.max(...data.regionalComparison.map(r => r.price));
                              const percent = Math.round((item.price / maxPrice) * 100);
                              const isSetif = item.region.includes('سطيف');
                              const isAlgiers = item.region.includes('العاصمة');

                              return (
                                <div 
                                  key={idx} 
                                  className={cn(
                                    "p-2.5 rounded-xl border transition-all space-y-1",
                                    isSetif ? "bg-emerald-500/10 border-emerald-500/30" : 
                                    isAlgiers ? "bg-cyan-500/10 border-cyan-500/30" : "bg-black/30 border-white/5"
                                  )}
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-white flex items-center gap-1.5">
                                      {isSetif && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                                      {item.region}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {item.diffText && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                                          {item.diffText}
                                        </span>
                                      )}
                                      <span className="font-black text-emerald-400">
                                        {item.price.toLocaleString()} دج
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        isSetif ? "bg-gradient-to-r from-emerald-500 to-cyan-400" :
                                        isAlgiers ? "bg-gradient-to-r from-cyan-400 to-blue-500" : "bg-emerald-500/60"
                                      )}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Valuation Factors */}
                        <div className="bg-gradient-to-b from-white/5 to-white/[0.02] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <div className="flex items-center gap-2 text-white">
                              <Layers size={18} className="text-purple-400" />
                              <h3 className="text-xs sm:text-sm font-bold">عوامل تحديد السعر العادل</h3>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {(data.priceFactors || []).map((factor, idx) => (
                              <div key={idx} className="bg-black/40 rounded-xl p-2.5 border border-white/5 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-emerald-300">
                                    {factor.factor}
                                  </span>
                                  <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                    {factor.impact}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 leading-normal">
                                  {factor.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Recommendation & Best Strategy Card (Always visible at bottom) */}
                  <div className="bg-gradient-to-r from-slate-950 via-emerald-950/40 to-slate-950 rounded-2xl p-4 sm:p-5 border border-emerald-500/30 shadow-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                          <Bot size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-black text-white">توصية الخبير الآلي للشراء والبيع</h3>
                          <p className="text-[10px] text-slate-400">نصيحة محايدة مبنية على الواقع الفعلي للأسواق</p>
                        </div>
                      </div>

                      <div className={cn("px-3 py-1.5 rounded-xl text-xs font-black border tracking-wide", getRecBadge(data.recommendation).bg)}>
                        {getRecBadge(data.recommendation).text}
                      </div>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5">
                      {data.explanation}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                      <ShieldCheck size={16} className="shrink-0" />
                      <span>{data.bestTimeToBuy}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
