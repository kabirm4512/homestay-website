import { MealPlanRates, RoomSeasonalTariffs, SeasonalDateRange } from './crm';
export type { MealPlanRates, RoomSeasonalTariffs, SeasonalDateRange };

export interface Room {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description: string;
  room_type: string;
  price_per_night: number;
  weekend_price?: number;
  capacity_adults: number;
  capacity_children: number;
  base_adults?: number;
  extra_adult_charge?: number;
  extra_child_charge?: number;
  bed_type: string;
  room_size_sqft: number;
  amenities: string[];
  images: string[];
  total_inventory: number;
  available_inventory: number;
  is_active: boolean;
  tariffs?: RoomSeasonalTariffs;
  created_at?: string;
  updated_at?: string;
}

export interface Inquiry {
  id: string;
  guest_name: string;
  email?: string;
  phone: string;
  check_in?: string;
  check_out?: string;
  guests_count: number;
  room_id?: string;
  room_name?: string;
  message?: string;
  status: 'pending' | 'contacted' | 'confirmed' | 'cancelled';
  source?: string;
  internal_notes?: string;
  created_at?: string;
}

export interface Booking {
  id: string;
  booking_reference: string;
  guest_name: string;
  email?: string;
  phone: string;
  room_id?: string;
  room_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults_count?: number;
  children_count?: number;
  extra_adults_count?: number;
  extra_children_count?: number;
  extra_charges_total?: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'deposit_paid' | 'fully_paid';
  special_requests?: string;
  created_at?: string;
}

export interface HeroSlide {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  badge?: string;
}

export interface AboutImageItem {
  src: string;
  alt: string;
  caption?: string;
  subtitle?: string;
}

export interface AboutSectionData {
  headline: string;
  story: string;
  images?: (string | AboutImageItem)[];
  highlights: {
    icon: string;
    title: string;
    desc: string;
  }[];
  stats: {
    value: string;
    label: string;
  }[];
}

export interface SiteInfo {
  name: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  check_in_time: string;
  check_out_time: string;
  map_embed_url: string;
  map_url?: string;
  google_business_url?: string;
  directions?: string;
  policies?: { title: string; desc: string }[];
  amenitiesList?: string[];
}

export interface Review {
  id: string;
  author_name: string;
  author_location?: string;
  rating: number;
  review_text: string;
  review_date: string;
  is_featured: boolean;
}
