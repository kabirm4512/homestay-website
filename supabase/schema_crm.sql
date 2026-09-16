-- ==============================================================================
-- BOUTIQUE HOMESTAY CRM, DIGITAL CONCIERGE & FINANCIAL LEDGER
-- PostgreSQL Relational Database Schema
-- Designed for 7 Rooms (3 Categories), Role-Based Access Control,
-- Tape Chart, Operations Hub, QR Digital Concierge, and Admin Financial Ledger
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ENUMS FOR STRICT DOMAIN MODELING
-- ==============================================================================

-- Staff RBAC Roles
CREATE TYPE staff_role AS ENUM ('admin', 'manager', 'kitchen_staff');

-- Room Categories
CREATE TYPE room_category_type AS ENUM ('luxury_suite', 'cottage', 'deluxe_pine');

-- Room Physical Statuses for Tape Chart
CREATE TYPE room_tape_status AS ENUM ('hold', 'confirmed', 'checked_in', 'maintenance', 'available');

-- Housekeeping Statuses
CREATE TYPE housekeeping_status AS ENUM ('clean', 'light_refresh', 'deep_clean_turnover', 'maintenance_inspection');

-- Meal Plans (Critical for Kitchen Mandate)
-- EP: European Plan (Room Only)
-- CP: Continental Plan (Room + Breakfast)
-- MAP: Modified American Plan (Room + Breakfast + Lunch or Dinner)
-- AP: American Plan (Room + All 3 Meals)
CREATE TYPE meal_plan_type AS ENUM ('EP', 'CP', 'MAP', 'AP');

-- Booking Status
CREATE TYPE booking_status_type AS ENUM ('hold', 'confirmed', 'checked_in', 'checked_out', 'cancelled');

-- In-Room QR Food Order Status
CREATE TYPE food_order_status AS ENUM ('pending', 'accepted_kitchen', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');

-- Transport Request Status
CREATE TYPE dispatch_status AS ENUM ('pending_confirmation', 'confirmed_dispatched', 'in_transit', 'completed', 'cancelled');

-- Folio & Charge Status
CREATE TYPE folio_status_type AS ENUM ('open', 'settled', 'void');
CREATE TYPE charge_status_type AS ENUM ('pending', 'posted', 'void');
CREATE TYPE charge_category_type AS ENUM ('room_tariff', 'food_beverage', 'transport_transfer', 'vehicle_rental', 'laundry', 'miscellaneous');

-- Payment Methods & Ledger Categories
CREATE TYPE payment_method_type AS ENUM ('cash', 'upi', 'bank_transfer', 'card');
CREATE TYPE expense_master_category AS ENUM (
    'groceries',
    'utilities',
    'housekeeping',
    'maintenance',
    'staff_payroll',
    'marketing',
    'transport_vendor',
    'miscellaneous'
);

-- ==============================================================================
-- 2. STAFF & ROLE-BASED ACCESS CONTROL (RBAC)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS staff_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role staff_role NOT NULL DEFAULT 'kitchen_staff',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_users_role ON staff_users(role);

-- ==============================================================================
-- 3. ROOMS & CATEGORIES (7 Physical Rooms across 3 Categories)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS room_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code room_category_type UNIQUE NOT NULL,
    name TEXT NOT NULL, -- e.g., 'Master Forest Suite', 'Heritage Stone Cottage', 'Pine View Deluxe'
    description TEXT,
    base_price_weekday NUMERIC(10, 2) NOT NULL,
    base_price_weekend NUMERIC(10, 2) NOT NULL,
    max_adults INT NOT NULL DEFAULT 2,
    max_children INT NOT NULL DEFAULT 1,
    amenities TEXT[] DEFAULT ARRAY['Starlink Wi-Fi', 'Artisanal Fireplace', 'Mountain View', 'En-suite Rain Shower'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS physical_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_number INT UNIQUE NOT NULL CHECK (room_number BETWEEN 1 AND 7), -- Exactly 7 physical rooms
    name TEXT NOT NULL, -- e.g., 'Room 1 - Pine Haven', 'Room 2 - Valley View Cottage'
    category_id UUID NOT NULL REFERENCES room_categories(id) ON DELETE RESTRICT,
    floor_level INT DEFAULT 1,
    current_status room_tape_status NOT NULL DEFAULT 'available',
    housekeeping housekeeping_status NOT NULL DEFAULT 'clean',
    qr_secret_token TEXT UNIQUE NOT NULL DEFAULT md5(random()::text), -- Used for secure QR URL validation (e.g., /concierge?room=3&token=xyz)
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_physical_rooms_number ON physical_rooms(room_number);
CREATE INDEX IF NOT EXISTS idx_physical_rooms_status ON physical_rooms(current_status);

-- ==============================================================================
-- 4. GUESTS & PROFILES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    id_type TEXT, -- 'Passport', 'Aadhaar', 'Driver License', 'Inner Line Permit'
    id_document_url TEXT, -- Uploaded photo of ID / Permit
    id_number TEXT,
    dietary_preferences TEXT, -- 'Vegetarian', 'Jain', 'Nut Allergy', 'Lactose Intolerant'
    hospitality_preferences TEXT, -- 'Warm water in morning', 'Extra duvet', 'Late riser'
    whatsapp_number TEXT,
    total_lifetime_stays INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

-- ==============================================================================
-- 5. THE TAPE CHART (CORE CRM & BOOKINGS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_reference TEXT UNIQUE NOT NULL, -- e.g. 'WP-2026-001'
    room_id UUID NOT NULL REFERENCES physical_rooms(id) ON DELETE RESTRICT,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    tape_status room_tape_status NOT NULL DEFAULT 'confirmed',
    booking_status booking_status_type NOT NULL DEFAULT 'confirmed',
    meal_plan meal_plan_type NOT NULL DEFAULT 'CP', -- Critical: informs Kitchen Mandate
    adults_count INT NOT NULL DEFAULT 2,
    children_count INT NOT NULL DEFAULT 0,
    room_rate_per_night NUMERIC(10, 2) NOT NULL,
    total_nights INT GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
    special_requests TEXT,
    checked_in_at TIMESTAMPTZ,
    checked_out_at TIMESTAMPTZ,
    created_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_stay_dates CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_bookings_room_status ON bookings(room_id, tape_status);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);

-- ==============================================================================
-- 6. GUEST FOLIOS (UNIFIED FINANCIAL SPINE)
-- Relates Bookings + Room Tariffs + QR Food Orders + Travel Add-ons + Payments
-- ==============================================================================

CREATE TABLE IF NOT EXISTS guest_folios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    folio_number TEXT UNIQUE NOT NULL, -- e.g. 'FOL-2026-001'
    status folio_status_type NOT NULL DEFAULT 'open',
    total_room_charges NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_fb_charges NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_addon_charges NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_tax NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    net_payable NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    settled_at TIMESTAMPTZ,
    settled_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_folios_booking ON guest_folios(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_folios_status ON guest_folios(status);

-- Individual Line Charges posted to the Folio (from Room, QR Orders, Travel)
CREATE TABLE IF NOT EXISTS folio_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio_id UUID NOT NULL REFERENCES guest_folios(id) ON DELETE CASCADE,
    category charge_category_type NOT NULL,
    charge_status charge_status_type NOT NULL DEFAULT 'pending', -- Posted as 'pending' upon QR order, confirmed by manager
    title TEXT NOT NULL, -- e.g. 'Room Tariff (Night 1)', 'QR Order #ORD-104 - Himalayan Thukpa & Ginger Tea'
    amount NUMERIC(10, 2) NOT NULL,
    source_reference_type TEXT, -- 'booking', 'food_order', 'transport_request', 'manual_adjustment'
    source_reference_id UUID, -- References food_orders(id) or transport_requests(id)
    notes TEXT,
    posted_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folio_charges_folio ON folio_charges(folio_id);
CREATE INDEX IF NOT EXISTS idx_folio_charges_source ON folio_charges(source_reference_type, source_reference_id);

-- Payments Collected against the Folio (Supports Cash vs. UPI Reconciliation)
CREATE TABLE IF NOT EXISTS folio_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio_id UUID NOT NULL REFERENCES guest_folios(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method payment_method_type NOT NULL, -- Cash, UPI, Bank Transfer, Card
    transaction_reference TEXT, -- UPI UTR number or bank ref
    collected_by UUID NOT NULL REFERENCES staff_users(id),
    receipt_notes TEXT,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folio_payments_folio ON folio_payments(folio_id);
CREATE INDEX IF NOT EXISTS idx_folio_payments_method ON folio_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_folio_payments_date ON folio_payments(collected_at);

-- ==============================================================================
-- 7. IN-ROOM DIGITAL CONCIERGE: DINING & LIVE FOOD ORDERS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- 'Beverages & Hot Brews', 'Himalayan Snacks', 'Traditional Mains', 'Desserts'
    slug TEXT UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'main' CHECK (item_type IN ('beverage', 'snack', 'main')),
    is_available BOOLEAN NOT NULL DEFAULT true, -- Kitchen staff toggles In/Out of stock
    is_late_night_eligible BOOLEAN NOT NULL DEFAULT false, -- If false, hidden after 10:00 PM for Mains
    prep_time_minutes INT DEFAULT 20,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_availability ON menu_items(is_available, item_type);

CREATE TABLE IF NOT EXISTS food_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL, -- e.g. 'ORD-1001'
    room_id UUID NOT NULL REFERENCES physical_rooms(id) ON DELETE RESTRICT,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    folio_id UUID NOT NULL REFERENCES guest_folios(id) ON DELETE RESTRICT,
    status food_order_status NOT NULL DEFAULT 'pending',
    special_cooking_instructions TEXT,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    charge_posted_to_folio BOOLEAN NOT NULL DEFAULT true,
    whatsapp_notification_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_orders_kitchen ON food_orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_food_orders_room ON food_orders(room_id);
CREATE INDEX IF NOT EXISTS idx_food_orders_folio ON food_orders(folio_id);

CREATE TABLE IF NOT EXISTS food_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES food_orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    item_name TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10, 2) NOT NULL,
    item_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_food_order_items_order ON food_order_items(order_id);

-- ==============================================================================
-- 8. IN-ROOM DIGITAL CONCIERGE: TRAVEL, TRANSFERS & DISPATCH HUB
-- ==============================================================================

CREATE TABLE IF NOT EXISTS transfer_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL, -- e.g. 'Darjeeling to NJP Railway / Bagdogra Airport', 'Darjeeling to Gangtok'
    origin TEXT NOT NULL DEFAULT 'Homestay (Darjeeling)',
    destination TEXT NOT NULL,
    price_wagonr NUMERIC(10, 2) NOT NULL,
    price_sedan NUMERIC(10, 2) NOT NULL, -- Dzire, Glanza
    price_suv NUMERIC(10, 2) NOT NULL,   -- Innova, Xylo
    estimated_duration_hours NUMERIC(3, 1),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS route_modifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES transfer_routes(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'Via Mirik Lake & Tea Gardens', 'Via Namchi & Ravangla Buddha Park'
    extra_charge NUMERIC(10, 2) NOT NULL,
    extra_duration_hours NUMERIC(3, 1) DEFAULT 2.0
);

CREATE TABLE IF NOT EXISTS rental_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_name TEXT NOT NULL, -- 'Royal Enfield Classic 350', 'Honda Activa 6G Scooty'
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('scooty', 'bike', 'car')),
    rate_per_day NUMERIC(10, 2) NOT NULL,
    deposit_required NUMERIC(10, 2) DEFAULT 1000.00,
    is_available BOOLEAN NOT NULL DEFAULT true
);

-- Transport and Add-on Requests (Requires manual confirmation by Manager/Admin in Dispatch Hub)
CREATE TABLE IF NOT EXISTS transport_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number TEXT UNIQUE NOT NULL, -- e.g. 'DSP-501'
    room_id UUID NOT NULL REFERENCES physical_rooms(id) ON DELETE RESTRICT,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    folio_id UUID NOT NULL REFERENCES guest_folios(id) ON DELETE RESTRICT,
    service_type TEXT NOT NULL CHECK (service_type IN ('point_to_point', 'vehicle_rental')),
    route_id UUID REFERENCES transfer_routes(id) ON DELETE SET NULL,
    vehicle_tier TEXT CHECK (vehicle_tier IN ('wagonr', 'sedan', 'suv')),
    rental_vehicle_id UUID REFERENCES rental_vehicles(id) ON DELETE SET NULL,
    selected_modifiers JSONB DEFAULT '[]'::jsonb, -- Array of selected modifier names & charges
    pickup_datetime TIMESTAMPTZ NOT NULL,
    return_datetime TIMESTAMPTZ, -- for rentals
    pickup_location TEXT NOT NULL DEFAULT 'Homestay Main Gate',
    destination_notes TEXT,
    guest_contact_phone TEXT NOT NULL,
    quoted_price NUMERIC(10, 2) NOT NULL,
    vendor_cost NUMERIC(10, 2) DEFAULT 0.00, -- What homestay pays the local driver
    homestay_commission NUMERIC(10, 2) GENERATED ALWAYS AS (quoted_price - COALESCE(vendor_cost, 0.00)) STORED,
    dispatch_status dispatch_status NOT NULL DEFAULT 'pending_confirmation',
    assigned_driver_name TEXT,
    assigned_driver_phone TEXT,
    vehicle_plate_number TEXT,
    confirmed_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    charge_posted_to_folio BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_requests_dispatch ON transport_requests(dispatch_status, pickup_datetime);
CREATE INDEX IF NOT EXISTS idx_transport_requests_folio ON transport_requests(folio_id);

-- ==============================================================================
-- 9. OPERATIONS HUB & HOUSEKEEPING
-- ==============================================================================

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES physical_rooms(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL DEFAULT CURRENT_DATE,
    task_type housekeeping_status NOT NULL DEFAULT 'light_refresh',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'inspected', 'completed')),
    assigned_to UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    checklist JSONB DEFAULT '{"linens_changed": false, "toiletries_restocked": false, "fireplace_prepped": false, "balcony_cleaned": false}'::jsonb,
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_housekeeping_date ON housekeeping_tasks(schedule_date, status);

-- ==============================================================================
-- 10. FINANCIAL LEDGER & EXPENSE LOGGER (ADMIN ONLY)
-- Strict RBAC isolation: Managers and Kitchen staff have no access
-- ==============================================================================

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method payment_method_type NOT NULL, -- Cash, UPI, Bank Transfer
    master_category expense_master_category NOT NULL,
    sub_tag TEXT NOT NULL, -- e.g., 'Produce', 'Dairy', 'Meat', 'Pantry', 'LPG', 'Electricity', 'WiFi', 'Salaries'
    vendor_payee TEXT, -- e.g., 'Manali Local Farmers Market', 'HP State Electricity Board'
    description TEXT NOT NULL,
    bill_receipt_url TEXT, -- Uploaded photo or PDF of the receipt
    logged_by UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(master_category, sub_tag);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);

-- ==============================================================================
-- 11. AUDIT LOGS FOR FINANCIAL AND DISPATCH ACTIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    user_role staff_role,
    action TEXT NOT NULL, -- 'CREATE_EXPENSE', 'SETTLE_FOLIO', 'DISPATCH_TRANSPORT', 'OVERRIDE_CHARGE'
    entity_type TEXT NOT NULL, -- 'expenses', 'guest_folios', 'transport_requests'
    entity_id UUID,
    old_state JSONB,
    new_state JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(user_id, created_at);
