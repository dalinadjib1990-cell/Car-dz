import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Ad } from '../types';
import { AdCard } from '../components/AdCard';
import SmartSearchAssistant, { SmartSearchFilters } from '../components/SmartSearchAssistant';
import { Search as SearchIcon, Filter, X } from 'lucide-react';
import { BRANDS, WILAYAS, FUEL_TYPES, ENGINES } from '../constants/data';
import { cn } from '../lib/utils';
import { getStoredLocalAds, mergeAndDeduplicateAds } from '../utils/adUtils';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allAds, setAllAds] = useState<Ad[]>(getStoredLocalAds);
  const [ads, setAds] = useState<Ad[]>(getStoredLocalAds);
  const [loading, setLoading] = useState<boolean>(() => getStoredLocalAds().length === 0);
  const [showFilters, setShowFilters] = useState(false);

  const aiQueryParam = searchParams.get('aiQuery') || '';
  const qParam = searchParams.get('q') || '';
  const brandParam = searchParams.get('brand') || '';
  const wilayaParam = searchParams.get('wilaya') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const priceRange = searchParams.get('priceRange') || '';
  const mileageRange = searchParams.get('mileageRange') || '';
  const maxMileageParam = searchParams.get('maxMileage') || '';
  const fuelType = searchParams.get('fuelType') || '';
  const engineParam = searchParams.get('engine') || '';
  const minYear = searchParams.get('minYear') || '';
  const maxYear = searchParams.get('maxYear') || '';

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const applyFiltersToAds = (sourceAds: Ad[]) => {
      setAllAds(sourceAds);
      let results = sourceAds;

      if (brandParam) {
        results = results.filter(ad => ad.brand?.toLowerCase() === brandParam.toLowerCase());
      }
      if (wilayaParam) {
        results = results.filter(ad => ad.wilaya?.includes(wilayaParam) || wilayaParam.includes(ad.wilaya || ''));
      }
      if (fuelType) {
        results = results.filter(ad => ad.fuelType === fuelType);
      }
      if (engineParam) {
        const lowEng = engineParam.toLowerCase();
        results = results.filter(ad =>
          ad.engine?.toLowerCase().includes(lowEng) ||
          ad.title?.toLowerCase().includes(lowEng) ||
          ad.description?.toLowerCase().includes(lowEng)
        );
      }

      if (qParam) {
        const lowQ = qParam.toLowerCase();
        results = results.filter(ad =>
          ad.title?.toLowerCase().includes(lowQ) ||
          ad.description?.toLowerCase().includes(lowQ) ||
          ad.model?.toLowerCase().includes(lowQ) ||
          ad.brand?.toLowerCase().includes(lowQ) ||
          ad.engine?.toLowerCase().includes(lowQ)
        );
      }

      if (minPrice) results = results.filter(ad => ad.price >= Number(minPrice));
      if (maxPrice) results = results.filter(ad => ad.price <= Number(maxPrice));

      if (priceRange) {
        const factor = 10000;
        const [min, max] = priceRange.split('-').map(Number);
        if (max) {
          results = results.filter(ad => ad.price >= min * factor && ad.price <= max * factor);
        } else {
          results = results.filter(ad => ad.price >= min * factor);
        }
      }

      if (maxMileageParam) {
        results = results.filter(ad => (ad.mileage || 0) <= Number(maxMileageParam));
      }

      if (mileageRange) {
        if (mileageRange === '300000+') {
          results = results.filter(ad => (ad.mileage || 0) >= 300000);
        } else if (mileageRange === '<100000') {
          results = results.filter(ad => (ad.mileage || 0) < 100000);
        } else {
          const [min, max] = mileageRange.split('-').map(Number);
          results = results.filter(ad => (ad.mileage || 0) >= min && (ad.mileage || 0) <= max);
        }
      }

      if (minYear) results = results.filter(ad => ad.year >= Number(minYear));
      if (maxYear) results = results.filter(ad => ad.year <= Number(maxYear));

      setAds(results);
      setLoading(false);
    };

    const unsubscribe = onSnapshot(collection(db, 'ads'), (snap) => {
      clearTimeout(timer);
      const fsAds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad));
      const combined = mergeAndDeduplicateAds(fsAds);
      applyFiltersToAds(combined);
    }, (err) => {
      console.warn('Firestore search notice:', err);
      applyFiltersToAds(getStoredLocalAds());
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [qParam, brandParam, wilayaParam, minPrice, maxPrice, priceRange, mileageRange, maxMileageParam, fuelType, engineParam, minYear, maxYear]);

  const handleApplyAIFilters = (filters: SmartSearchFilters) => {
    const nextParams = new URLSearchParams();
    if (aiQueryParam) nextParams.set('aiQuery', aiQueryParam);
    if (filters.brand) nextParams.set('brand', filters.brand);
    if (filters.wilaya) nextParams.set('wilaya', filters.wilaya);
    if (filters.fuelType) nextParams.set('fuelType', filters.fuelType);
    if (filters.engine) nextParams.set('engine', filters.engine);
    if (filters.minPrice) nextParams.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) nextParams.set('maxPrice', String(filters.maxPrice));
    if (filters.maxMileage) nextParams.set('maxMileage', String(filters.maxMileage));
    if (filters.minYear) nextParams.set('minYear', String(filters.minYear));
    if (filters.maxYear) nextParams.set('maxYear', String(filters.maxYear));
    if (filters.searchText) nextParams.set('q', filters.searchText);
    setSearchParams(nextParams);
  };

  const updateSingleParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set(key, val);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">نتائج البحث</h1>
          <p className="text-white/40 tabular-nums">وجدنا {ads.length} سيارة مطابقة لبحثك</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 btn-secondary md:hidden self-start"
        >
          <Filter size={20} />
          تصفية يدوية
        </button>
      </div>

      {/* Smart AI Search & Filter Assistant */}
      <SmartSearchAssistant
        allAds={allAds}
        initialQuery={aiQueryParam}
        onApplyFilters={handleApplyAIFilters}
        onResetFilters={() => setSearchParams({})}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Filters Sidebar */}
        <aside className={cn(
          'lg:block space-y-8',
          showFilters ? 'fixed inset-0 z-[60] bg-[#0a0a0a]/95 backdrop-blur-md p-8 overflow-y-auto' : 'hidden'
        )}>
          <div className="flex items-center justify-between lg:hidden">
            <h2 className="text-2xl font-bold">تصفية النتائج</h2>
            <button onClick={() => setShowFilters(false)}><X size={24} /></button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">الماركة</h4>
              <select
                value={brandParam}
                onChange={(e) => updateSingleParam('brand', e.target.value)}
                className="input-field appearance-none"
              >
                <option value="" className="bg-[#0a0a0a]">كل الماركات</option>
                {BRANDS.map(b => <option key={b} value={b} className="bg-[#0a0a0a]">{b}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">الولاية</h4>
              <select
                value={wilayaParam}
                onChange={(e) => updateSingleParam('wilaya', e.target.value)}
                className="input-field appearance-none"
              >
                <option value="" className="bg-[#0a0a0a]">كل الولايات</option>
                {WILAYAS.map(w => <option key={w} value={w} className="bg-[#0a0a0a]">{w}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">المحرك</h4>
              <select
                value={engineParam}
                onChange={(e) => updateSingleParam('engine', e.target.value)}
                className="input-field appearance-none"
              >
                <option value="" className="bg-[#0a0a0a]">كل المحركات</option>
                {ENGINES.map(eng => <option key={eng} value={eng} className="bg-[#0a0a0a]">{eng}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">نوع الطاقة</h4>
              <select
                value={fuelType}
                onChange={(e) => updateSingleParam('fuelType', e.target.value)}
                className="input-field appearance-none"
              >
                <option value="" className="bg-[#0a0a0a]">كل الأنواع</option>
                {FUEL_TYPES.map(f => <option key={f} value={f} className="bg-[#0a0a0a]">{f}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">نطاق السعر (مليون سنتيم)</h4>
              <select
                value={priceRange}
                onChange={(e) => updateSingleParam('priceRange', e.target.value)}
                className="input-field appearance-none"
              >
                <option value="" className="bg-[#0a0a0a]">كل الأسعار</option>
                <option value="20-50" className="bg-[#0a0a0a]">20 - 50 مليون</option>
                <option value="50-80" className="bg-[#0a0a0a]">50 - 80 مليون</option>
                <option value="80-120" className="bg-[#0a0a0a]">80 - 120 مليون</option>
                <option value="120-160" className="bg-[#0a0a0a]">120 - 160 مليون</option>
                <option value="160-200" className="bg-[#0a0a0a]">160 - 200 مليون</option>
                <option value="200-250" className="bg-[#0a0a0a]">200 - 250 مليون</option>
                <option value="250-300" className="bg-[#0a0a0a]">250 - 300 مليون</option>
                <option value="300" className="bg-[#0a0a0a]">أكثر من 300 مليون</option>
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">المسافة المقطوعة (كم)</h4>
              <select
                value={mileageRange}
                onChange={(e) => updateSingleParam('mileageRange', e.target.value)}
                className="input-field appearance-none"
              >
                <option value="" className="bg-[#0a0a0a]">كل المسافات</option>
                <option value="<100000" className="bg-[#0a0a0a]">أقل من 100 ألف</option>
                <option value="100000-200000" className="bg-[#0a0a0a]">100 ألف - 200 ألف</option>
                <option value="200000-300000" className="bg-[#0a0a0a]">200 ألف - 300 ألف</option>
                <option value="300000+" className="bg-[#0a0a0a]">أكثر من 300 ألف</option>
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">السعر (دج)</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="من"
                  value={minPrice}
                  onChange={(e) => updateSingleParam('minPrice', e.target.value)}
                  className="input-field !py-2 text-base tabular-nums"
                />
                <input
                  type="number"
                  placeholder="إلى"
                  value={maxPrice}
                  onChange={(e) => updateSingleParam('maxPrice', e.target.value)}
                  className="input-field !py-2 text-base tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white/60">السنة</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="من"
                  value={minYear}
                  onChange={(e) => updateSingleParam('minYear', e.target.value)}
                  className="input-field !py-2 text-base tabular-nums"
                />
                <input
                  type="number"
                  placeholder="إلى"
                  value={maxYear}
                  onChange={(e) => updateSingleParam('maxYear', e.target.value)}
                  className="input-field !py-2 text-base tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <button
                onClick={() => setSearchParams({})}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl font-bold text-sm transition-all"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          </div>

          {showFilters && (
            <button
              onClick={() => setShowFilters(false)}
              className="w-full btn-primary mt-8"
            >
              تطبيق التصفية
            </button>
          )}
        </aside>

        {/* Results Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="glass-card aspect-[16/20] animate-pulse"></div>
              ))}
            </div>
          ) : ads.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {ads.map(ad => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 glass-card space-y-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <SearchIcon size={32} className="text-white/20" />
              </div>
              <p className="text-white/60 font-bold">لم نجد أي سيارة تطابق معايير الفلترة الحالية</p>
              <button
                onClick={() => setSearchParams({})}
                className="text-brand-green font-bold hover:underline"
              >
                إعادة ضبط البحث وعرض جميع الإعلانات
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
