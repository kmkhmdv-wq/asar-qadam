import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tvsoueelaghtearrnxpm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2c291ZWVsYWdodGVhcnJueHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NjM2NTEsImV4cCI6MjEwOTAzOTY1MX0.WzTTPsDQ5SjpL9RfeaDUXk9ESou6_a152ed9_Pedk-I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
