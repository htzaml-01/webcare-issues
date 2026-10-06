-- ==========================================================================
-- WEBCARE ISSUES - SUPABASE DATABASE SCHEMA & REALTIME SETUP
-- Run this SQL in your Supabase Project's SQL Editor (https://supabase.com/dashboard)
-- ==========================================================================

-- 1. Create the `tickets` table
CREATE TABLE IF NOT EXISTS public.tickets (
    id TEXT PRIMARY KEY,                       -- e.g. '#00001', '#00002'
    reporter TEXT NOT NULL,                   -- Client name
    email TEXT NOT NULL,                      -- Client email
    phone TEXT,                               -- WhatsApp phone number
    website TEXT,                             -- Website URL
    details TEXT NOT NULL,                    -- Issue description & steps to reproduce
    file_count INTEGER DEFAULT 0,             -- Number of attachments
    files JSONB DEFAULT '[]'::jsonb,          -- Array of attachment metadata [{name, size, type, url}]
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'working', 'done')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    completed_at TIMESTAMPTZ
);

-- 2. Create index on status, created_at for fast queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for Anon (Public) access
-- Allow anyone (clients) to submit new tickets
DROP POLICY IF EXISTS "Public can insert tickets" ON public.tickets;
CREATE POLICY "Public can insert tickets"
ON public.tickets FOR INSERT
WITH CHECK (true);

-- Allow anyone to read tickets (client lookup & admin dashboard)
DROP POLICY IF EXISTS "Public can view tickets" ON public.tickets;
CREATE POLICY "Public can view tickets"
ON public.tickets FOR SELECT
USING (true);

-- Allow updates (e.g. changing status from pending -> working -> done)
DROP POLICY IF EXISTS "Public can update tickets" ON public.tickets;
CREATE POLICY "Public can update tickets"
ON public.tickets FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow delete (clear queue in admin)
DROP POLICY IF EXISTS "Public can delete tickets" ON public.tickets;
CREATE POLICY "Public can delete tickets"
ON public.tickets FOR DELETE
USING (true);

-- 5. Enable Supabase Realtime for instant live queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;

-- 6. Setup Supabase Storage Bucket for File/Screenshot Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
CREATE POLICY "Public can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS "Public can upload attachments" ON storage.objects;
CREATE POLICY "Public can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS "Public can delete attachments" ON storage.objects;
CREATE POLICY "Public can delete attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'ticket-attachments');

-- Done! Your Supabase database is ready to receive tickets in real-time.
