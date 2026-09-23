'use client';

import { SiteInfo } from '@/types';
import { MapPin, Navigation, Clock, ShieldAlert, Car, Phone } from 'lucide-react';

interface LocationSectionProps {
  siteInfo: SiteInfo;
}

export default function LocationSection({ siteInfo }: LocationSectionProps) {
  return (
    <section id="location" className="py-20 sm:py-28 bg-[#F3F7FF] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-700 bg-primary-100 px-3.5 py-1 rounded-full inline-block mb-3 shadow-xs">
            Finding Savera
          </span>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0B1733] tracking-tight leading-tight mb-4"
            style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
          >
            Location & Getting Here
          </h2>
          <p className="text-gray-600 text-base sm:text-lg font-normal">
            Located along Hill Cart Road in West Point, Darjeeling with panoramic views of the eastern Himalayas.
          </p>
          <div className="w-16 h-1 bg-[#FE6E00] mx-auto rounded-full mt-6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Directions & Details Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
              {/* Address */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0B1733] mb-1">Our Location</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{siteInfo.address}</p>
                </div>
              </div>

              {/* Timings */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0B1733] mb-1">Stay Timings</h4>
                  <p className="text-sm text-gray-600">
                    Check-in: <span className="font-semibold text-gray-900">{siteInfo.check_in_time}</span>
                    <br />
                    Check-out: <span className="font-semibold text-gray-900">{siteInfo.check_out_time}</span>
                  </p>
                </div>
              </div>

              {/* Getting Here Guidance */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0B1733] mb-1">Transportation & Parking</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {siteInfo.directions || 'Private safe parking is available. Airport transfers from Bagdogra (IXB) and train station transfers from New Jalpaiguri (NJP) can be pre-arranged upon request.'}
                  </p>
                </div>
              </div>

              {/* House Ethics */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#0B1733] mb-1">Homestay Guidelines</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    To preserve peaceful mountain rest, quiet hours commence at 10:00 PM.
                    Smoking is strictly restricted to designated outdoor garden areas.
                  </p>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <a
                  href={siteInfo.map_url || 'https://maps.app.goo.gl/KMJe676np8aDYExD6'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-[#FE6E00] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-bold py-3.5 px-4 rounded-2xl shadow-[0_4px_14px_rgba(254,110,0,0.35)] transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-white" />
                  <span>Open in Google Maps</span>
                </a>

                <a
                  href={siteInfo.google_business_url || 'https://share.google/ufeIhNLjkk7qoPffW'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#F3F7FF] hover:bg-[#E9EDFA] text-primary-700 font-semibold py-2.5 px-4 rounded-2xl border border-[#C7D4F5] transition-colors flex items-center justify-center space-x-2 text-xs cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                  <span>Google Business Profile</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right: Map Visual Container */}
          <div className="lg:col-span-7 h-[460px] rounded-3xl overflow-hidden shadow-lg border border-sand-200 relative bg-sand-200">
            <iframe
              title="Savera Homestay Location Map"
              src="https://www.google.com/maps?q=35a,+Hill+Cart+Rd,+West+Point,+Cart+Road,+Darjeeling,+West+Bengal+734101&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full filter contrast-[1.05]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
