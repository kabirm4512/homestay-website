'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import HeroCarousel from '@/components/HeroCarousel';
import AboutSection from '@/components/AboutSection';
import RoomsSection from '@/components/RoomsSection';
import TravelAndRentalsSection from '@/components/TravelAndRentalsSection';
import ReviewsSection from '@/components/ReviewsSection';
import LocationSection from '@/components/LocationSection';
import Footer from '@/components/Footer';
import FloatingCTA from '@/components/FloatingCTA';
import InquiryModal from '@/components/InquiryModal';
import BookingModal from '@/components/BookingModal';
import AvailabilityModal from '@/components/AvailabilityModal';

import { Room, HeroSlide, AboutSectionData, SiteInfo, Review } from '@/types';
import {
  INITIAL_ROOMS,
  INITIAL_HERO_SLIDES,
  INITIAL_ABOUT_DATA,
  INITIAL_SITE_INFO,
  INITIAL_REVIEWS,
} from '@/lib/mock-data';

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_rooms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return INITIAL_ROOMS;
  });

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          const hasStaleUnsplash = Array.isArray(parsed.heroSlides) && parsed.heroSlides.some((s: HeroSlide) => s.image?.includes('images.unsplash.com'));
          if (Array.isArray(parsed.heroSlides) && parsed.heroSlides.length > 0 && !hasStaleUnsplash) return parsed.heroSlides;
        }
      } catch {}
    }
    return INITIAL_HERO_SLIDES;
  });

  const [aboutData, setAboutData] = useState<AboutSectionData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.aboutData?.headline) return parsed.aboutData;
        }
      } catch {}
    }
    return INITIAL_ABOUT_DATA;
  });

  const [siteInfo, setSiteInfo] = useState<SiteInfo>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.siteInfo?.name) return parsed.siteInfo;
        }
      } catch {}
    }
    return INITIAL_SITE_INFO;
  });

  const [reviews, setReviews] = useState<Review[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wp_site_cms');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.reviews) && parsed.reviews.length > 0) return parsed.reviews;
        }
      } catch {}
    }
    return INITIAL_REVIEWS;
  });

  // Modal states
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [selectedInquiryRoom, setSelectedInquiryRoom] = useState<Room | null>(null);
  const [searchDates, setSearchDates] = useState<{ checkIn: string; checkOut: string; guests: number } | null>(null);

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedBookingRoom, setSelectedBookingRoom] = useState<Room | null>(null);
  const [bookingDates, setBookingDates] = useState<{ checkIn: string; checkOut: string } | null>(null);

  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [availabilityDates, setAvailabilityDates] = useState<{
    checkIn?: string;
    checkOut?: string;
    roomsCount?: number;
    initialStep?: 'form' | 'results';
  }>({
    initialStep: 'form',
  });

  // Fetch live CMS data and rooms on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [roomsRes, cmsRes] = await Promise.all([
          fetch('/api/rooms').then((r) => r.json()).catch(() => null),
          fetch('/api/cms').then((r) => r.json()).catch(() => null),
        ]);

        if (roomsRes && roomsRes.success && Array.isArray(roomsRes.data) && roomsRes.data.length > 0) {
          const savedRooms = typeof window !== 'undefined' ? localStorage.getItem('wp_site_rooms') : null;
          if (!savedRooms) {
            setRooms(roomsRes.data);
            try {
              localStorage.setItem('wp_site_rooms', JSON.stringify(roomsRes.data));
            } catch {}
          }
        }

        if (cmsRes && cmsRes.success && cmsRes.data) {
          const savedCMS = typeof window !== 'undefined' ? localStorage.getItem('wp_site_cms') : null;
          let hasStaleHero = false;
          if (savedCMS) {
            try {
              const parsedCMS = JSON.parse(savedCMS);
              hasStaleHero = Array.isArray(parsedCMS.heroSlides) && parsedCMS.heroSlides.some((s: HeroSlide) => s.image?.includes('images.unsplash.com'));
            } catch {}
          }
          if (!savedCMS || hasStaleHero) {
            if (cmsRes.data.heroSlides?.length > 0) setHeroSlides(cmsRes.data.heroSlides);
            if (cmsRes.data.aboutData?.headline) setAboutData(cmsRes.data.aboutData);
            if (cmsRes.data.siteInfo?.name) setSiteInfo(cmsRes.data.siteInfo);
            if (cmsRes.data.reviews?.length > 0) setReviews(cmsRes.data.reviews);
            try {
              localStorage.setItem('wp_site_cms', JSON.stringify(cmsRes.data));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Using local pre-seeded homestay content:', err);
      }
    }
    loadData();

    // Multi-tab real-time synchronization
    const handleStorage = (e: StorageEvent) => {
      try {
        if (e.key === 'wp_site_rooms' && e.newValue) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) setRooms(parsed);
        }
        if (e.key === 'wp_site_cms' && e.newValue) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed.heroSlides) && parsed.heroSlides.length > 0) setHeroSlides(parsed.heroSlides);
          if (parsed.aboutData?.headline) setAboutData(parsed.aboutData);
          if (parsed.siteInfo?.name) setSiteInfo(parsed.siteInfo);
          if (Array.isArray(parsed.reviews) && parsed.reviews.length > 0) setReviews(parsed.reviews);
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleOpenGeneralInquiry = (initialDates?: { checkIn: string; checkOut: string; guests: number }) => {
    setSelectedInquiryRoom(null);
    if (initialDates) {
      setSearchDates(initialDates);
    }
    setInquiryModalOpen(true);
  };

  const handleEnquireRoom = (room: Room) => {
    setSelectedInquiryRoom(room);
    setInquiryModalOpen(true);
  };

  const handleBookRoom = (room: Room, dates?: { checkIn: string; checkOut: string }) => {
    setSelectedBookingRoom(room);
    if (dates) {
      setBookingDates(dates);
    }
    setBookingModalOpen(true);
  };

  const handleOpenAvailability = (params?: {
    checkIn?: string;
    checkOut?: string;
    roomsCount?: number;
    step?: 'form' | 'results';
  }) => {
    setAvailabilityDates({
      checkIn: params?.checkIn,
      checkOut: params?.checkOut,
      roomsCount: params?.roomsCount,
      initialStep: params?.step || (params?.checkIn ? 'results' : 'form'),
    });
    setAvailabilityModalOpen(true);
  };

  return (
    <main className="relative min-h-screen bg-[#faf8f5] text-forest-950 pb-20 sm:pb-16">
      {/* 1. Sticky Navigation */}
      <Navbar
        homestayName={siteInfo.name}
        phone={siteInfo.phone}
        onOpenInquiry={() => handleOpenGeneralInquiry()}
        onCheckAvailability={() => handleOpenAvailability({ step: 'form' })}
      />

      {/* 2. Hero Carousel */}
      <HeroCarousel
        slides={heroSlides}
        rooms={rooms}
        onOpenInquiry={handleOpenGeneralInquiry}
        onBookRoom={handleBookRoom}
        onCheckAvailability={(dates) =>
          handleOpenAvailability({
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            roomsCount: dates.roomsCount,
            step: 'results',
          })
        }
      />

      {/* 3. About Section */}
      <AboutSection data={aboutData} />

      {/* 4. Rooms & Rates Grid */}
      <RoomsSection
        rooms={rooms}
        onBookRoom={handleBookRoom}
        onEnquireRoom={handleEnquireRoom}
      />

      {/* 5. Himalayan Travel, Transfers & Bike Rentals (Upsell & Seasonal Tariffs) */}
      <TravelAndRentalsSection
        whatsappNumber={siteInfo.whatsapp}
        onOpenBookingModal={() => setBookingModalOpen(true)}
      />

      {/* 6. Google Reviews Summary Section */}
      <ReviewsSection
        reviews={reviews}
        googleBusinessUrl={siteInfo.google_business_url}
      />

      {/* 6. Location & Getting Here */}
      <LocationSection siteInfo={siteInfo} />

      {/* 7. Footer */}
      <Footer siteInfo={siteInfo} />

      {/* 8. Fixed Floating CTA Bar at Bottom */}
      <FloatingCTA
        whatsappNumber={siteInfo.whatsapp}
        phoneNumber={siteInfo.phone}
        homestayName={siteInfo.name}
        onOpenInquiry={() => handleOpenGeneralInquiry()}
      />

      {/* 9. Inquiry Popup Modal (Saves to Supabase) */}
      <InquiryModal
        isOpen={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
        rooms={rooms}
        selectedRoom={selectedInquiryRoom}
        initialDates={searchDates}
        whatsappNumber={siteInfo.whatsapp}
      />

      {/* 10. Direct Booking Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        room={selectedBookingRoom}
        initialDates={bookingDates}
        whatsappNumber={siteInfo.whatsapp}
      />

      {/* 11. Live Room Inventory & Availability Modal */}
      <AvailabilityModal
        isOpen={availabilityModalOpen}
        onClose={() => setAvailabilityModalOpen(false)}
        rooms={rooms}
        initialCheckIn={availabilityDates.checkIn}
        initialCheckOut={availabilityDates.checkOut}
        initialRoomsCount={availabilityDates.roomsCount}
        initialStep={availabilityDates.initialStep}
        onBookRoom={handleBookRoom}
        onOpenInquiry={handleOpenGeneralInquiry}
      />
    </main>
  );
}
