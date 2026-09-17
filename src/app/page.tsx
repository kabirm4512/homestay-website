'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import HeroCarousel from '@/components/HeroCarousel';
import AboutSection from '@/components/AboutSection';
import RoomsSection from '@/components/RoomsSection';
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
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(INITIAL_HERO_SLIDES);
  const [aboutData, setAboutData] = useState<AboutSectionData>(INITIAL_ABOUT_DATA);
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(INITIAL_SITE_INFO);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);

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
  }>({});

  // Fetch live CMS data and rooms on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [roomsRes, cmsRes] = await Promise.all([
          fetch('/api/rooms').then((r) => r.json()).catch(() => null),
          fetch('/api/cms').then((r) => r.json()).catch(() => null),
        ]);

        if (roomsRes && roomsRes.success && roomsRes.data?.length > 0) {
          setRooms(roomsRes.data);
        }

        if (cmsRes && cmsRes.success && cmsRes.data) {
          if (cmsRes.data.heroSlides?.length > 0) setHeroSlides(cmsRes.data.heroSlides);
          if (cmsRes.data.aboutData?.headline) setAboutData(cmsRes.data.aboutData);
          if (cmsRes.data.siteInfo?.name) setSiteInfo(cmsRes.data.siteInfo);
          if (cmsRes.data.reviews?.length > 0) setReviews(cmsRes.data.reviews);
        }
      } catch (err) {
        console.warn('Using local pre-seeded homestay content:', err);
      }
    }
    loadData();
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

  const handleOpenAvailability = (dates?: { checkIn?: string; checkOut?: string; roomsCount?: number }) => {
    if (dates) {
      setAvailabilityDates(dates);
    }
    setAvailabilityModalOpen(true);
  };

  return (
    <main className="relative min-h-screen bg-[#faf8f5] text-forest-950 pb-20 sm:pb-16">
      {/* 1. Sticky Navigation */}
      <Navbar
        homestayName={siteInfo.name}
        phone={siteInfo.phone}
        onOpenInquiry={() => handleOpenGeneralInquiry()}
        onCheckAvailability={() => handleOpenAvailability()}
      />

      {/* 2. Hero Carousel */}
      <HeroCarousel
        slides={heroSlides}
        rooms={rooms}
        onOpenInquiry={handleOpenGeneralInquiry}
        onBookRoom={handleBookRoom}
        onCheckAvailability={handleOpenAvailability}
      />

      {/* 3. About Section */}
      <AboutSection data={aboutData} />

      {/* 4. Rooms & Rates Grid */}
      <RoomsSection
        rooms={rooms}
        onBookRoom={handleBookRoom}
        onEnquireRoom={handleEnquireRoom}
      />

      {/* 5. Google Reviews Summary Section */}
      <ReviewsSection reviews={reviews} />

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
        onBookRoom={handleBookRoom}
        onOpenInquiry={handleOpenGeneralInquiry}
      />
    </main>
  );
}
