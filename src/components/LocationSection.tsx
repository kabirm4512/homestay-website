'use client';

import { SiteInfo } from '@/types';
import { MapPin, Navigation, Clock, ShieldAlert, Car, Phone } from 'lucide-react';

interface LocationSectionProps {
  siteInfo: SiteInfo;
}

export default function LocationSection({ siteInfo }: LocationSectionProps) {
  return (
    <section id="location" className="py-20 sm:py-28 bg-[#F4EFE6]/40 border-t border-[#EBE5DA] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#142820] bg-[#142820]/5 border border-[#142820]/10 px-4 py-1.5 rounded-full inline-block mb-3 shadow-xs">
            Finding Savera
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#142820] font-serif tracking-tight leading-tight mb-4">
            Location & Mountain Access
          </h2>
          <p className="text-[#5C6D66] text-base sm:text-lg font-normal leading-relaxed">
            Perched at 6,700 ft along iconic Hill Cart Road in West Point, Darjeeling with sweeping valley horizons and easy road access.
          </p>
          <div className="w-16 h-0.5 bg-[#C85A32] mx-auto rounded-full mt-6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Directions & Details Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-7 sm:p-8 rounded-3xl border border-[#EBE5DA] shadow-[0_8px_30px_rgba(20,40,32,0.04)] space-y-6">
              {/* Address */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9] flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[#C85A32]" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#142820] mb-1">Our Sanctuary</h4>
                  <p className="text-sm text-[#5C6D66] leading-relaxed">{siteInfo.address}</p>
                </div>
              </div>

              {/* Local Mountain Distances */}
              <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[#EBE5DA] space-y-2.5">
                <div className="text-[11px] font-bold text-[#142820] uppercase tracking-wider">
                  Proximity & Mountain Transit
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#5C6D66]">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32] shrink-0" />
                    <span>Mall Road: 2.2 km</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32] shrink-0" />
                    <span>Toy Train: 1.8 km</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32] shrink-0" />
                    <span>Ghum: 4.5 km</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32] shrink-0" />
                    <span>Bagdogra (IXB): 68 km</span>
                  </div>
                </div>
              </div>

              {/* Timings */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9] flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-[#142820]" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#142820] mb-1">Stay Timings</h4>
                  <p className="text-sm text-[#5C6D66]">
                    Check-in: <span className="font-semibold text-[#142820]">{siteInfo.check_in_time}</span>
                    <br />
                    Check-out: <span className="font-semibold text-[#142820]">{siteInfo.check_out_time}</span>
                  </p>
                </div>
              </div>

              {/* Transportation & Parking */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9] flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-[#142820]" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#142820] mb-1">Parking & Chauffeurs</h4>
                  <p className="text-sm text-[#5C6D66] leading-relaxed">
                    {siteInfo.directions || 'Private safe parking available on-site. Airport and NJP railway station transfers can be pre-arranged directly with our host.'}
                  </p>
                </div>
              </div>

              {/* House Ethics */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] text-[#142820] border border-[#E5DEC9] flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5 text-[#C85A32]" />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-sm text-[#142820] mb-1">Homestay Tranquility</h4>
                  <p className="text-sm text-[#5C6D66] leading-relaxed">
                    To preserve peaceful mountain rest, quiet hours commence at 10:00 PM.
                    Smoking is strictly restricted to outdoor garden zones.
                  </p>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <a
                  href={siteInfo.map_url || 'https://maps.app.goo.gl/KMJe676np8aDYExD6'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#C85A32] hover:bg-[#B34D28] text-white font-semibold py-3.5 px-4 rounded-2xl shadow-[0_4px_14px_rgba(200,90,50,0.25)] transition-all flex items-center justify-center space-x-2 text-sm cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-white" />
                  <span>Open in Google Maps</span>
                </a>

                <a
                  href={siteInfo.google_business_url || 'https://share.google/ufeIhNLjkk7qoPffW'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#FAF8F5] hover:bg-[#F2ECE0] text-[#142820] font-semibold py-2.5 px-4 rounded-2xl border border-[#D5CDBD] transition-colors flex items-center justify-center space-x-2 text-xs cursor-pointer"
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

          {/* Right: Map Visual Container with Mobile Scroll Trap Protection */}
          <div className="lg:col-span-7 h-[460px] rounded-3xl overflow-hidden shadow-lg border border-[#EBE5DA] relative bg-[#ECE7DC]">
            <iframe
              title="Savera Homestay Location Map"
              src="https://www.google.com/maps?q=35a,+Hill+Cart+Rd,+West+Point,+Cart+Road,+Darjeeling,+West+Bengal+734101&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full filter contrast-[1.02]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
