'use client';

import { useState, useEffect, useCallback } from 'react';
import { AboutSectionData, AboutImageItem } from '@/types';
import {
  Mountain,
  Utensils,
  Flame,
  Wifi,
  HeartHandshake,
  Footprints,
  Compass,
  CheckCircle2,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface AboutSectionProps {
  data: AboutSectionData;
}

// Icon mapping helper
const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'Mountain':
      return <Mountain className="w-5 h-5 text-forest-700" />;
    case 'Utensils':
      return <Utensils className="w-5 h-5 text-forest-700" />;
    case 'Flame':
      return <Flame className="w-5 h-5 text-forest-700" />;
    case 'Wifi':
      return <Wifi className="w-5 h-5 text-forest-700" />;
    case 'HeartHandshake':
      return <HeartHandshake className="w-5 h-5 text-forest-700" />;
    case 'Footprints':
      return <Footprints className="w-5 h-5 text-forest-700" />;
    default:
      return <Compass className="w-5 h-5 text-forest-700" />;
  }
};

const DEFAULT_ABOUT_IMAGES: AboutImageItem[] = [
  {
    src: '/images/about/balcony-view.jpg',
    alt: 'Private mountain view balcony overlooking Himalayan valley',
    caption: 'Private Mountain Balcony',
    subtitle: 'Panoramic valley & sunrise vistas'
  },
  {
    src: '/images/about/bedroom-suite.jpg',
    alt: 'Handcrafted timber bedroom suite with balcony access',
    caption: 'Cedar Wood Suite',
    subtitle: 'Warm Himalayan comforts & privacy'
  },
  {
    src: '/images/about/traditional-lounge.jpg',
    alt: 'Artisanal Himalayan lounge with traditional Buddhist mural',
    caption: 'Artisanal Heritage Lounge',
    subtitle: 'Hand-painted Buddhist wall art'
  },
  {
    src: '/images/about/mountain-window.jpg',
    alt: 'Living room window framing snow-capped Kanchenjunga peaks',
    caption: 'Kanchenjunga Window View',
    subtitle: 'Morning Darjeeling tea by the peaks'
  }
];

export default function AboutSection({ data }: AboutSectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const normalizedImages: AboutImageItem[] = (() => {
    if (data.images && data.images.length >= 4) {
      return data.images.slice(0, 4).map((img, idx) => {
        if (typeof img === 'string') {
          return {
            src: img,
            alt: DEFAULT_ABOUT_IMAGES[idx]?.alt || 'Savera Homestay',
            caption: DEFAULT_ABOUT_IMAGES[idx]?.caption || 'Savera Homestay',
            subtitle: DEFAULT_ABOUT_IMAGES[idx]?.subtitle || ''
          };
        }
        return {
          src: img.src || DEFAULT_ABOUT_IMAGES[idx]?.src,
          alt: img.alt || DEFAULT_ABOUT_IMAGES[idx]?.alt || 'Savera Homestay',
          caption: img.caption || DEFAULT_ABOUT_IMAGES[idx]?.caption || 'Savera Homestay',
          subtitle: img.subtitle || DEFAULT_ABOUT_IMAGES[idx]?.subtitle || ''
        };
      });
    }
    return DEFAULT_ABOUT_IMAGES;
  })();

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
  };

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const showPrevImage = useCallback(() => {
    setLightboxIndex((curr) =>
      curr !== null ? (curr - 1 + normalizedImages.length) % normalizedImages.length : null
    );
  }, [normalizedImages.length]);

  const showNextImage = useCallback(() => {
    setLightboxIndex((curr) =>
      curr !== null ? (curr + 1) % normalizedImages.length : null
    );
  }, [normalizedImages.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrevImage();
      if (e.key === 'ArrowRight') showNextImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, closeLightbox, showPrevImage, showNextImage]);

  return (
    <section id="about" className="py-20 sm:py-28 bg-[#faf8f5] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-forest-600 bg-forest-100 px-3 py-1 rounded-full inline-block mb-3">
            The Homestay Story
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-forest-950 tracking-tight leading-tight mb-6">
            {data.headline}
          </h2>
          <div className="w-16 h-1 bg-sand-400 mx-auto rounded-full" />
        </div>

        {/* Narrative & Visual Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center mb-20">
          {/* Story Text */}
          <div className="lg:col-span-6 space-y-6 text-gray-700 leading-relaxed text-base sm:text-lg">
            <p className="first-letter:font-serif first-letter:text-5xl first-letter:font-bold first-letter:text-forest-800 first-letter:mr-3 first-letter:float-left">
              {data.story}
            </p>
            <p>
              Unlike commercial hotels, our homestay offers a true pause. Enjoy unhurried
              breakfasts overlooking orchards, take leisurely forest walks, or curl up with a book
              beside our traditional stone fireplace while our local hosts prepare wholesome meals.
            </p>

            <div className="pt-2 flex flex-wrap gap-3 sm:gap-4">
              <div className="flex items-center space-x-2 text-forest-900 font-medium text-xs sm:text-sm bg-white/80 border border-sand-200/80 px-3.5 py-2 rounded-xl shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0" />
                <span>Zero Commercial Clutter</span>
              </div>
              <div className="flex items-center space-x-2 text-forest-900 font-medium text-xs sm:text-sm bg-white/80 border border-sand-200/80 px-3.5 py-2 rounded-xl shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0" />
                <span>Dedicated On-Site Host</span>
              </div>
              <div className="flex items-center space-x-2 text-forest-900 font-medium text-xs sm:text-sm bg-white/80 border border-sand-200/80 px-3.5 py-2 rounded-xl shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0" />
                <span>Fresh Mountain Water & Air</span>
              </div>
            </div>
          </div>

          {/* Elegant Image Showcase */}
          <div className="lg:col-span-6 relative">
            {/* Subtle atmospheric glow behind photos */}
            <div className="absolute -inset-4 bg-sand-200/40 rounded-3xl blur-2xl -z-10 transform -rotate-1 pointer-events-none" />

            <div className="grid grid-cols-2 gap-3.5 sm:gap-5">
              {/* Column 1 */}
              <div className="space-y-3.5 sm:space-y-5">
                {/* 1. Balcony View (Portrait / Tall) */}
                <div
                  onClick={() => openLightbox(0)}
                  className="group relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer border border-sand-200/90 bg-sand-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={normalizedImages[0].src}
                    alt={normalizedImages[0].alt}
                    className="w-full h-64 sm:h-76 lg:h-80 object-cover object-top sm:object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-forest-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity duration-300" />
                  
                  {/* Hover expand badge */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-forest-900 shadow">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>

                  <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 text-white">
                    <p className="text-xs sm:text-sm font-semibold tracking-wide drop-shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sand-300 shrink-0" />
                      {normalizedImages[0].caption}
                    </p>
                    {normalizedImages[0].subtitle && (
                      <p className="text-[11px] text-sand-200/90 hidden sm:block mt-0.5 pl-3">
                        {normalizedImages[0].subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Bedroom Suite (Standard / Landscape) */}
                <div
                  onClick={() => openLightbox(1)}
                  className="group relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer border border-sand-200/90 bg-sand-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={normalizedImages[1].src}
                    alt={normalizedImages[1].alt}
                    className="w-full h-44 sm:h-52 lg:h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-forest-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity duration-300" />

                  {/* Hover expand badge */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-forest-900 shadow">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>

                  <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 text-white">
                    <p className="text-xs sm:text-sm font-semibold tracking-wide drop-shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sand-300 shrink-0" />
                      {normalizedImages[1].caption}
                    </p>
                    {normalizedImages[1].subtitle && (
                      <p className="text-[11px] text-sand-200/90 hidden sm:block mt-0.5 pl-3">
                        {normalizedImages[1].subtitle}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 2 (Offset with top padding) */}
              <div className="space-y-3.5 sm:space-y-5 pt-6 sm:pt-10 lg:pt-12">
                {/* 3. Traditional Lounge (Standard / Landscape) */}
                <div
                  onClick={() => openLightbox(2)}
                  className="group relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer border border-sand-200/90 bg-sand-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={normalizedImages[2].src}
                    alt={normalizedImages[2].alt}
                    className="w-full h-44 sm:h-52 lg:h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-forest-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity duration-300" />

                  {/* Hover expand badge */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-forest-900 shadow">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>

                  <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 text-white">
                    <p className="text-xs sm:text-sm font-semibold tracking-wide drop-shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sand-300 shrink-0" />
                      {normalizedImages[2].caption}
                    </p>
                    {normalizedImages[2].subtitle && (
                      <p className="text-[11px] text-sand-200/90 hidden sm:block mt-0.5 pl-3">
                        {normalizedImages[2].subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Mountain Window (Tall / Featured) */}
                <div
                  onClick={() => openLightbox(3)}
                  className="group relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer border border-sand-200/90 bg-sand-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={normalizedImages[3].src}
                    alt={normalizedImages[3].alt}
                    className="w-full h-64 sm:h-76 lg:h-80 object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-forest-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity duration-300" />

                  {/* Hover expand badge */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-forest-900 shadow">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>

                  <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 text-white">
                    <p className="text-xs sm:text-sm font-semibold tracking-wide drop-shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sand-300 shrink-0" />
                      {normalizedImages[3].caption}
                    </p>
                    {normalizedImages[3].subtitle && (
                      <p className="text-[11px] text-sand-200/90 hidden sm:block mt-0.5 pl-3">
                        {normalizedImages[3].subtitle}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Boutique Emblem */}
            <div className="hidden sm:flex absolute -bottom-4 -left-4 sm:-bottom-5 sm:-left-5 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-sand-200/90 items-center space-x-3 z-10 hover:scale-105 transition-transform duration-300">
              <div className="w-10 h-10 rounded-xl bg-forest-900 flex items-center justify-center text-sand-300 shadow-sm shrink-0">
                <Mountain className="w-5 h-5 text-sand-300" />
              </div>
              <div>
                <p className="text-xs font-serif font-bold text-forest-950 tracking-wide">100% Authentic Photos</p>
                <p className="text-[11px] text-forest-700 font-medium">Savera Homestay • Darjeeling</p>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {data.highlights.map((highlight, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-2xl border border-sand-200 shadow-sm hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-forest-50 border border-forest-100 flex items-center justify-center mb-4 group-hover:bg-forest-100 transition-colors">
                {getIconComponent(highlight.icon)}
              </div>
              <h3 className="font-serif text-lg font-semibold text-forest-950 mb-2">
                {highlight.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {highlight.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Stats Row */}
        {data.stats && (
          <div className="bg-forest-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {data.stats.map((stat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-sand-300">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-sand-100/80 font-medium tracking-wide">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6"
          onClick={closeLightbox}
        >
          {/* Top Controls */}
          <div
            className="w-full max-w-5xl flex items-center justify-between text-white/80 pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-medium tracking-wider uppercase bg-white/10 px-3 py-1 rounded-full text-sand-200">
                Photo {lightboxIndex + 1} of {normalizedImages.length}
              </span>
            </div>
            <button
              onClick={closeLightbox}
              aria-label="Close modal"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Photo Area */}
          <div
            className="relative max-w-5xl w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev Button */}
            <button
              onClick={showPrevImage}
              aria-label="Previous photo"
              className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/10 transition-colors backdrop-blur-xs"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Image */}
            <div className="relative max-h-[75vh] sm:max-h-[80vh] flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizedImages[lightboxIndex].src}
                alt={normalizedImages[lightboxIndex].alt}
                className="max-h-[72vh] sm:max-h-[78vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={showNextImage}
              aria-label="Next photo"
              className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/10 transition-colors backdrop-blur-xs"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Caption */}
          <div
            className="w-full max-w-5xl text-center pt-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-serif text-base sm:text-lg font-medium text-sand-200">
              {normalizedImages[lightboxIndex].caption}
            </p>
            {normalizedImages[lightboxIndex].subtitle && (
              <p className="text-xs sm:text-sm text-gray-300 mt-0.5">
                {normalizedImages[lightboxIndex].subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
