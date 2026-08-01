import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Pause, Play, Eye, Image as ImageIcon } from 'lucide-react';

interface CarImage {
  url: string;
  title: string;
  subtitle: string;
}

const CAR_IMAGES: CarImage[] = [
  {
    url: 'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?q=80&w=2400&auto=format&fit=crop',
    title: 'Lamborghini Revuelto',
    subtitle: 'سوبركار إيطالية فاخرة'
  },
  {
    url: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?q=80&w=2400&auto=format&fit=crop',
    title: 'Porsche 911 GT3 RS',
    subtitle: 'أسطورة السرعة والأداء'
  },
  {
    url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=2400&auto=format&fit=crop',
    title: 'Mercedes-AMG GT Coupe',
    subtitle: 'الفخامة الرياضية الألمانية'
  },
  {
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2400&auto=format&fit=crop',
    title: 'Porsche Panamera Turbo',
    subtitle: 'أناقة وتكنولوجيا عالية'
  },
  {
    url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=2400&auto=format&fit=crop',
    title: 'BMW M4 Competition',
    subtitle: 'قوة الأداء الألماني المتفوق'
  },
  {
    url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=2400&auto=format&fit=crop',
    title: 'Range Rover Autobiography',
    subtitle: 'فخامة الدفع الرباعي بلا حدود'
  },
  {
    url: 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?q=80&w=2400&auto=format&fit=crop',
    title: 'Mercedes-Maybach S-Class',
    subtitle: 'قمة الرفاهية والراحة'
  },
  {
    url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=2400&auto=format&fit=crop',
    title: 'BMW M8 Gran Coupe',
    subtitle: 'التصميم البانورامي الجذاب'
  },
  {
    url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2400&auto=format&fit=crop',
    title: 'Audi R8 V10 Performance',
    subtitle: 'تصميم خارق وإضاءة ليلية تحفة'
  }
];

export function BackgroundSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [clearView, setClearView] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([0]));

  // Preload all car images on mount for ultra-fast loading
  useEffect(() => {
    CAR_IMAGES.forEach((car, index) => {
      const img = new Image();
      img.src = car.url;
      img.onload = () => {
        setLoadedImages(prev => new Set(prev).add(index));
      };
    });
  }, []);

  // Slideshow timer with auto-advance
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CAR_IMAGES.length);
    }, 8000); // 8 seconds per panoramic view

    return () => clearInterval(timer);
  }, [isPlaying]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % CAR_IMAGES.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + CAR_IMAGES.length) % CAR_IMAGES.length);
  };

  const currentCar = CAR_IMAGES[currentIndex];

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black select-none">
      {/* Background Panoramic Images */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.08, x: currentIndex % 2 === 0 ? '-1%' : '1%' }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            x: '0%',
            transition: { 
              opacity: { duration: 1.8, ease: "easeInOut" }, 
              scale: { duration: 8, ease: "linear" },
              x: { duration: 8, ease: "linear" }
            } 
          }}
          exit={{ opacity: 0, transition: { duration: 1.5, ease: "easeInOut" } }}
          className="absolute inset-0 w-full h-full"
        >
          <img
            src={currentCar.url}
            alt={currentCar.title}
            className="w-full h-full object-cover object-center"
            loading="eager"
            decoding="async"
          />
        </motion.div>
      </AnimatePresence>

      {/* Dark Blur Overlay (Adjustable for Clear Panoramic View) */}
      <div 
        className={`absolute inset-0 transition-all duration-700 pointer-events-none ${
          clearView 
            ? 'bg-black/35 backdrop-blur-[1px]' 
            : 'bg-[#0a0a0a]/82 backdrop-blur-[4px]'
        }`}
      />

      {/* Subtle Panoramic Controls & Specs Widget (Bottom Left) */}
      <div className="fixed bottom-24 md:bottom-6 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl text-white/80">
        <div className="flex items-center gap-1 pl-2 border-r border-white/10">
          <button
            onClick={handlePrev}
            title="السيارة السابقة"
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "إيقاف مؤقت" : "تشغيل تلقائي"}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-brand-green hover:text-white"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <button
            onClick={handleNext}
            title="السيارة التالية"
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Current Car Info */}
        <div className="px-2 text-right hidden sm:block">
          <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
            {currentCar.title}
          </div>
          <div className="text-[10px] text-white/50">{currentCar.subtitle}</div>
        </div>

        {/* Clear View Toggle */}
        <button
          onClick={() => setClearView(!clearView)}
          title={clearView ? "تغطية عادية" : "استعراض الخلفية بوضوح"}
          className={`p-2 rounded-xl transition-all ${
            clearView 
              ? 'bg-brand-green text-white shadow-lg shadow-brand-green/30' 
              : 'hover:bg-white/10 text-white/60 hover:text-white'
          }`}
        >
          <Eye size={16} />
        </button>

        {/* Dots Indicator */}
        <div className="flex items-center gap-1 px-1">
          {CAR_IMAGES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex ? 'w-4 bg-brand-green' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

