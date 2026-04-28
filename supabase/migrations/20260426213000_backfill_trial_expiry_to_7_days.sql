-- Backfill existing trial shops so trial length is 7 days from trial start.
-- This prevents older rows created under the 14-day default from still showing 14 days left.
UPDATE public.shops
SET expiry_date = trial_started_at + interval '7 days'
WHERE subscription_status = 'trial'
  AND trial_started_at IS NOT NULL
  AND expiry_date > trial_started_at + interval '7 days';
