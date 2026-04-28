-- Change new shop trial duration from 14 days to 7 days.
ALTER TABLE public.shops
ALTER COLUMN expiry_date SET DEFAULT (now() + interval '7 days');
