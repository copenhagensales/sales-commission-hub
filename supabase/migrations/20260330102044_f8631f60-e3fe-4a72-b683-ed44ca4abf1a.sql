CREATE UNIQUE INDEX booking_vehicle_vehicle_id_date_unique 
ON public.booking_vehicle (vehicle_id, date) 
WHERE vehicle_id != '4bc2a169-b00c-4f42-8112-9f3bd097c637';