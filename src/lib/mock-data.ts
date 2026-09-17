import { Room, HeroSlide, AboutSectionData, SiteInfo, Review, Inquiry, Booking } from '@/types';

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-1',
    name: 'The Cedar Forest Suite',
    slug: 'cedar-forest-suite',
    tagline: 'Panoramic Pine Forest & Valley Views',
    description: 'Perched on the upper tier of the estate, this expansive suite features handcrafted deodar cedar wood architecture, a private sunlit balcony overlooking the valley, an artisanal fireplace, and a luxurious king bed dressed in organic Egyptian cotton.',
    room_type: 'Master Suite',
    price_per_night: 5500,
    weekend_price: 6200,
    capacity_adults: 2,
    capacity_children: 1,
    bed_type: 'King Bed + Daybed',
    room_size_sqft: 480,
    amenities: [
      'Private Valley Balcony',
      'Artisanal Fireplace',
      'Complimentary Breakfast',
      'High-Speed Starlink Wi-Fi',
      'En-suite Rain Shower',
      'Heated Blankets',
      'Artisanal Tea Station'
    ],
    images: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'
    ],
    total_inventory: 2,
    available_inventory: 2,
    is_active: true
  },
  {
    id: 'room-2',
    name: 'The Orchard Cottage',
    slug: 'orchard-cottage',
    tagline: 'Charming Independent Stone & Wood Cottage',
    description: 'Nestled beside our private organic apple and apricot orchard, this standalone stone cottage offers supreme privacy. It boasts a dedicated reading nook, skylights for stargazing, and an outdoor patio perfect for morning brew rituals.',
    room_type: 'Private Cottage',
    price_per_night: 6800,
    weekend_price: 7500,
    capacity_adults: 3,
    capacity_children: 2,
    bed_type: '1 King + 1 Queen Bed',
    room_size_sqft: 600,
    amenities: [
      'Private Orchard Garden',
      'Dedicated Work Desk',
      'Outdoor Dining Patio',
      'Free Gourmet Breakfast',
      'Wood Stove Heater',
      'Smart TV with Netflix',
      'Pet Friendly'
    ],
    images: [
      'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
    ],
    total_inventory: 1,
    available_inventory: 1,
    is_active: true
  },
  {
    id: 'room-3',
    name: 'The Valley Mist Room',
    slug: 'valley-mist-room',
    tagline: 'Cozy Haven with Spectacular Sunrise Scenery',
    description: 'An intimate room designed for solo travelers or couples seeking quiet solitude. Large picture windows bring the mist-covered mountains right to your bedside, paired with soft wool throws and handcrafted local decor.',
    room_type: 'Deluxe Room',
    price_per_night: 3800,
    weekend_price: 4200,
    capacity_adults: 2,
    capacity_children: 0,
    bed_type: 'Queen Bed',
    room_size_sqft: 320,
    amenities: [
      'Sunrise Mountain Views',
      'Work Station',
      'Heated Room',
      'Complimentary Breakfast',
      'High-Speed Wi-Fi',
      'Modern En-Suite Bathroom'
    ],
    images: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80'
    ],
    total_inventory: 3,
    available_inventory: 3,
    is_active: true
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
  headline: 'A Soulful Mountain Retreat Born from a Love for Nature',
  story: 'Tucked away 6,500 feet above sea level in the peaceful Deodar Valley, Whispering Pines Sanctuary was envisioned as a quiet sanctuary where time slows down. We restored an ancestral stone and cedar timber homestead, preserving traditional Himalayan vernacular architecture while introducing contemporary comforts. Here, your mornings begin with the scent of wild pine and fresh mountain dew, and your evenings unwind around a crackling wood fire.',
  highlights: [
    { icon: 'Mountain', title: 'Breathtaking Panoramas', desc: 'Unobstructed 180-degree view of snow-capped peaks and mist-laden pine valleys.' },
    { icon: 'Utensils', title: 'Organic Farm-to-Table', desc: 'Authentic, wholesome local delicacies cooked with fresh produce from our kitchen garden.' },
    { icon: 'Flame', title: 'Evening Bonfires & Chai', desc: 'Gather beneath clear starry skies with acoustic melodies, roasted snacks, and warmth.' },
    { icon: 'Wifi', title: 'High-Speed Starlink Wi-Fi', desc: 'Seamless high-speed internet and quiet ergonomic work corners for remote workations.' },
    { icon: 'HeartHandshake', title: 'Heartfelt Hospitality', desc: 'Dedicated round-the-clock caretakers to curate customized mountain treks and picnics.' },
    { icon: 'Footprints', title: 'Guided Nature Trails', desc: 'Walk along secret pine trails and serene freshwater mountain brooks.' }
  ],
  stats: [
    { value: '4.9 ★', label: 'Google Rating' },
    { value: '150+', label: 'Delighted Guests' },
    { value: '6,500 ft', label: 'Valley Elevation' },
    { value: '100%', label: 'Organic Kitchen' }
  ]
};

export const INITIAL_SITE_INFO: SiteInfo = {
  name: 'Whispering Pines Sanctuary',
  tagline: 'Boutique Homestay & Mountain Retreat',
  phone: '+91 98765 43210',
  whatsapp: '919876543210',
  email: 'stay@whisperingpines.com',
  address: 'Deodar Valley, Old Manali, Himachal Pradesh, India - 175131',
  check_in_time: '2:00 PM',
  check_out_time: '11:00 AM',
  map_embed_url: 'https://maps.google.com',
  directions: 'From Manali Mall Road, drive 3.2 km towards Old Manali bridge. Cross the bridge and follow the uphill pine trail for 900 meters. Whispering Pines is situated at the top right overlooking the cedar valley.',
  policies: [
    { title: 'Sanctuary Quiet Hours', desc: 'To preserve serenity and mountain birdlife, quiet hours commence from 10:30 PM to 7:00 AM.' },
    { title: 'Smoking & Alcohol Ethics', desc: 'Smoking is strictly prohibited inside wooden rooms. Designated smoking lounges are available in the open apple orchard.' },
    { title: 'Cancellation & Refund Policy', desc: 'Full refund if cancelled 7+ days prior to check-in. 50% refund within 3-7 days. Non-refundable within 72 hours of arrival.' },
    { title: 'Pet Policy', desc: 'Well-mannered furry companions are welcome in our ground floor garden cottages with prior notice.' }
  ],
  amenitiesList: [
    'Panoramic Snow Peak & Valley View',
    'High-Speed Starlink Wi-Fi (150+ Mbps)',
    '100% Organic Farm-to-Table Kitchen',
    'Evening Orchard Bonfires',
    'Complimentary Mountain Breakfast',
    'Private En-Suite Heated Bathrooms',
    'Dedicated Work Desks for Remote Workations',
    'On-Site Secure Car Parking'
  ]
};

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    author_name: 'Ananya Sengupta',
    author_location: 'Bengaluru, India',
    rating: 5.0,
    review_text: 'Whispering Pines is pure magic. The Cedar Forest Suite had the most sublime sunrise views we have ever witnessed. The home-cooked Pahadi meals by the in-house chef made us feel like family. We will definitely return every autumn!',
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

export const INITIAL_INQUIRIES: Inquiry[] = [
  {
    id: 'inq-1',
    guest_name: 'Vikram Mehta',
    email: 'vikram.m@gmail.com',
    phone: '+91 98201 54321',
    check_in: '2026-10-12',
    check_out: '2026-10-16',
    guests_count: 2,
    room_id: 'room-1',
    room_name: 'The Cedar Forest Suite',
    message: 'Planning a relaxing weekend getaway with my spouse. Can you arrange airport taxi pickup from Bhuntar airport?',
    status: 'pending',
    source: 'website_modal',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'inq-2',
    guest_name: 'Sarah Jenkins',
    email: 'sarah.j@outlook.com',
    phone: '+44 7700 900123',
    check_in: '2026-11-01',
    check_out: '2026-11-08',
    guests_count: 3,
    room_id: 'room-2',
    room_name: 'The Orchard Cottage',
    message: 'We are three friends looking for a peaceful workation for a week. Is the Starlink Wi-Fi stable throughout the cottage?',
    status: 'contacted',
    source: 'floating_cta',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'bk-1',
    booking_reference: 'WP-2026-9812',
    guest_name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    phone: '+91 99112 33445',
    room_id: 'room-1',
    room_name: 'The Cedar Forest Suite',
    check_in: '2026-10-05',
    check_out: '2026-10-08',
    nights: 3,
    total_price: 16500,
    status: 'confirmed',
    payment_status: 'deposit_paid',
    special_requests: 'Requesting early check-in at 12 PM if available.',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'bk-2',
    booking_reference: 'WP-2026-9813',
    guest_name: 'Claire Dupont',
    email: 'claire.dupont@orange.fr',
    phone: '+33 612 345678',
    room_id: 'room-3',
    room_name: 'The Valley Mist Room',
    check_in: '2026-10-20',
    check_out: '2026-10-23',
    nights: 3,
    total_price: 11400,
    status: 'pending',
    payment_status: 'unpaid',
    special_requests: 'Vegetarian meals only please.',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];
