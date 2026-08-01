import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Gauge, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { Ad } from '../types';
import { cn } from '../lib/utils';

export const AdCard: React.FC<{ ad: Ad }> = ({ ad }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const templateClass = ad.template === 'commercial' ? 'border-brand-green/30 shadow-brand-green/5' :
                        ad.template === 'attractive' ? 'border-brand-red/30 shadow-brand-red/5' :
                        ad.template === 'special' ? 'border-amber-500/30 shadow-amber-500/5' :
                        'border-white/10';

  const defaultImage = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800';
  const coverImage = (ad.images && ad.images.length > 0 && ad.images[0]) ? ad.images[0] : defaultImage;

  return (
    <Link to={`/ad/${ad.id}`} className={cn(
      "group glass-card overflow-hidden transition-all duration-300 hover:-translate-y-1.5 border-2 flex flex-col justify-between",
      templateClass,
      ad.template === 'special' && "bg-gradient-to-br from-amber-500/5 to-transparent"
    )}>
      <div className="relative aspect-[4/3] sm:aspect-[4/3] overflow-hidden bg-white/5">
        {/* Loading Skeleton */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
            <ImageIcon className="text-white/20 animate-bounce" size={24} />
          </div>
        )}

        <img 
          src={imageError ? defaultImage : coverImage} 
          alt={ad.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={cn(
            "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
        />
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end z-10">
          <div className="bg-brand-green/90 backdrop-blur-xl text-white text-xs font-black px-3.5 py-1.5 rounded-2xl shadow-2xl border border-white/20 ring-1 ring-white/10">
            {ad.price ? ad.price.toLocaleString() : '---'} دج
          </div>
          {ad.samouni && (
            <div className="bg-brand-red/90 backdrop-blur-xl text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-2xl border border-white/20 ring-1 ring-white/10">
              ساموني: {ad.samouni.toLocaleString()}
            </div>
          )}
        </div>
        {ad.isVerified && (
          <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-md text-white p-1.5 rounded-lg border border-white/20">
            <CheckCircle2 size={16} className="text-brand-green" />
          </div>
        )}
        {ad.status === 'sold' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
            <div className="bg-brand-red text-white text-[10px] font-black px-4 py-1.5 rounded-full rotate-[-15deg] shadow-2xl border-2 border-white/20 animate-pulse uppercase tracking-widest">
              Vendu / تم البيع
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3 sm:p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-base sm:text-lg group-hover:text-brand-green transition-colors line-clamp-1">{ad.title}</h3>
          <p className="text-white/40 text-xs sm:text-sm">{ad.brand} {ad.model}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-white/60 text-[10px] sm:text-xs">
            <Calendar size={12} className="text-brand-green shrink-0" />
            <span className="truncate">{ad.year || '---'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/60 text-[10px] sm:text-xs">
            <Gauge size={12} className="text-brand-green shrink-0" />
            <span className="truncate">{ad.mileage ? ad.mileage.toLocaleString() : '---'} كم</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/60 text-[10px] sm:text-xs">
            <MapPin size={12} className="text-brand-green shrink-0" />
            <span className="truncate">{ad.wilaya || 'الجزائر'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/60 text-[10px] sm:text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-green shrink-0"></div>
            <span className="truncate">{ad.fuelType || 'بنزين'}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
          <span className="text-[9px] sm:text-[10px] text-white/30 uppercase tracking-wider font-bold">
            {ad.createdAt?.seconds 
              ? new Date(ad.createdAt.seconds * 1000).toLocaleDateString('ar-DZ') 
              : 'الآن'}
          </span>
          {ad.isNegotiable && (
            <span className="text-[10px] bg-brand-red/10 text-brand-red px-2 py-0.5 rounded font-bold">
              قابل للتفاوض
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

