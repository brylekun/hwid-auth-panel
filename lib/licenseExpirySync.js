import { supabaseAdmin } from './supabaseAdmin';

const FIRST_LOGIN_EXPIRY_ACTIVATION_ACTION = 'activate_license_expiry';
const SESSION_HEARTBEAT_REASON = 'session_heartbeat';
const SESSION_RELEASE_REASON = 'session_release';

function nowIso() {
  return new Date().toISOString();
}

function startsExpiryOnFirstSuccessfulLogin() {
  const raw = String(process.env.AUTH_EXPIRY_STARTS_ON_FIRST_LOGIN ?? 'true')
    .trim()
    .toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

async function getApprovedLicenseKeySet(licenseKeys) {
  if (!Array.isArray(licenseKeys) || licenseKeys.length === 0) {
    return new Set();
  }

  const uniqueLicenseKeys = [...new Set(licenseKeys.filter(Boolean))];
  if (uniqueLicenseKeys.length === 0) {
    return new Set();
  }

  const { data, error } = await supabaseAdmin
    .from('auth_logs')
    .select('license_key')
    .in('license_key', uniqueLicenseKeys)
    .eq('result', 'approved')
    .neq('reason', SESSION_HEARTBEAT_REASON)
    .neq('reason', SESSION_RELEASE_REASON);

  if (error) {
    console.error('Failed to load approved auth history for expiry sync:', error.message || error);
    return new Set(uniqueLicenseKeys);
  }

  return new Set((data || []).map((row) => row.license_key).filter(Boolean));
}

async function getActivatedLicenseIdSet(licenseIds) {
  if (!Array.isArray(licenseIds) || licenseIds.length === 0) {
    return new Set();
  }

  const uniqueLicenseIds = [...new Set(licenseIds.filter(Boolean))];
  if (uniqueLicenseIds.length === 0) {
    return new Set();
  }

  const { data, error } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('target_id')
    .eq('action_type', FIRST_LOGIN_EXPIRY_ACTIVATION_ACTION)
    .eq('target_type', 'license')
    .in('target_id', uniqueLicenseIds);

  if (error) {
    console.error('Failed to load expiry activation markers:', error.message || error);
    return new Set(uniqueLicenseIds);
  }

  return new Set((data || []).map((row) => row.target_id).filter(Boolean));
}

export async function getFirstUsePendingMap(licenses) {
  const pendingMap = new Map();

  if (!Array.isArray(licenses) || licenses.length === 0) {
    return pendingMap;
  }

  for (const license of licenses) {
    pendingMap.set(license.id, false);
  }

  if (!startsExpiryOnFirstSuccessfulLogin()) {
    return pendingMap;
  }

  const candidates = licenses.filter(
    (license) => license?.id && license?.license_key && license?.status === 'active' && license?.expires_at
  );

  if (candidates.length === 0) {
    return pendingMap;
  }

  const [approvedKeys, activatedIds] = await Promise.all([
    getApprovedLicenseKeySet(candidates.map((license) => license.license_key)),
    getActivatedLicenseIdSet(candidates.map((license) => license.id)),
  ]);

  for (const license of candidates) {
    const isPending =
      !approvedKeys.has(license.license_key) &&
      !activatedIds.has(license.id);
    pendingMap.set(license.id, isPending);
  }

  return pendingMap;
}

export async function annotateLicensesWithExpiryState(licenses) {
  if (!Array.isArray(licenses) || licenses.length === 0) {
    return [];
  }

  const pendingMap = await getFirstUsePendingMap(licenses);
  return licenses.map((license) => ({
    ...license,
    expiry_pending_activation: Boolean(pendingMap.get(license.id)),
  }));
}

export async function deactivateExpiredLicenses() {
  if (!startsExpiryOnFirstSuccessfulLogin()) {
    const { error } = await supabaseAdmin
      .from('licenses')
      .update({ status: 'inactive' })
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso());

    if (error) {
      console.error('Failed to deactivate expired licenses:', error.message || error);
    }
    return;
  }

  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .from('licenses')
    .select('id, license_key, status, expires_at')
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso());

  if (candidatesError) {
    console.error('Failed to load expired license candidates:', candidatesError.message || candidatesError);
    return;
  }

  if (!candidates || candidates.length === 0) {
    return;
  }

  const pendingMap = await getFirstUsePendingMap(candidates);
  const idsToDeactivate = candidates
    .filter((license) => !pendingMap.get(license.id))
    .map((license) => license.id);

  if (idsToDeactivate.length === 0) {
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('licenses')
    .update({ status: 'inactive' })
    .in('id', idsToDeactivate);

  if (updateError) {
    console.error('Failed to deactivate expired licenses:', updateError.message || updateError);
  }
}

export async function deactivateExpiredLicenseByKey(licenseKey) {
  if (!licenseKey) {
    return;
  }

  if (!startsExpiryOnFirstSuccessfulLogin()) {
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
    return;
  }

  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from('licenses')
    .select('id, license_key, status, expires_at')
    .eq('license_key', licenseKey)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lte('expires_at', nowIso())
    .maybeSingle();

  if (candidateError) {
    console.error('Failed to load expired license by key:', candidateError.message || candidateError);
    return;
  }

  if (!candidate) {
    return;
  }

  const pendingMap = await getFirstUsePendingMap([candidate]);
  if (pendingMap.get(candidate.id)) {
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from('licenses')
    .update({ status: 'inactive' })
    .eq('id', candidate.id);

  if (updateError) {
    console.error('Failed to deactivate expired license by key:', updateError.message || updateError);
  }
}
