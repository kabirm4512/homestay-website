-- Room 103 becomes its own room type: "Deluxe Valley View with Balcony" (room-cat-4).
-- Rooms 101 and 102 stay "Deluxe Mountain View with Balcony" (room-cat-1, now 2 rooms).
-- Data only, idempotent. Room 103 keeps the same prices it had (copied into room-cat-4);
-- change them any time in Rooms -> Tariffs & Meal Plans.

-- 1. The new room type, copied from room-cat-1 (photos included until new ones are uploaded)
insert into pms.room_categories (id, sort_order, is_active, data, updated_at)
select 'room-cat-4', c.sort_order, true,
       (c.data - 'tariffs' - 'price_per_night' - 'weekend_price' - 'base_adults' - 'extra_adult_charge' - 'extra_child_charge')
       || jsonb_build_object(
            'id', 'room-cat-4',
            'name', 'Deluxe Valley View with Balcony',
            'slug', 'deluxe-valley-view-balcony',
            'tagline', 'Green Valley Views & Private Balcony (Room 103)',
            'description', 'A first-floor balcony room looking out over the green valley below. Warm deodar cedar timber work, a king bed with organic cotton duvets, an artisanal tea/coffee bar, heated blankets and a luxury en-suite rain shower.',
            'amenities', jsonb_build_array('Private Valley-View Balcony', 'High-Speed Starlink Wi-Fi', 'Artisanal Tea Station', 'Heated Blankets', 'En-Suite Glass Rain Shower', 'Complimentary Farmhouse Breakfast'),
            'total_inventory', 1,
            'available_inventory', 1,
            'is_active', true,
            'created_at', now(),
            'updated_at', now()),
       now()
from pms.room_categories c
where c.id = 'room-cat-1'
on conflict (id) do nothing;

-- 2. Rooms 101 and 102 only in room-cat-1
update pms.room_categories
set data = data || jsonb_build_object(
      'total_inventory', 2,
      'available_inventory', 2,
      'tagline', replace(coalesce(data->>'tagline', ''), '(Rooms 101, 102, 103)', '(Rooms 101, 102)'),
      'updated_at', now()),
    updated_at = now()
where id = 'room-cat-1';

-- 3. Physical room 103 moves to the new type (and its past desk bookings follow it)
update pms.physical_rooms
set category_id = 'room-cat-4',
    data = data || jsonb_build_object('categoryId', 'room-cat-4', 'categoryCode', 'deluxe_valley', 'categoryName', 'Deluxe Valley View with Balcony'),
    updated_at = now()
where id = 'room-103';

update pms.bookings
set category_ids = array['room-cat-4'], updated_at = now()
where kind = 'crm' and physical_room_id = 'room-103';

-- 4. Prices: room-cat-4 starts with room 103's current tariff
update pms.settings
set value = jsonb_set(value, '{tariffs,room-cat-4}', coalesce(value->'tariffs'->'room-103', value->'tariffs'->'room-cat-1')),
    updated_at = now()
where key = 'room_tariffs'
  and value ? 'tariffs'
  and not (value->'tariffs' ? 'room-cat-4')
  and coalesce(value->'tariffs'->'room-103', value->'tariffs'->'room-cat-1') is not null;
