-- ==============================================================================
-- ZERO-COST HOMESTAY WEBSITE - SUPABASE SQL SCHEMA
-- Run this in your Supabase SQL Editor (free tier) to create all tables and policies.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROOMS & RATES TABLE
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tagline TEXT,
    description TEXT,
    room_type TEXT DEFAULT 'Deluxe Suite',
    price_per_night NUMERIC(10, 2) NOT NULL,
    weekend_price NUMERIC(10, 2),
    capacity_adults INT DEFAULT 2,
    capacity_children INT DEFAULT 1,
    bed_type TEXT DEFAULT 'King Bed',
    room_size_sqft INT DEFAULT 350,
    amenities TEXT[] DEFAULT ARRAY['Mountain View', 'King Bed', 'Complimentary Breakfast', 'High-Speed Wi-Fi', 'En-suite Bathroom', 'Private Balcony', 'Tea & Coffee Maker'],
    images TEXT[] DEFAULT ARRAY['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'],
    total_inventory INT DEFAULT 1,
    available_inventory INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. INQUIRIES TABLE
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    check_in DATE,
    check_out DATE,
    guests_count INT DEFAULT 2,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_name TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'confirmed', 'cancelled')),
    source TEXT DEFAULT 'website_modal',
    internal_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_reference TEXT UNIQUE NOT NULL,
    guest_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_name TEXT NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INT NOT NULL DEFAULT 1,
    total_price NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'deposit_paid', 'fully_paid')),
    special_requests TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CMS CONTENT TABLE (For editable Hero Carousel, About section, Site settings)
CREATE TABLE IF NOT EXISTS public.cms_content (
    id TEXT PRIMARY KEY, -- 'hero_carousel', 'about_section', 'site_info'
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_name TEXT NOT NULL,
    author_location TEXT DEFAULT 'Verified Guest',
    rating NUMERIC(2, 1) DEFAULT 5.0,
    review_text TEXT NOT NULL,
    review_date TEXT DEFAULT 'Recent Stay',
    is_featured BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR PUBLIC READ ACCESS
CREATE POLICY "Public can view active rooms" ON public.rooms
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view CMS content" ON public.cms_content
    FOR SELECT USING (true);

CREATE POLICY "Public can view reviews" ON public.reviews
    FOR SELECT USING (is_featured = true);

-- POLICIES FOR PUBLIC INSERT ACCESS (Allow guests to submit inquiries and booking requests)
CREATE POLICY "Public can create inquiries" ON public.inquiries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can create bookings" ON public.bookings
    FOR INSERT WITH CHECK (true);

-- ADMIN FULL ACCESS POLICIES (Can be authenticated via service role or admin auth)
CREATE POLICY "Full access to rooms for service role" ON public.rooms
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Full access to inquiries for service role" ON public.inquiries
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Full access to bookings for service role" ON public.bookings
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Full access to cms_content for service role" ON public.cms_content
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Full access to reviews for service role" ON public.reviews
    FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- 1. Initial Rooms
INSERT INTO public.rooms (name, slug, tagline, description, room_type, price_per_night, weekend_price, capacity_adults, capacity_children, bed_type, room_size_sqft, amenities, images, total_inventory, available_inventory)
VALUES 
(
    'The Cedar Forest Suite',
    'cedar-forest-suite',
    'Panoramic Pine Forest & Valley Views',
    'Perched on the upper tier of the estate, this expansive suite features handcrafted deodar cedar wood architecture, a private sunlit balcony overlooking the valley, an artisanal fireplace, and a luxurious king bed dressed in organic Egyptian cotton.',
    'Master Suite',
    5500.00,
    6200.00,
    2,
    1,
    'King Bed + Daybed',
    480,
    ARRAY['Private Valley Balcony', 'Artisanal Fireplace', 'Complimentary Breakfast', 'High-Speed Starlink Wi-Fi', 'En-suite Rain Shower', 'Heated Blankets', 'Artisanal Tea Station'],
    ARRAY[
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'
    ],
    2,
    2
),
(
    'The Orchard Cottage',
    'orchard-cottage',
    'Charming Independent Stone & Wood Cottage',
    'Nestled beside our private organic apple and apricot orchard, this standalone stone cottage offers supreme privacy. It boasts a dedicated reading nook, skylights for stargazing, and an outdoor patio perfect for morning brew rituals.',
    'Cottage',
    6800.00,
    7500.00,
    3,
    2,
    '1 King + 1 Queen Bed',
    600,
    ARRAY['Private Orchard Garden', 'Dedicated Work Desk', 'Outdoor Dining Patio', 'Free Gourmet Breakfast', 'Wood Stove Heater', 'Smart TV with Netflix', 'Pet Friendly'],
    ARRAY[
        'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
    ],
    1,
    1
),
(
    'The Valley Mist Room',
    'valley-mist-room',
    'Cozy Haven with Spectacular Sunrise Scenery',
    'An intimate room designed for solo travelers or couples seeking quiet solitude. Large picture windows bring the mist-covered mountains right to your bedside, paired with soft wool throws and handcrafted local decor.',
    'Deluxe Room',
    3800.00,
    4200.00,
    2,
    0,
    'Queen Bed',
    320,
    ARRAY['Sunrise Mountain Views', 'Work Station', 'Heated Room', 'Complimentary Breakfast', 'High-Speed Wi-Fi', 'Modern En-Suite Bathroom'],
    ARRAY[
        'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80'
    ],
    3,
    3
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Initial CMS Content
INSERT INTO public.cms_content (id, data)
VALUES 
(
    'hero_carousel',
    '{
        "slides": [
            {
                "id": "1",
                "image": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1920&q=85",
                "title": "Escape to Tranquility in the Hills",
                "subtitle": "An intimate boutique homestay surrounded by ancient pine forests and breathtaking valley views.",
                "badge": "Serene Mountain Getaway"
            },
            {
                "id": "2",
                "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1920&q=85",
                "title": "Slow Living & Mountain Warmth",
                "subtitle": "Farm-to-table organic meals, evening bonfires under starry skies, and heartfelt hospitality.",
                "badge": "Handcrafted Experiences"
            },
            {
                "id": "3",
                "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1920&q=85",
                "title": "Your Private Sanctuary Awaits",
                "subtitle": "Hand-built cedar wood suites designed for deep rest, creative retreat, and memorable family moments.",
                "badge": "Boutique Comfort"
            }
        ]
    }'::jsonb
),
(
    'about_section',
    '{
        "headline": "A Soulful Mountain Retreat Born from a Love for Nature",
        "story": "Tucked away 6,500 feet above sea level, Whispering Pines Sanctuary was envisioned as a quiet sanctuary where time slows down. We restored an ancestral stone and cedar timber homestead, preserving traditional Himalayan vernacular architecture while introducing contemporary comforts. Here, your mornings begin with the scent of wild pine and fresh mountain dew, and your evenings unwind around a crackling wood fire.",
        "highlights": [
            { "icon": "Mountain", "title": "Breathtaking Panoramas", "desc": "Unobstructed 180-degree view of snow-capped peaks and mist-laden pine valleys." },
            { "icon": "Utensils", "title": "Organic Farm-to-Table", "desc": "Authentic, wholesome local delicacies cooked with fresh produce from our kitchen garden." },
            { "icon": "Flame", "title": "Evening Bonfires & Chai", "desc": "Gather beneath clear starry skies with acoustic melodies, roasted snacks, and warmth." },
            { "icon": "Wifi", "title": "High-Speed Workation", "desc": "Starlink Wi-Fi and quiet ergonomic work corners for seamless remote productivity." },
            { "icon": "HeartHandshake", "title": "Heartfelt Hospitality", "desc": "Dedicated round-the-clock caretakers to curate customized mountain treks and picnics." },
            { "icon": "Footprints", "title": "Guided Nature Trails", "desc": "Walk along secret pine trails and serene freshwater mountain brooks." }
        ],
        "stats": [
            { "value": "4.9 / 5", "label": "Google Reviews" },
            { "value": "120+", "label": "Happy Stays" },
            { "value": "6,500 ft", "label": "Elevation" },
            { "value": "100%", "label": "Organic Garden" }
        ]
    }'::jsonb
),
(
    'site_info',
    '{
        "name": "Savera Homestay",
        "tagline": "A Boutique Mountain Homestay",
        "phone": "+91 81012 98882",
        "whatsapp": "918101298882",
        "email": "info.saverahomestay@gmail.com",
        "address": "35a, Hill Cart Rd, West Point, Cart Road, Darjeeling, West Bengal 734101",
        "check_in_time": "2:00 PM",
        "check_out_time": "11:00 AM",
        "map_url": "https://maps.app.goo.gl/KMJe676np8aDYExD6",
        "google_business_url": "https://share.google/ufeIhNLjkk7qoPffW",
        "map_embed_url": "https://www.google.com/maps?q=35a,+Hill+Cart+Rd,+West+Point,+Cart+Road,+Darjeeling,+West+Bengal+734101&output=embed"
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3. Initial Google Reviews
INSERT INTO public.reviews (author_name, author_location, rating, review_text, review_date)
VALUES 
(
    'Ananya Sengupta',
    'Bengaluru, India',
    5.0,
    'Whispering Pines is pure magic. The Cedar Forest Suite had the most sublime sunrise views we have ever witnessed. The home-cooked Pahadi meals by the in-house chef made us feel like family. We will definitely return every autumn!',
    '2 weeks ago'
),
(
    'Marcus & Elena Vance',
    'London, UK',
    5.0,
    'We spent a week working remotely from the Orchard Cottage. High speed internet was rock solid, the quietude was invigorating, and evening fires with the hosts gave us memories for a lifetime. Absolutely 10/10 stay.',
    '1 month ago'
),
(
    'Dr. Rohan Malhotra',
    'Delhi NCR',
    5.0,
    'The cleanest and most peaceful homestay experience in the valley. Zero tourist commercial noise, just birdsong and crisp pine aroma. The staff goes above and beyond for every small request.',
    '2 months ago'
),
(
    'Pooja & Siddharth',
    'Mumbai, India',
    4.9,
    'Booked for our 5th anniversary and it exceeded every expectation. The room decor is tasteful, the bed is extremely comfortable, and the private balcony was our favorite spot for morning tea.',
    '3 months ago'
);
