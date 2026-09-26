'use client';

import { Review } from '@/types';
import { Star, ShieldCheck, ExternalLink, ThumbsUp } from 'lucide-react';

interface ReviewsSectionProps {
  reviews: Review[];
  googleBusinessUrl?: string;
}

export default function ReviewsSection({
  reviews,
  googleBusinessUrl = 'https://share.google/ufeIhNLjkk7qoPffW',
}: ReviewsSectionProps) {
  const averageRating = 4.9;
  const totalCount = 148;

  const personas = ['Himalayan Couple Stay', 'Family Mountain Retreat', 'Remote Workation', 'Nature & Tea Enthusiast'];

  return (
    <section id="reviews" className="py-20 sm:py-28 bg-[#FAF8F5] border-t border-[#EBE5DA] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#142820] bg-[#142820]/5 border border-[#142820]/10 px-4 py-1.5 rounded-full inline-block mb-3 shadow-xs">
            Guest Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#142820] font-serif tracking-tight leading-tight mb-4">
            Loved by Mountain Travelers
          </h2>
          <p className="text-[#5C6D66] text-base sm:text-lg font-normal leading-relaxed">
            Genuine memories and verified experiences from couples, family retreats, and remote workers who stayed with us.
          </p>
          <div className="w-16 h-0.5 bg-[#C85A32] mx-auto rounded-full mt-6" />
        </div>

        {/* Google Reviews Summary Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-[0_8px_30px_rgba(20,40,32,0.04)] border border-[#EBE5DA] mb-14 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left: Google Badge */}
            <div className="md:col-span-5 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#EBE5DA] pb-6 md:pb-0 md:pr-8 text-center">
              {/* Google Brand Badge */}
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="font-semibold text-gray-800 text-lg">Google Reviews</span>
              </div>

              <div className="text-5xl font-bold text-[#142820] font-serif mb-2">
                {averageRating.toFixed(1)}
              </div>

              <div className="flex items-center space-x-1 text-[#C5A059] mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>

              <p className="text-xs text-[#7B8B84] font-medium">
                Based on <span className="font-bold text-[#142820]">{totalCount}+ verified reviews</span>
              </p>

              <div className="mt-3 inline-flex items-center space-x-1 text-xs text-[#142820] bg-[#FAF8F5] border border-[#E5DEC9] px-3 py-1 rounded-full font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>100% Verified Guests</span>
              </div>
            </div>

            {/* Right: Category Rating Bars */}
            <div className="md:col-span-7 space-y-3.5">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-[#142820]">
                  <span>Cleanliness & Mountain Hygiene</span>
                  <span>5.0 / 5.0</span>
                </div>
                <div className="w-full bg-[#ECE6DA] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#142820] h-full rounded-full w-[100%]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-[#142820]">
                  <span>Host Hospitality & Farm Fresh Food</span>
                  <span>5.0 / 5.0</span>
                </div>
                <div className="w-full bg-[#ECE6DA] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#142820] h-full rounded-full w-[100%]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-[#142820]">
                  <span>Valley Location & Peaceful Scenery</span>
                  <span>4.9 / 5.0</span>
                </div>
                <div className="w-full bg-[#ECE6DA] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#142820] h-full rounded-full w-[98%]" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-[#142820]">
                  <span>Serenity, Privacy & Value</span>
                  <span>4.8 / 5.0</span>
                </div>
                <div className="w-full bg-[#ECE6DA] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#142820] h-full rounded-full w-[96%]" />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <a
                  href={googleBusinessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs text-[#C85A32] hover:text-[#B34D28] font-semibold transition-colors"
                >
                  <span>View All Reviews on Google</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {reviews.map((rev, idx) => (
            <div
              key={rev.id}
              className="bg-white p-6 rounded-3xl border border-[#EBE5DA] shadow-[0_4px_20px_rgba(20,40,32,0.03)] hover:shadow-[0_12px_30px_rgba(20,40,32,0.08)] hover:-translate-y-1 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Stars & Persona Tag */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-1 text-[#C5A059]">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.floor(rev.rating) ? 'fill-current' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#7B8B84] font-medium">{rev.review_date}</span>
                </div>

                {/* Persona Tag */}
                <div className="mb-3">
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9]">
                    {personas[idx % personas.length]}
                  </span>
                </div>

                {/* Review Text */}
                <p className="text-[#4A5752] text-sm leading-relaxed mb-6 font-serif italic">
                  &ldquo;{rev.review_text}&rdquo;
                </p>
              </div>

              {/* Author Info */}
              <div className="pt-4 border-t border-[#EBE5DA] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-[#FAF8F5] text-[#142820] font-bold text-xs flex items-center justify-center border border-[#E5DEC9]">
                    {rev.author_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-[#142820]">{rev.author_name}</h4>
                    <p className="text-[11px] text-[#7B8B84]">{rev.author_location || 'Verified Stay'}</p>
                  </div>
                </div>

                <ThumbsUp className="w-3.5 h-3.5 text-[#C85A32]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
