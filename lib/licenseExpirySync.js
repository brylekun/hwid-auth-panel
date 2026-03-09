import { supabaseAdmin } from './supabaseAdmin';

function nowIso() {
  return new Date().toISOString();
}

export async function deactivateExpiredLicenses() {
  const { error } = await supabaseAdmin
    .from('licenses')
    .update({ status: 'inactive' })
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso());

  if (error) {
    console.error('Failed to deactivate expired licenses:', error.message || error);
  }
}

export async function deactivateExpiredLicenseByKey(licenseKey) {
  if (!licenseKey) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('licenses')
    .update({ status: 'inactive' })
    .eq('license_key', licenseKey)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso());

  if (error) {
    console.error('Failed to deactivate expired license by key:', error.message || error);
  }
}
