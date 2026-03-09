import { supabaseAdmin } from './supabaseAdmin';

export async function writeAdminAuditLog({
  adminUsername,
  actionType,
  targetType,
  targetId = null,
  targetValue = null,
  metadata = {},
}) {
  try {
    const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
      admin_username: adminUsername || 'unknown',
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      target_value: targetValue,
      metadata,
    });

    if (error) {
      console.error('Failed to write admin audit log:', error.message);
    }
  } catch (error) {
    console.error('Failed to write admin audit log:', error);
  }
}
