
-- Enable Realtime for appointments and appointment_messages
BEGIN;

-- Check if publication exists, if not create it (usually supabase_realtime exists)
-- We assume supabase_realtime exists as it is standard in Supabase

-- Add tables to publication
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_messages;

COMMIT;
