import { supabaseAdmin } from './supabaseAdmin';

export async function getLicenses() {
  const { data, error } = await supabaseAdmin
    .from('licenses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getDevices() {
  const { data, error } = await supabaseAdmin
    .from('devices')
    .select('*')
    .order('first_seen_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAuthLogs() {
  const { data, error } = await supabaseAdmin
    .from('auth_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}