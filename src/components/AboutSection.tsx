'use client';

import { AboutSectionData } from '@/types';
import {
  Mountain,
  Utensils,
  Flame,
  Wifi,
  HeartHandshake,
  Footprints,
  Compass,
  CheckCircle2
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

export default function AboutSection({ data }: AboutSectionProps) {
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-20">
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

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2 text-forest-900 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4 text-forest-600" />
                <span>Zero Commercial Clutter</span>
              </div>
              <div className="flex items-center space-x-2 text-forest-900 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4 text-forest-600" />
                <span>Dedicated On-Site Host</span>
              </div>
              <div className="flex items-center space-x-2 text-forest-900 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4 text-forest-600" />
                <span>Fresh Mountain Water & Air</span>
              </div>
            </div>
          </div>

          {/* Image Showcase */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=800&q=80"
                alt="Homestay forest surroundings"
                className="w-full h-64 sm:h-72 object-cover rounded-2xl shadow-md hover:scale-[1.02] transition-transform duration-300"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80"
                alt="Cozy bonfire evening"
                className="w-full h-44 sm:h-52 object-cover rounded-2xl shadow-md hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
            <div className="space-y-4 pt-6 sm:pt-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=800&q=80"
                alt="Homestay bedroom interior"
                className="w-full h-44 sm:h-52 object-cover rounded-2xl shadow-md hover:scale-[1.02] transition-transform duration-300"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
                alt="Mountain sunrise view"
                className="w-full h-64 sm:h-72 object-cover rounded-2xl shadow-md hover:scale-[1.02] transition-transform duration-300"
              />
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
    </section>
  );
}
