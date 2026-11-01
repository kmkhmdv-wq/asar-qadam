-- Migration: 20261101130000_telegram_phone_verification.sql
-- Description: Add Telegram phone verification support and tg_verifications table with RLS

-- 1. Add phone verification and Telegram fields to public.users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS tg_chat_id bigint;

-- Synchronize existing verified accounts if phone_confirmed was 1
UPDATE public.users 
SET phone_verified = true, 
    phone_verified_at = COALESCE(phone_verified_at, now())
WHERE phone_confirmed = 1 AND phone_verified IS NOT TRUE;

-- 2. Create tg_verifications table
CREATE TABLE IF NOT EXISTS public.tg_verifications (
  token text PRIMARY KEY,
  user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  chat_id bigint,
  code_hash text,
  code_expires_at timestamptz,
  token_expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_tg_verifications_phone ON public.tg_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_tg_verifications_user_id ON public.tg_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_verifications_chat_id ON public.tg_verifications(chat_id);

-- 3. Enable RLS on tg_verifications without public policies
-- (Access is restricted to service_role only)
ALTER TABLE public.tg_verifications ENABLE ROW LEVEL SECURITY;

-- Revoke all permissions on tg_verifications from anon and authenticated
REVOKE ALL ON public.tg_verifications FROM anon, authenticated;
GRANT ALL ON public.tg_verifications TO service_role;

-- 4. Enable RLS on public.users and restrict unauthorized access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (service_role already bypasses RLS by default, grant explicitly)
GRANT ALL ON public.users TO service_role;

-- Allow authenticated users to view their own profile only
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT TO authenticated
  USING (email = auth.jwt()->>'email');

-- Allow authenticated users to update their own profile (excluding password and role)
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (email = auth.jwt()->>'email')
  WITH CHECK (email = auth.jwt()->>'email');
