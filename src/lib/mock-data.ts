import { Room, HeroSlide, AboutSectionData, SiteInfo, Review, Inquiry, Booking } from '@/types';

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-cat-1',
    name: 'Deluxe Mountain View with Balcony',
    slug: 'deluxe-mountain-view-balcony',
    tagline: 'Panoramic Himalayan Sunrise & Private Balcony (Rooms 101, 102, 103)',
    description: 'Wake up to awe-inspiring golden sunrise rays bathing the snow-capped Himalayan peaks. Perched on the first floor with an expansive private balcony, each room features warm deodar cedar timber work, a king bed with organic cotton duvets, an artisanal tea/coffee bar, heated blankets, and a luxury en-suite rain shower.',
    room_type: 'Deluxe Balcony',
    price_per_night: 4500,
    weekend_price: 5200,
    base_adults: 2,
    capacity_adults: 3,
    capacity_children: 2,
    extra_adult_charge: 1200,
    extra_child_charge: 600,
    bed_type: 'King Bed',
    room_size_sqft: 380,
    amenities: [
      'Private Mountain Balcony',
      'Panoramic Himalayan Sunrise',
      'High-Speed Starlink Wi-Fi',
      'Artisanal Tea Station',
      'Heated Blankets',
      'En-Suite Glass Rain Shower',
      'Complimentary Farmhouse Breakfast'
    ],
    images: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'
    ],
    total_inventory: 3,
    available_inventory: 3,
    is_active: true,
    tariffs: {
      regular: { EP: 4500, CP: 5200, MAP: 6200, AP: 7200 },
      season: { EP: 5800, CP: 6600, MAP: 7800, AP: 8900 },
      offSeason: { EP: 3800, CP: 4300, MAP: 5100, AP: 5900 },
      weekendSurchargePercent: 10,
      extraAdultRate: 1200,
      extraChildRate: 600,
    }
  },
  {
    id: 'room-cat-2',
    name: 'Deluxe Forest View with Balcony',
    slug: 'deluxe-forest-view-balcony',
    tagline: 'Peaceful Pine Canopy Serenity & Forest Birdsong (Room 104)',
    description: 'An intimate mountain retreat bordering our protected pine grove. Your secluded private balcony opens directly into the lush tree canopy, offering fresh mountain pine scents and morning bird songs. Boasting handcrafted stone and warm wood detailing, heated comforts, and a dedicated reading desk.',
    room_type: 'Deluxe Balcony',
    price_per_night: 4200,
    weekend_price: 4800,
    base_adults: 2,
    capacity_adults: 2,
    capacity_children: 1,
    extra_adult_charge: 1200,
    extra_child_charge: 600,
    bed_type: 'King Bed',
    room_size_sqft: 360,
    amenities: [
      'Private Pine Forest Balcony',
      'Canopy Birdsong View',
      'Starlink Wi-Fi',
      'Wood-Paneled Work Desk',
      'Heated Blankets',
      'Modern En-Suite Bathroom',
      'Herbal Mountain Toiletries'
    ],
    images: [
      'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
    ],
    total_inventory: 1,
    available_inventory: 1,
    is_active: true,
    tariffs: {
      regular: { EP: 4200, CP: 4800, MAP: 5800, AP: 6800 },
      season: { EP: 5400, CP: 6100, MAP: 7200, AP: 8300 },
      offSeason: { EP: 3500, CP: 4000, MAP: 4800, AP: 5600 },
      weekendSurchargePercent: 10,
      extraAdultRate: 1200,
      extraChildRate: 600,
    }
  },
  {
    id: 'room-cat-3',
    name: 'Premium Mountain View Suites',
    slug: 'premium-mountain-view-suites',
    tagline: 'Top-Tier Panoramic Observation Balconies & Fireplace (Rooms 201, 202, 203)',
    description: 'Our signature luxury accommodations perched commandingly on the upper floor. These expansive 520 sq.ft. suites feature a sprawling 180-degree private observation balcony, an artisanal wood-burning stove / fireplace, a separate plush lounge with daybed, and a master king bed. Perfect for families or travelers seeking mountain grandeur.',
    room_type: 'Premium Suite',
    price_per_night: 6500,
    weekend_price: 7500,
    base_adults: 2,
    capacity_adults: 4,
    capacity_children: 2,
    extra_adult_charge: 1500,
    extra_child_charge: 750,
    bed_type: '1 King Bed + 1 Daybed',
    room_size_sqft: 520,
    amenities: [
      '180° Panoramic Observation Balcony',
      'Artisanal Fireplace / Wood Heater',
      'Lounge Area with Daybed',
      'Complimentary Gourmet Breakfast',
      'High-Speed Starlink Wi-Fi',
      'Luxury Rain Shower & Vanity',
      'Artisanal French Press Coffee Bar'
    ],
    images: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'
    ],
    total_inventory: 3,
    available_inventory: 3,
    is_active: true,
    tariffs: {
      regular: { EP: 6500, CP: 7400, MAP: 8600, AP: 9800 },
      season: { EP: 8500, CP: 9600, MAP: 11000, AP: 12500 },
      offSeason: { EP: 5200, CP: 5900, MAP: 6900, AP: 7900 },
      weekendSurchargePercent: 12,
      extraAdultRate: 1500,
      extraChildRate: 750,
    }
  }
];

export const INITIAL_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-1',
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1920&q=85',
    title: 'Escape to Tranquility in the Himalayan Hills',
    subtitle: 'An intimate boutique homestay surrounded by ancient pine forests, birdsong, and breathtaking valley views.',
    badge: 'Serene Mountain Getaway'
  },
  {
    id: 'slide-2',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=85',
    title: 'Slow Living, Warm Hospitality & Organic Feasts',
    subtitle: 'Farm-to-table organic meals, evening bonfires under starry skies, and heartfelt personal service.',
    badge: 'Handcrafted Experiences'
  },
  {
    id: 'slide-3',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1920&q=85',
    title: 'Your Private Mountain Sanctuary Awaits',
    subtitle: 'Hand-built cedar wood suites designed for deep rest, creative workations, and cherished memories.',
    badge: 'Boutique Comfort'
  }
];

export const INITIAL_ABOUT_DATA: AboutSectionData = {
  headline: 'A Soulful Mountain Retreat Born from a Love for Darjeeling',
  story: 'Perched along the historic Hill Cart Road in West Point, Darjeeling, Savera Homestay was envisioned as a tranquil mountain sanctuary where time slows down. Preserving authentic Himalayan warmth while introducing modern boutique comforts, our 7 rooms with private balconies look out toward majestic mountain sunrises and misty pine ridges. Here, your mornings begin with the aroma of fresh Darjeeling brew and birdsong, and your days unfold in serene Himalayan bliss.',
  highlights: [
    { icon: 'Mountain', title: 'Breathtaking Panoramas', desc: 'Private balconies commanding sweeping sunrise views across the misty Darjeeling hills.' },
    { icon: 'Utensils', title: 'Home-Cooked Mountain Meals', desc: 'Authentic Pahadi delicacies, steaming momos, and fresh thalis cooked with local ingredients.' },
    { icon: 'Flame', title: 'Evening Chai & Warmth', desc: 'Unwind with authentic Darjeeling first-flush tea, cozy blankets, and warm hospitality.' },
    { icon: 'Wifi', title: 'High-Speed Starlink Wi-Fi', desc: 'Seamless high-speed internet and comfortable timber work corners for remote workations.' },
    { icon: 'HeartHandshake', title: 'Heartfelt Hospitality', desc: 'Dedicated in-house hosts to assist with local mountain cabs, sightseeing, and custom itineraries.' },
    { icon: 'Footprints', title: 'Prime West Point Location', desc: 'Peaceful hilltop setting on Hill Cart Road with effortless access to Darjeeling landmarks.' }
  ],
  stats: [
    { value: '4.9 ★', label: 'Google Rating' },
    { value: '150+', label: 'Delighted Guests' },
    { value: '6,700 ft', label: 'Darjeeling Altitude' },
    { value: '7 Rooms', label: 'Private Balconies' }
  ]
};

export const INITIAL_SITE_INFO: SiteInfo = {
  name: 'Savera Homestay',
  tagline: 'A Boutique Mountain Homestay',
  phone: '+91 81012 98882',
  whatsapp: '918101298882',
  email: 'info.saverahomestay@gmail.com',
  address: '35a, Hill Cart Rd, West Point, Cart Road, Darjeeling, West Bengal 734101',
  check_in_time: '1:00 PM',
  check_out_time: '11:00 AM',
  map_embed_url: 'https://maps.google.com/maps?q=35a,+Hill+Cart+Rd,+West+Point,+Cart+Road,+Darjeeling,+West+Bengal+734101&output=embed',
  map_url: 'https://maps.app.goo.gl/KMJe676np8aDYExD6',
  google_business_url: 'https://share.google/ufeIhNLjkk7qoPffW',
  directions: 'Situated on 35a, Hill Cart Road in West Point, Darjeeling, West Bengal 734101. Located conveniently along the Cart Road stretch, easily reachable from Darjeeling town center (Mall Road / Chowrasta) or arriving from Siliguri, NJP Railway Station, and Bagdogra Airport (IXB).',
  policies: [
    { title: 'Sanctuary Quiet Hours', desc: 'To preserve serenity and mountain peace, quiet hours commence from 10:00 PM to 7:00 AM.' },
    { title: 'Smoking Ethics', desc: 'Smoking is strictly prohibited inside bedrooms. Designated open outdoor balcony zones are available.' },
    { title: 'Cancellation & Refund Policy', desc: 'Full refund if cancelled 7+ days prior to check-in. 50% refund within 3-7 days. Non-refundable within 72 hours of arrival.' },
    { title: 'Local Identity Verification', desc: 'Valid government photo ID (Aadhaar / Passport / Voter ID) required for all adult guests upon arrival.' }
  ],
  amenitiesList: [
    'Private Balconies in Every Room',
    'High-Speed Wi-Fi for Workations',
    'Fresh In-Room Dining & Pahadi Kitchen',
    'Complimentary Morning Breakfast',
    'Private En-Suite Heated Bathrooms',
    'NJP & Bagdogra Transfer Assistance',
    'Electric Kettles & Artisanal Darjeeling Tea',
    'Warm Woolen Blankets & Room Heaters'
  ]
};

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    author_name: 'Ananya Sengupta',
    author_location: 'Kolkata, India',
    rating: 5.0,
    review_text: 'Savera Homestay is an absolute gem in Darjeeling! The private mountain view balcony offered mesmerizing morning sunrises. The hosts treated us with so much care and the piping hot home-cooked meals were delicious.',
    review_date: '2 weeks ago',
    is_featured: true
  },
  {
    id: 'rev-2',
    author_name: 'Marcus & Elena Vance',
    author_location: 'London, UK',
    rating: 5.0,
    review_text: 'We spent a week working remotely from the Orchard Cottage. High speed internet was rock solid, the quietude was invigorating, and evening fires with the hosts gave us memories for a lifetime. Absolutely 10/10 stay.',
    review_date: '1 month ago',
    is_featured: true
  },
  {
    id: 'rev-3',
    author_name: 'Dr. Rohan Malhotra',
    author_location: 'Delhi NCR',
    rating: 5.0,
    review_text: 'The cleanest and most peaceful homestay experience in the valley. Zero commercial tourist noise, just birdsong and crisp pine aroma. The staff goes above and beyond for every small request.',
    review_date: '2 months ago',
    is_featured: true
  },
  {
    id: 'rev-4',
    author_name: 'Pooja & Siddharth',
    author_location: 'Mumbai, India',
    rating: 4.9,
    review_text: 'Booked for our 5th anniversary and it exceeded every expectation. The room decor is tasteful, the bed is extremely comfortable, and the private balcony was our favorite spot for morning tea.',
    review_date: '3 months ago',
    is_featured: true
  }
];

export const INITIAL_INQUIRIES: Inquiry[] = [];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'bk-8101298882',
    booking_reference: 'WP-2026-8882',
    guest_name: 'Savera Guest',
    email: 'guest8882@gmail.com',
    phone: '8101298882',
    room_id: 'room-101',
    room_name: 'Room 101 - Sunrise Mountain Balcony',
    check_in: new Date().toISOString().split('T')[0],
    check_out: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    nights: 1,
    total_price: 4500,
    status: 'confirmed',
    payment_status: 'deposit_paid',
    special_requests: 'Mountain sunrise view, warm drinking water',
    created_at: new Date().toISOString(),
  }
];
