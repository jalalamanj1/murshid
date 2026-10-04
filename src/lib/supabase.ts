/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Read-only Supabase access for the dashboard.
 *
 * Only the public `anon` key is used here — it is safe to ship in the renderer
 * because row-level security on the project governs what it can read. The
 * service-role key and the Telegram bot token never reach the browser; posts are
 * written by the webhook in the main process and read back from here.
 *
 * The client is created lazily-tolerant: if the environment variables are absent
 * the app still boots and the Telegram card shows its unavailable state instead
 * of throwing during module initialisation.
 */
const url = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 2 } },
    })
  : null;