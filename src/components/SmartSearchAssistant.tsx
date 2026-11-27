import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, Search, Loader2, CheckCircle2, AlertTriangle,
  MapPin, Gauge, Fuel, Cpu, ArrowLeft, X
} from 'lucide-react';
import { Ad } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export interface SmartSearchFilters {
  brand?: string | null;
  wilaya?: string | null;
  fuelType?: string | null;
  engine?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  maxMileage?: number | null;
  minYear?: number | null;
  maxYear?: number | null;
  searchText?: string | null;
}

interface BestMatchItem {
  adId: string;
  matchScore: number;
  badgeLabel: string;
  reason: string;
  pros: string[];
  warnings: string[];
}

interface SmartSearchResponse {
  extractedFilters: SmartSearchFilters;
  bestMatches: BestMatchItem[];
  assistantSummary: string;
  suggestedRefinements: string[];
}

interface SmartSearchAssistantProps {
  allAds: Ad[];
  initialQuery?: string;
  onApplyFilters: (filters: SmartSearchFilters) => void;
  onResetFilters: () => void;
}

const EXAMPLE_PROMPTS = [
  'سيارة اقتصادية في سطيف بسعر قل من 180 مليون',
  'محرك 1.5 dCi ديزل ماشية قل من 220 ألف كم',
  'سيارة نظيفة بالغاز GPL في الجزائر العاصمة',
  'أفضل سيارة عائلية بين 150 و 250 مليون',
];

export default function SmartSearchAssistant({
  allAds,
  initialQuery = '',
  onApplyFilters,
  onResetFilters,
}: SmartSearchAssistantProps) {
  const [queryText, setQueryText] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartSearchResponse | null>(null);
  const [hasAutoRun, setHasAutoRun] = useState(false);

  const runSmartSearch = async (promptToRun: string) => {
    const cleanPrompt = promptToRun.trim();
    if (!cleanPrompt) {
      toast.error('اكتب مواصفات السيارة التي تبحث عنها أولاً');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/gemini/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery: cleanPrompt,
          ads: allAds,
        }),
      });

      if (!response.ok) {
        let errMsg = 'تعذر إتمام البحث الذكي حالياً';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        toast.error(errMsg);
        return;
      }

      const data: SmartSearchResponse = await response.json();
      setResult(data);
      if (data.extractedFilters) {
        onApplyFilters(data.extractedFilters);
      }
    } catch {
      toast.error('تعذر الاتصال بخدمة البحث الذكي. حاول مجدداً بعد قليل.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery && allAds.length > 0 && !hasAutoRun) {
      setHasAutoRun(true);
      setQueryText(initialQuery);
      runSmartSearch(initialQuery);
    }
  }, [initialQuery, allAds.length, hasAutoRun]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSmartSearch(queryText);
  };

  const handleClear = () => {
    setQueryText('');
    setResult(null);
    onResetFilters();
  };

  const adMap = new Map<string, Ad>(allAds.map(a => [a.id, a]));

  const defaultCarImg = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800';

  return (
    <section className="glass-card border border-brand-green/30 bg-slate-950/70 p-5 sm:p-6 space-y-5 shadow-xl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-green/20 border border-brand-green/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white">
              المساعد الذكي للبحث واختيار أفضل سيارة
            </h2>
            <p className="text-xs text-white/60">
              اكتب طلبك بحرية (السعر بالمليون، الولاية، المحرك، المسافة المقطوعة) وسأضبط الفلاتر وأختار لك الأفضل وسط المنشورات
            </p>
          </div>
        </div>
        {result && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 self-start sm:self-auto whitespace-nowrap"
          >
            <X size={14} />
            مسح اقتراحات المساعد
          </button>
        )}
      </div>

      {/* Natural Language Search Bar */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="مثال: أحوس على سيارة في سطيف محرك 1.5 dCi ماشية قل من 200 ألف بسعر حوالي 170 مليون..."
            className="w-full bg-white/5 border border-white/15 focus:border-brand-green rounded-xl py-3.5 pr-11 pl-4 text-sm sm:text-base text-white placeholder:text-white/35 outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary !py-3.5 !px-6 text-sm font-black flex items-center justify-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              جاري البحث الذكي...
            </>
          ) : (
            <>
              <Bot size={18} />
              ابحث واقترح الأفضل
            </>
          )}
        </button>
      </form>

      {/* Interactive Quick Prompts */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-white/40 ml-1">جرب مثلاً:</span>
        {EXAMPLE_PROMPTS.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setQueryText(sample);
              runSmartSearch(sample);
            }}
            className="text-xs font-medium bg-white/5 hover:bg-brand-green/20 text-slate-200 hover:text-emerald-300 border border-white/10 hover:border-brand-green/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            {sample}
          </button>
        ))}
      </div>

      {/* AI Results Panel */}
      {result && (
        <div className="pt-4 border-t border-white/10 space-y-5">
          {/* Assistant Summary & Applied Filters */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-slate-100 leading-relaxed font-medium">
              {result.assistantSummary}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-300 font-bold tabular-nums">
              <span className="text-white/50">الفلاتر المطبقة:</span>
              {result.extractedFilters.brand && <span>الماركة: {result.extractedFilters.brand}</span>}
              {result.extractedFilters.wilaya && <span>· الولاية: {result.extractedFilters.wilaya}</span>}
              {result.extractedFilters.fuelType && <span>· الطاقة: {result.extractedFilters.fuelType}</span>}
              {result.extractedFilters.engine && <span>· المحرك: {result.extractedFilters.engine}</span>}
              {result.extractedFilters.maxPrice && (
                <span>· السعر الأقصى: {Math.round(result.extractedFilters.maxPrice / 10000)} مليون</span>
              )}
              {result.extractedFilters.minPrice && (
                <span>· السعر الأدنى: {Math.round(result.extractedFilters.minPrice / 10000)} مليون</span>
              )}
              {result.extractedFilters.maxMileage && (
                <span>· المسافة: أقل من {result.extractedFilters.maxMileage.toLocaleString()} كم</span>
              )}
            </div>
          </div>

          {/* Ranked Best Matches */}
          {result.bestMatches && result.bestMatches.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm sm:text-base font-black text-white">
                أفضل الخيارات المقترحة لك من المنشورات ({result.bestMatches.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.bestMatches.map((match, idx) => {
                  const ad = adMap.get(match.adId);
                  if (!ad) return null;
                  const img = ad.images?.[0] || defaultCarImg;
                  const isTopPick = idx === 0;

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
                                {isTopPick ? 'الخيار الأفضل رقم 1' : `خيار مقترح #${idx + 1}`} · {match.badgeLabel}
                              </span>
                              <h4 className="text-base sm:text-lg font-black text-white group-hover:text-emerald-400 transition-colors truncate">
                                {ad.title}
                              </h4>
                            </div>
                            <div className="text-left tabular-nums">
                              <p className="text-base sm:text-lg font-black text-emerald-400">
                                {ad.price.toLocaleString()} دج
                              </p>
                              <p className="text-xs font-bold text-slate-400">
                                نسبة التطابق: {match.matchScore}%
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
                        <span>عرض صور وتفاصيل السيارة</span>
                        <ArrowLeft size={14} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-amber-300 font-bold">
              لم نجد تطابقاً كاملاً حالياً، تم ضبط الفلاتر لعرض أقرب النتائج المتاحة بالأسفل.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
