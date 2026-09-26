'use client';

import { Trees, Phone, Mail, MapPin, Heart, ExternalLink } from 'lucide-react';
import { SiteInfo } from '@/types';

interface FooterProps {
  siteInfo: SiteInfo;
}

export default function Footer({ siteInfo }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#142820] text-gray-300 pt-16 pb-28 sm:pb-24 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Col 1: Brand */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#C85A32] text-white flex items-center justify-center shadow-md">
                <Trees className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-white block font-serif">
                  {siteInfo.name}
                </span>
                <span className="text-xs uppercase tracking-widest text-[#C5A059] font-medium block">
                  {siteInfo.tagline}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-300/80 leading-relaxed max-w-sm font-normal">
              A boutique mountain homestay in Darjeeling offering peaceful stays, warm Himalayan hospitality,
              and panoramic sunrise vistas of the eastern Himalayas.
            </p>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-white font-bold text-base mb-2 font-serif">
              Quick Exploration
            </h4>
            <ul className="space-y-2 text-sm text-gray-300/80">
              <li>
                <a href="#rooms" className="hover:text-[#C5A059] transition-colors">
                  Suites &amp; Tariffs
                </a>
              </li>
              <li>
                <a href="/concierge" className="hover:text-[#C5A059] transition-colors">
                  In-Room Dine-In Menu
                </a>
              </li>
              <li>
                <a href="#travel-rentals" className="hover:text-[#C5A059] transition-colors">
                  Mountain Transfers &amp; Rentals
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-[#C5A059] transition-colors">
                  The Homestay Story
                </a>
              </li>
              <li>
                <a href="/guest-portal" className="hover:text-[#C5A059] transition-colors font-medium">
                  Guest Portal (Stay Pass &amp; Folio)
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact Details */}
          <div className="lg:col-span-4 space-y-3">
            <h4 className="text-white font-bold text-base mb-2 font-serif">
              Host Contact
            </h4>
            <div className="space-y-2.5 text-sm text-gray-300/80">
              <div className="flex items-center space-x-2.5">
                <Phone className="w-4 h-4 text-[#C5A059] flex-shrink-0" />
                <a href={`tel:${siteInfo.phone.replace(/\s+/g, '')}`} className="hover:text-white">
                  {siteInfo.phone}
                </a>
              </div>
              <div className="flex items-center space-x-2.5">
                <Mail className="w-4 h-4 text-[#C5A059] flex-shrink-0" />
                <a href={`mailto:${siteInfo.email}`} className="hover:text-white">
                  {siteInfo.email}
                </a>
              </div>
              <div className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-[#C5A059] flex-shrink-0 mt-0.5" />
                <span>{siteInfo.address}</span>
              </div>
              <div className="pt-2 flex flex-col gap-1.5 text-xs">
                <a
                  href={siteInfo.google_business_url || 'https://share.google/ufeIhNLjkk7qoPffW'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#C5A059] text-gray-300/70 transition-colors inline-flex items-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Google Business Profile</span>
                </a>
                <a
                  href={siteInfo.map_url || 'https://maps.app.goo.gl/KMJe676np8aDYExD6'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#C5A059] text-gray-300/70 transition-colors inline-flex items-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>View on Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <p>© {currentYear} {siteInfo.name}. All rights reserved.</p>
          <div className="flex items-center space-x-1">
            <span>Boutique Himalayan Hospitality</span>
            <Heart className="w-3.5 h-3.5 text-[#C85A32] fill-current inline mx-1" />
          </div>
        </div>
      </div>
    </footer>
  );
}
