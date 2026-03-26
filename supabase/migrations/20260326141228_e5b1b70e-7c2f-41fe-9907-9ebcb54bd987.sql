ALTER TABLE booking_hotel ADD COLUMN booked_days integer[] DEFAULT '{}';

UPDATE booking_hotel
SET booked_days = (
  SELECT array_agg(DISTINCT (EXTRACT(ISODOW FROM d::date) - 1)::integer ORDER BY (EXTRACT(ISODOW FROM d::date) - 1)::integer)
  FROM generate_series(check_in::date, check_out::date - interval '1 day', interval '1 day') AS d
)
WHERE check_in IS NOT NULL AND check_out IS NOT NULL;