import { supabase, isSupabaseConfigured } from './supabase';
import {
  INITIAL_ROOMS,
  INITIAL_HERO_SLIDES,
  INITIAL_ABOUT_DATA,
  INITIAL_SITE_INFO,
  INITIAL_REVIEWS,
  INITIAL_INQUIRIES,
  INITIAL_BOOKINGS
} from './mock-data';
import { Room, HeroSlide, AboutSectionData, SiteInfo, Review, Inquiry, Booking } from '@/types';

// In-memory fallback stores for server-side or non-localStorage environments
let localRooms: Room[] = [...INITIAL_ROOMS];
let localHeroSlides: HeroSlide[] = [...INITIAL_HERO_SLIDES];
let localAboutData: AboutSectionData = { ...INITIAL_ABOUT_DATA };
let localSiteInfo: SiteInfo = { ...INITIAL_SITE_INFO };
let localInquiries: Inquiry[] = [...INITIAL_INQUIRIES];
let localBookings: Booking[] = [...INITIAL_BOOKINGS];
let localReviews: Review[] = [...INITIAL_REVIEWS];

// Helper to get browser storage if available
const getStorageItem = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('LocalStorage write failed:', err);
  }
};

// UUID validation helper to prevent PostgreSQL syntax errors when using mock string IDs
const isUUID = (str?: string | null): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

// ==========================================
// ROOMS API
// ==========================================
export async function getRooms(): Promise<Room[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('price_per_night', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as Room[];
      }
    } catch (err) {
      console.warn('Supabase rooms query fallback:', err);
    }
  }
  return getStorageItem('homestay_rooms', localRooms);
}

export async function saveRoom(room: Partial<Room> & { name: string }): Promise<Room> {
  if (isSupabaseConfigured()) {
    try {
      if (room.id && isUUID(room.id)) {
        const { data, error } = await supabase
          .from('rooms')
          .update(room)
          .eq('id', room.id)
          .select()
          .single();
        if (!error && data) return data as Room;
      } else {
        const newSlug = room.slug || room.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const { id: _ignoredId, ...roomWithoutId } = room;
        const { data, error } = await supabase
          .from('rooms')
          .insert([{ ...roomWithoutId, slug: newSlug }])
          .select()
          .single();
        if (!error && data) return data as Room;
      }
    } catch (err) {
      console.warn('Supabase saveRoom fallback:', err);
    }
  }

  // Fallback
  const currentRooms = getStorageItem('homestay_rooms', localRooms);
  let updatedRooms: Room[];
  let savedRoom: Room;

  if (room.id && currentRooms.some(r => r.id === room.id)) {
    updatedRooms = currentRooms.map(r => (r.id === room.id ? { ...r, ...room } as Room : r));
    savedRoom = updatedRooms.find(r => r.id === room.id)!;
  } else {
    savedRoom = {
      ...room,
      id: room.id || ('room-' + Date.now()),
      slug: room.slug || room.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      room_type: room.room_type || 'Deluxe Suite',
      price_per_night: room.price_per_night || 4000,
      capacity_adults: room.capacity_adults || 2,
      capacity_children: room.capacity_children || 0,
      bed_type: room.bed_type || 'King Bed',
      room_size_sqft: room.room_size_sqft || 350,
      amenities: room.amenities || ['Mountain View', 'Wi-Fi', 'Breakfast'],
      images: room.images && room.images.length > 0 ? room.images : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'],
      total_inventory: room.total_inventory || 1,
      available_inventory: room.available_inventory !== undefined ? room.available_inventory : 1,
      is_active: room.is_active !== undefined ? room.is_active : true,
      description: room.description || ''
    } as Room;
    updatedRooms = [savedRoom, ...currentRooms];
  }

  localRooms = updatedRooms;
  setStorageItem('homestay_rooms', updatedRooms);
  return savedRoom;
}

export async function deleteRoom(id: string): Promise<boolean> {
  if (isSupabaseConfigured() && isUUID(id)) {
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Supabase deleteRoom fallback:', err);
    }
  }
  const currentRooms = getStorageItem('homestay_rooms', localRooms);
  const filtered = currentRooms.filter(r => r.id !== id);
  localRooms = filtered;
  setStorageItem('homestay_rooms', filtered);
  return true;
}

// ==========================================
// CMS CONTENT API
// ==========================================
export async function getCMSContent(): Promise<{
  heroSlides: HeroSlide[];
  aboutData: AboutSectionData;
  siteInfo: SiteInfo;
}> {
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('cms_content').select('*');
      if (data && data.length > 0) {
        const hero = data.find(d => d.id === 'hero_carousel')?.data;
        const about = data.find(d => d.id === 'about_section')?.data;
        const site = data.find(d => d.id === 'site_info')?.data;
        return {
          heroSlides: hero?.slides || getStorageItem('homestay_hero_slides', localHeroSlides),
          aboutData: about || getStorageItem('homestay_about_data', localAboutData),
          siteInfo: site || getStorageItem('homestay_site_info', localSiteInfo),
        };
      }
    } catch (err) {
      console.warn('Supabase getCMSContent fallback:', err);
    }
  }

  return {
    heroSlides: getStorageItem('homestay_hero_slides', localHeroSlides),
    aboutData: getStorageItem('homestay_about_data', localAboutData),
    siteInfo: getStorageItem('homestay_site_info', localSiteInfo),
  };
}

export async function updateHeroSlides(slides: HeroSlide[]): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('cms_content').upsert({
        id: 'hero_carousel',
        data: { slides },
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Supabase updateHeroSlides fallback:', err);
    }
  }
  localHeroSlides = slides;
  setStorageItem('homestay_hero_slides', slides);
  return true;
}

export async function updateAboutSection(aboutData: AboutSectionData): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('cms_content').upsert({
        id: 'about_section',
        data: aboutData,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Supabase updateAboutSection fallback:', err);
    }
  }
  localAboutData = aboutData;
  setStorageItem('homestay_about_data', aboutData);
  return true;
}

export async function updateSiteInfo(siteInfo: SiteInfo): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('cms_content').upsert({
        id: 'site_info',
        data: siteInfo,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Supabase updateSiteInfo fallback:', err);
    }
  }
  localSiteInfo = siteInfo;
  setStorageItem('homestay_site_info', siteInfo);
  return true;
}

// ==========================================
// INQUIRIES API
// ==========================================
export async function getInquiries(): Promise<Inquiry[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as Inquiry[];
    } catch (err) {
      console.warn('Supabase getInquiries fallback:', err);
    }
  }
  return getStorageItem('homestay_inquiries', localInquiries);
}

export async function createInquiry(
  inquiry: Omit<Inquiry, 'id' | 'created_at' | 'status'>
): Promise<{ success: boolean; data?: Inquiry; error?: string }> {
  const newInquiry: Inquiry = {
    ...inquiry,
    id: 'inq-' + Date.now(),
    status: 'pending',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .insert([
          {
            guest_name: inquiry.guest_name,
            email: inquiry.email,
            phone: inquiry.phone,
            check_in: inquiry.check_in || null,
            check_out: inquiry.check_out || null,
            guests_count: inquiry.guests_count || 1,
            room_id: isUUID(inquiry.room_id) ? inquiry.room_id : null,
            room_name: inquiry.room_name || null,
            message: inquiry.message || '',
            status: 'pending',
            source: inquiry.source || 'website_modal'
          }
        ])
        .select()
        .single();
      if (!error && data) {
        return { success: true, data: data as Inquiry };
      }
    } catch (err: any) {
      console.warn('Supabase createInquiry fallback to local:', err);
    }
  }

  // Local fallback
  const current = getStorageItem('homestay_inquiries', localInquiries);
  const updated = [newInquiry, ...current];
  localInquiries = updated;
  setStorageItem('homestay_inquiries', updated);
  return { success: true, data: newInquiry };
}

export async function updateInquiryStatus(
  id: string,
  status: Inquiry['status'],
  internal_notes?: string
): Promise<boolean> {
  if (isSupabaseConfigured() && isUUID(id)) {
    try {
      const updatePayload: any = { status };
      if (internal_notes !== undefined) updatePayload.internal_notes = internal_notes;
      const { error } = await supabase.from('inquiries').update(updatePayload).eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Supabase updateInquiryStatus fallback:', err);
    }
  }
  const current = getStorageItem('homestay_inquiries', localInquiries);
  const updated = current.map(item =>
    item.id === id ? { ...item, status, internal_notes: internal_notes ?? item.internal_notes } : item
  );
  localInquiries = updated;
  setStorageItem('homestay_inquiries', updated);
  return true;
}

// ==========================================
// BOOKINGS API
// ==========================================
export async function getBookings(): Promise<Booking[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as Booking[];
    } catch (err) {
      console.warn('Supabase getBookings fallback:', err);
    }
  }
  return getStorageItem('homestay_bookings', localBookings);
}

export async function createBooking(
  bookingData: Omit<Booking, 'id' | 'booking_reference' | 'created_at' | 'status' | 'payment_status'>
): Promise<{ success: boolean; data?: Booking; error?: string }> {
  const reference = 'WP-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
  const newBooking: Booking = {
    ...bookingData,
    id: 'bk-' + Date.now(),
    booking_reference: reference,
    status: 'pending',
    payment_status: 'unpaid',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            booking_reference: reference,
            guest_name: bookingData.guest_name,
            email: bookingData.email,
            phone: bookingData.phone,
            room_id: isUUID(bookingData.room_id) ? bookingData.room_id : null,
            room_name: bookingData.room_name,
            check_in: bookingData.check_in,
            check_out: bookingData.check_out,
            nights: bookingData.nights,
            total_price: bookingData.total_price,
            status: 'pending',
            payment_status: 'unpaid',
            special_requests: bookingData.special_requests || ''
          }
        ])
        .select()
        .single();
      if (!error && data) {
        return { success: true, data: data as Booking };
      }
    } catch (err) {
      console.warn('Supabase createBooking fallback:', err);
    }
  }

  const current = getStorageItem('homestay_bookings', localBookings);
  const updated = [newBooking, ...current];
  localBookings = updated;
  setStorageItem('homestay_bookings', updated);
  return { success: true, data: newBooking };
}

export async function updateBookingStatus(
  id: string,
  status: Booking['status'],
  payment_status?: Booking['payment_status']
): Promise<boolean> {
  if (isSupabaseConfigured() && isUUID(id)) {
    try {
      const payload: any = { status };
      if (payment_status) payload.payment_status = payment_status;
      const { error } = await supabase.from('bookings').update(payload).eq('id', id);
      if (!error) return true;
    } catch (err) {
      console.warn('Supabase updateBookingStatus fallback:', err);
    }
  }
  const current = getStorageItem('homestay_bookings', localBookings);
  const updated = current.map(item =>
    item.id === id ? { ...item, status, payment_status: payment_status || item.payment_status } : item
  );
  localBookings = updated;
  setStorageItem('homestay_bookings', updated);
  return true;
}

// ==========================================
// REVIEWS API
// ==========================================
export async function getReviews(): Promise<Review[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('is_featured', true)
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return data as Review[];
    } catch (err) {
      console.warn('Supabase getReviews fallback:', err);
    }
  }
  return getStorageItem('homestay_reviews', localReviews);
}
