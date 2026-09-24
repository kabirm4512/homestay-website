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
      '/images/hero/deluxe-bedroom-suite.jpg',
      '/images/hero/scenic-valley-balcony.jpg',
      '/images/hero/himalayan-view-lounge.jpg',
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
      '/images/hero/spacious-balcony-room.jpg',
      '/images/hero/scenic-valley-balcony.jpg',
      '/images/hero/deluxe-bedroom-suite.jpg',
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
      '/images/hero/himalayan-view-lounge.jpg',
      '/images/hero/spacious-balcony-room.jpg',
      '/images/hero/tibetan-heritage-lounge.jpg',
      '/images/hero/scenic-valley-balcony.jpg',
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
    image: '/images/hero/himalayan-view-lounge.jpg',
    title: 'Wake Up to Majestic Kanchenjunga Views',
    subtitle: 'Sip freshly brewed Darjeeling tea from our warm wooden lounge, with panoramic views of snow-capped peaks and valleys right outside your window.',
    badge: 'Breathtaking Himalayan Panoramas'
  },
  {
    id: 'slide-2',
    image: '/images/hero/deluxe-bedroom-suite.jpg',
    title: 'Cozy Wooden Sanctuaries Crafted for Rest',
    subtitle: 'Relax in handcrafted timber suites featuring plush floral bedding, ambient lighting, heated comforts, and thoughtful boutique amenities.',
    badge: 'Handcrafted Timber Suites'
  },
  {
    id: 'slide-3',
    image: '/images/hero/spacious-balcony-room.jpg',
    title: 'Generous Living with Private Balcony Serenity',
    subtitle: 'Unwind in airy, thoughtfully designed rooms opening directly onto private balconies with sweeping views of fresh pine canopies.',
    badge: 'Spacious Balcony Comfort'
  },
  {
    id: 'slide-4',
    image: '/images/hero/scenic-valley-balcony.jpg',
    title: 'Step Out to Endless Valleys & Open Skies',
    subtitle: 'Breathe in pure mountain air from your secluded private balcony commanding endless panoramas of misty ridges and lush Himalayan slopes.',
    badge: 'Private Mountain Balconies'
  },
  {
    id: 'slide-5',
    image: '/images/hero/tibetan-heritage-lounge.jpg',
    title: 'Immerse in Authentic Himalayan Art & Heritage',
    subtitle: 'Experience timeless mountain hospitality in our heritage lounge adorned with hand-painted Buddhist murals, Tibetan artistry, and warm fireside charm.',
    badge: 'Authentic Himalayan Heritage'
  }
];

export const INITIAL_ABOUT_DATA: AboutSectionData = {
  headline: 'A Soulful Mountain Retreat Born from a Love for Darjeeling',
  story: 'Perched along the historic Hill Cart Road in West Point, Darjeeling, Savera Homestay was envisioned as a tranquil mountain sanctuary where time slows down. Preserving authentic Himalayan warmth while introducing modern boutique comforts, our 7 rooms with private balconies look out toward majestic mountain sunrises and misty pine ridges. Here, your mornings begin with the aroma of fresh Darjeeling brew and birdsong, and your days unfold in serene Himalayan bliss.',
  images: [
    {
      src: '/images/about/balcony-view.jpg',
      alt: 'Private mountain view balcony overlooking Himalayan valley',
      caption: 'Private Mountain Balcony',
      subtitle: 'Valley & sunrise vistas'
    },
    {
      src: '/images/about/bedroom-suite.jpg',
      alt: 'Handcrafted timber bedroom suite with balcony access',
      caption: 'Cedar Wood Bedroom Suite',
      subtitle: 'Warm Himalayan comforts'
    },
    {
      src: '/images/about/traditional-lounge.jpg',
      alt: 'Artisanal Himalayan lounge with traditional Buddhist mural',
      caption: 'Artisanal Lounge',
      subtitle: 'Traditional Tibetan wall art'
    },
    {
      src: '/images/about/mountain-window.jpg',
      alt: 'Living room window framing snow-capped Kanchenjunga peaks',
      caption: 'Kanchenjunga Window View',
      subtitle: 'Morning Darjeeling tea'
    }
  ],
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
    booking_reference: 'SH-2K2609001',
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
