'use client';

import { SiteInfo } from '@/types';
import { MapPin, Navigation, Clock, ShieldAlert, Car, Phone } from 'lucide-react';

interface LocationSectionProps {
  siteInfo: SiteInfo;
}

export default function LocationSection({ siteInfo }: LocationSectionProps) {
  return (
    <section id="location" className="py-20 sm:py-28 bg-[#faf8f5] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-forest-600 bg-forest-100 px-3 py-1 rounded-full inline-block mb-3">
            Finding Sanctuary
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-forest-950 tracking-tight leading-tight mb-4">
            Location & Getting Here
          </h2>
          <p className="text-gray-600 text-base sm:text-lg">
            Nestled in the quiet heights of Old Manali away from highway traffic.
          </p>
          <div className="w-16 h-1 bg-sand-400 mx-auto rounded-full mt-6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Directions & Details Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-7 rounded-3xl border border-sand-200 shadow-sm space-y-6">
              {/* Address */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-forest-950 mb-1">Our Location</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{siteInfo.address}</p>
                </div>
              </div>

              {/* Timings */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-forest-950 mb-1">Stay Timings</h4>
                  <p className="text-sm text-gray-600">
                    Check-in: <span className="font-medium text-gray-900">{siteInfo.check_in_time}</span>
                    <br />
                    Check-out: <span className="font-medium text-gray-900">{siteInfo.check_out_time}</span>
                  </p>
                </div>
              </div>

              {/* Getting Here Guidance */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-forest-950 mb-1">Transportation & Parking</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Private safe parking is available inside the estate. Airport transfers from
                    Bhuntar (KUU) airport can be pre-arranged upon request.
                  </p>
                </div>
              </div>

              {/* House Ethics */}
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-forest-950 mb-1">Sanctuary Guidelines</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    To preserve birdlife and serene rest, quiet hours commence at 10:30 PM.
                    Smoking is strictly restricted to designated outdoor garden areas.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(siteInfo.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-forest-800 hover:bg-forest-900 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2 text-sm"
                >
                  <Navigation className="w-4 h-4 text-sand-300" />
                  <span>Open in Google Maps</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right: Map Visual Container */}
          <div className="lg:col-span-7 h-[420px] rounded-3xl overflow-hidden shadow-lg border border-sand-200 relative bg-sand-200">
            <iframe
              title="Homestay Map Location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d13547.46513473722!2d77.1752835!3d32.2536838!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390487081518f8e7%3A0x6b4f74d0a9b8fa0!2sOld%20Manali%2C%20Manali%2C%20Himachal%20Pradesh!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
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
