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
    .limit(5);

  if (error) throw error;
  return data || [];
}

export async function getAdminAuditLogs() {
  const { data, error } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}
