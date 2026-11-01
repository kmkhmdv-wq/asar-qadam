-- Migration: 20261101140000_add_test_accounts_support.sql
-- Description: Add is_test and must_change_password columns for isolated QA test accounts

-- 1. Users table test account flags
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Index for high-performance exclusion in analytics and employee queries
CREATE INDEX IF NOT EXISTS idx_users_is_test ON public.users(is_test);

-- 2. Specialists table test flag
ALTER TABLE public.specialists 
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_specialists_is_test ON public.specialists(is_test);
