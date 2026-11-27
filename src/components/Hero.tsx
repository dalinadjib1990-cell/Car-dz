import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, MapPin, Car, Star, PlusSquare, Activity, Bot,
  Loader2, CheckCircle2, AlertTriangle, Gauge, Fuel, Cpu,
  ArrowLeft, X, LineChart as LineChartIcon
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Ad } from '../types';
import { BRANDS, WILAYAS } from '../constants/data';
import { mergeAndDeduplicateAds, getStoredLocalAds } from '../utils/adUtils';
import { SmartSearchFilters } from './SmartSearchAssistant';
import MarketAnalysisPopup from './MarketAnalysisPopup';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface BestMatchItem {
  adId: string;
  matchScore: number;
  badgeLabel: string;
  reason: string;
  pros: string[];
  warnings: string[];
}

interface QuickSmartResponse {
  extractedFilters: SmartSearchFilters;
  bestMatches: BestMatchItem[];
  assistantSummary: string;
  suggestedRefinements?: string[];
}

const QUICK_AI_PROMPTS = [
  'سيارة اقتصادية في سطيف قل من 180 مليون',
  'محرك 1.5 dCi ماشية قل من 220 ألف كم',
  'Renault Symbol',
  'Hyundai Accent',
];

export default function Hero() {
  const [search, setSearch] = useState('');
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [brand, setBrand] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<QuickSmartResponse | null>(null);
  const [adsMap, setAdsMap] = useState<Map<string, Ad>>(new Map());
  const navigate = useNavigate();

  const loadLiveAds = async (): Promise<Ad[]> => {
    let fsAds: Ad[] = [];
    try {
      const snap = await getDocs(collection(db, 'ads'));
      fsAds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad));
    } catch (err) {
      console.warn('Hero live ads fetch notice:', err);
    }
    const merged = mergeAndDeduplicateAds(fsAds, getStoredLocalAds());
    setAdsMap(new Map(merged.map(a => [a.id, a])));
    return merged;
  };

  const runQuickSmartSearch = async (overrideText?: string) => {
    const typedText = overrideText !== undefined ? overrideText : search;
    const combinedParts = [
      typedText.trim(),
      brand ? `الماركة: ${brand}` : '',
      wilaya ? `الولاية: ${wilaya}` : '',
    ].filter(Boolean);

    const userQuery = combinedParts.join(' — ');
    if (!userQuery.trim()) {
      toast.error('اكتب مواصفات السيارة التي تبحث عنها في البحث السريع أولاً');
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const liveAds = await loadLiveAds();
      if (liveAds.length === 0) {
        setAiError('لا توجد إعلانات متاحة حالياً للبحث فيها.');
        setAiResult(null);
        return;
      }

      const response = await fetch('/api/gemini/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery,
          ads: liveAds,
        }),
      });

      if (!response.ok) {
        let errMsg = 'تعذر إتمام البحث الذكي حالياً، حاول مجدداً بعد قليل.';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        setAiError(errMsg);
        toast.error(errMsg);
        return;
      }

      const data: QuickSmartResponse = await response.json();
      setAiResult(data);
    } catch {
      const msg = 'تعذر الاتصال بخدمة البحث الذكي. تأكد من اتصالك وأعد المحاولة.';
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuickSmartSearch();
  };

  const handleGoToFullSearch = () => {
    const params = new URLSearchParams();
    const f = aiResult?.extractedFilters;
    if (f) {
      if (f.brand) params.set('brand', f.brand);
      if (f.wilaya) params.set('wilaya', f.wilaya);
      if (f.fuelType) params.set('fuelType', f.fuelType);
      if (f.engine) params.set('engine', f.engine);
      if (f.minPrice) params.set('minPrice', String(f.minPrice));
      if (f.maxPrice) params.set('maxPrice', String(f.maxPrice));
      if (f.maxMileage) params.set('maxMileage', String(f.maxMileage));
      if (f.minYear) params.set('minYear', String(f.minYear));
      if (f.maxYear) params.set('maxYear', String(f.maxYear));
      if (f.searchText) params.set('q', f.searchText);
    } else {
      if (search) params.set('q', search);
      if (brand) params.set('brand', brand);
      if (wilaya) params.set('wilaya', wilaya);
    }
    const qs = params.toString();
    navigate(qs ? `/search?${qs}` : '/search');
  };

  const defaultCarImg = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800';

  return (
    <div className="relative min-h-[620px] py-16 md:py-24 flex items-center justify-center overflow-x-hidden">
      {/* Background Image of Dark Car with Glowing Lights */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-105"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&q=80')" }}
      ></div>

      {/* Gradient overlays designed to keep the car's headlights visible while darkening the text area */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/45 to-[#0a0a0a]"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-transparent to-black/90"></div>
      
      {/* Animated Glowing Orbs */}
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-red-500/10 rounded-full blur-[100px] animate-pulse delay-700 pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl w-full px-4 text-center space-y-10">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold tracking-widest uppercase text-brand-green">
            <Star size={14} fill="currentColor" />
            المنصة رقم 1 في الجزائر 🇩🇿
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-tight drop-shadow-2xl">
            سوق السيارات <br />
            <span className="text-brand-green drop-shadow-[0_0_15px_rgba(0,102,51,0.5)]">الأول</span> في <span className="text-brand-red drop-shadow-[0_0_15px_rgba(210,16,52,0.5)]">الجزائر</span>
          </h1>
          <p className="text-lg md:text-2xl text-white/65 max-w-3xl mx-auto font-medium leading-relaxed">
            اكتشف آلاف العروض يومياً. بيع وشراء السيارات أصبح أسهل، أسرع، وأكثر أماناً مع <span className="text-white font-bold">Market Auto DZ</span>.
          </p>
          <div className="pt-2 flex flex-col md:flex-row flex-wrap items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/post')}
              className="btn-primary !py-4 !px-8 text-lg sm:text-xl shadow-[0_0_30px_rgba(0,102,51,0.3)] hover:scale-105 transition-all flex items-center gap-3"
            >
              <PlusSquare size={22} />
              انشر إعلانك الآن مجاناً
            </button>
            
            <button 
              onClick={() => setShowMarketAnalysis(true)}
              className="btn-secondary !bg-emerald-500/10 !border-emerald-500/30 !text-emerald-400 !py-4 !px-8 text-base sm:text-lg shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:scale-105 hover:bg-emerald-500/20 transition-all flex items-center gap-3 backdrop-blur-md"
            >
              <LineChartIcon size={22} className="drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              تحليل السوق والتوقعات
            </button>

            <a 
              href="https://chat-gpt-emploi.vercel.app/?fbclid=IwcGRvZgNleHRuA2FlbQIxMQBzcnRjBmFwcF9pZA8yNzUyNTQ2OTI1OTgyNzkAAR6hFdfEel-xLQZmdTOSDcD7SM1700ErYvuHdG75jZf3HaCgN15frINNGicFJQ_aem_wFQP2v-eI0txFtI_BFu_Bg"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary !bg-cyan-500/10 !border-cyan-500/30 !text-cyan-400 !py-4 !px-8 text-base sm:text-lg shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-105 hover:bg-cyan-500/20 transition-all flex items-center gap-3 backdrop-blur-md"
            >
              <Activity size={22} className="animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              تشخيص سيارتي الذكي
            </a>
          </div>
        </div>

        {/* Quick Search Bar with Integrated Smart AI Assistant */}
        <div className="space-y-4 text-right" dir="rtl">
          <form onSubmit={handleFormSubmit} className="glass-card p-3 flex flex-col md:flex-row gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/15 bg-black/60 backdrop-blur-xl">
            <div className="flex-1 relative group">
              <Bot className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:scale-110 transition-transform" size={22} />
              <input
                type="text"
                placeholder="اكتب للمساعد الذكي ما تبحث عنه (مثلاً: سيارة في سطيف 1.5 dCi قل من 180 مليون)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 rounded-xl py-4 md:py-5 pr-12 pl-4 outline-none text-sm sm:text-base md:text-lg border border-transparent focus:border-brand-green/40 transition-all text-white placeholder:text-white/40"
              />
            </div>
            
            <div className="w-full md:w-44 relative group">
              <Car className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-green transition-colors" size={20} />
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-white/5 rounded-xl py-4 md:py-5 pr-11 pl-4 outline-none appearance-none cursor-pointer border border-transparent focus:border-brand-green/40 transition-all text-sm sm:text-base text-white"
              >
                <option value="" className="bg-[#0a0a0a]">كل الماركات</option>
                {BRANDS.map(b => <option key={b} value={b} className="bg-[#0a0a0a]">{b}</option>)}
              </select>
            </div>

            <div className="w-full md:w-44 relative group">
              <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-brand-green transition-colors" size={20} />
              <select
                value={wilaya}
                onChange={(e) => setWilaya(e.target.value)}
                className="w-full bg-white/5 rounded-xl py-4 md:py-5 pr-11 pl-4 outline-none appearance-none cursor-pointer border border-transparent focus:border-brand-green/40 transition-all text-sm sm:text-base text-white"
              >
                <option value="" className="bg-[#0a0a0a]">كل الولايات</option>
                {WILAYAS.map(w => <option key={w} value={w} className="bg-[#0a0a0a]">{w}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={aiLoading}
                className="btn-primary flex-1 md:flex-initial flex items-center justify-center gap-2 min-w-[165px] !py-4 md:!py-5 text-sm sm:text-base shadow-2xl hover:scale-[1.02] transition-transform whitespace-nowrap disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <Loader2 size={19} className="animate-spin" />
                    جاري الاختيار...
                  </>
                ) : (
                  <>
                    <Bot size={19} />
                    بحث ذكي (أفضل خيار)
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleGoToFullSearch}
                className="btn-secondary !bg-white/5 !border-white/15 !text-white/85 hover:!bg-white/10 flex items-center justify-center gap-2 !py-4 md:!py-5 !px-4 text-sm whitespace-nowrap"
                title="تصفح كل الإعلانات في صفحة البحث"
              >
                <Search size={18} />
                <span className="hidden sm:inline">كل النتائج</span>
              </button>
            </div>
          </form>

          {/* Quick Suggested Prompts */}
          <div className="flex flex-wrap justify-center items-center gap-2.5 text-xs sm:text-sm text-white/50">
            <span className="font-bold">جرب البحث السريع:</span>
            {QUICK_AI_PROMPTS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSearch(tag);
                  runQuickSmartSearch(tag);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-brand-green/20 border border-white/10 hover:border-brand-green/40 text-slate-200 hover:text-emerald-300 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Inline Error Box */}
          {aiError && !aiLoading && (
            <div className="glass-card border border-rose-500/35 bg-rose-950/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-rose-200 font-bold">{aiError}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runQuickSmartSearch()}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 text-xs font-bold border border-rose-400/30"
                >
                  إعادة المحاولة
                </button>
                <button
                  type="button"
                  onClick={() => setAiError(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70"
                  aria-label="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Inline Quick Smart Search Best Option Results */}
          {aiResult && !aiLoading && (
            <div className="glass-card border border-emerald-500/40 bg-[#0b111b]/95 p-5 sm:p-6 space-y-5 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-white">
                      نتيجة المساعد الذكي في البحث السريع
                    </h2>
                    <p className="text-xs text-emerald-300 font-medium mt-0.5">
                      {aiResult.assistantSummary}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleGoToFullSearch}
                    className="text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>كل النتائج في صفحة البحث</span>
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiResult(null)}
                    aria-label="إغلاق النتيجة"
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center border border-white/10"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Extracted Filters Line */}
              {aiResult.extractedFilters && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 font-bold tabular-nums bg-white/[0.03] px-3.5 py-2.5 rounded-xl border border-white/10">
                  <span className="text-emerald-400">معايير الفهم الذكي:</span>
                  {aiResult.extractedFilters.brand && <span>الماركة: {aiResult.extractedFilters.brand}</span>}
                  {aiResult.extractedFilters.wilaya && <span>· الولاية: {aiResult.extractedFilters.wilaya}</span>}
                  {aiResult.extractedFilters.fuelType && <span>· الطاقة: {aiResult.extractedFilters.fuelType}</span>}
                  {aiResult.extractedFilters.engine && <span>· المحرك: {aiResult.extractedFilters.engine}</span>}
                  {aiResult.extractedFilters.maxPrice && (
                    <span>· السعر الأقصى: {Math.round(aiResult.extractedFilters.maxPrice / 10000)} مليون</span>
                  )}
                  {aiResult.extractedFilters.minPrice && (
                    <span>· السعر الأدنى: {Math.round(aiResult.extractedFilters.minPrice / 10000)} مليون</span>
                  )}
                  {aiResult.extractedFilters.maxMileage && (
                    <span>· المسافة: أقل من {aiResult.extractedFilters.maxMileage.toLocaleString()} كم</span>
                  )}
                  {!aiResult.extractedFilters.brand &&
                    !aiResult.extractedFilters.wilaya &&
                    !aiResult.extractedFilters.maxPrice &&
                    !aiResult.extractedFilters.engine &&
                    aiResult.extractedFilters.searchText && (
                      <span>البحث عن: {aiResult.extractedFilters.searchText}</span>
                    )}
                </div>
              )}

              {/* Best Matching Ads */}
              {aiResult.bestMatches && aiResult.bestMatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiResult.bestMatches.slice(0, 3).map((match, idx) => {
                    const ad = adsMap.get(match.adId);
                    if (!ad) return null;
                    const img = ad.images?.[0] || defaultCarImg;
                    const isTopPick = idx === 0;
                    const millions = Math.round((ad.price || 0) / 10000);

                    return (
                      <Link
                        key={match.adId}
                        to={`/ad/${ad.id}`}
                        className={cn(
                          'group rounded-2xl border p-4 flex flex-col gap-3 transition-colors hover:bg-white/[0.06]',
                          isTopPick
                            ? 'bg-emerald-500/10 border-emerald-500/50 md:col-span-2'
                            : 'bg-white/[0.03] border-white/10'
                        )}
                      >
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="w-full sm:w-44 aspect-[4/3] rounded-xl overflow-hidden bg-white/5 shrink-0">
                            <img
                              src={img}
                              alt={ad.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>

                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <span className={cn(
                                  'text-[11px] font-black',
                                  isTopPick ? 'text-emerald-400' : 'text-cyan-400'
                                )}>
                                  {isTopPick ? 'أفضل خيار مناسب لطلبك (#1)' : `خيار بديل #${idx + 1}`} · {match.badgeLabel}
                                </span>
                                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-emerald-400 transition-colors truncate">
                                  {ad.title}
                                </h3>
                              </div>
                              <div className="text-left tabular-nums">
                                <p className="text-base sm:text-lg font-black text-emerald-400">
                                  {ad.price.toLocaleString()} دج
                                </p>
                                <p className="text-xs font-bold text-slate-300">
                                  ({millions} مليون) · تطابق {match.matchScore}%
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 tabular-nums">
                              <span className="flex items-center gap-1"><MapPin size={13} className="text-emerald-400" /> {ad.wilaya}</span>
                              <span className="flex items-center gap-1"><Gauge size={13} className="text-emerald-400" /> {(ad.mileage || 0).toLocaleString()} كم</span>
                              <span className="flex items-center gap-1"><Fuel size={13} className="text-emerald-400" /> {ad.fuelType}</span>
                              {ad.engine && <span className="flex items-center gap-1"><Cpu size={13} className="text-emerald-400" /> {ad.engine}</span>}
                            </div>

                            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                              {match.reason}
                            </p>

                            {(match.pros?.length > 0 || match.warnings?.length > 0) && (
                              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                                {match.pros?.slice(0, 2).map((p, i) => (
                                  <span key={i} className="flex items-center gap-1 text-emerald-300">
                                    <CheckCircle2 size={13} className="shrink-0" />
                                    {p}
                                  </span>
                                ))}
                                {match.warnings?.slice(0, 1).map((w, i) => (
                                  <span key={i} className="flex items-center gap-1 text-amber-300">
                                    <AlertTriangle size={13} className="shrink-0" />
                                    {w}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end text-xs font-bold text-emerald-400 gap-1 pt-1 border-t border-white/5">
                          <span>افتح الإعلان وشاهد الصور والتفاصيل</span>
                          <ArrowLeft size={14} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs sm:text-sm text-amber-300 font-bold">
                    لم نجد سيارة مطابقة تماماً لهذه المواصفات حالياً في المنشورات المتاحة.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoToFullSearch}
                    className="btn-secondary text-xs !py-2 !px-4"
                  >
                    عرض أقرب السيارات المتاحة في صفحة البحث
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <MarketAnalysisPopup isOpen={showMarketAnalysis} onClose={() => setShowMarketAnalysis(false)} />
    </div>
  );
}

