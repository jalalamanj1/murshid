/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabase';
import { toLatinDigits } from './format';

/**
 * The single Telegram channel this card represents. The feed is deliberately
 * scoped to this one channel — it is not a generic feed.
 */
export const MURSHID_CHANNEL_USERNAME = '@murshid_app';
const MURSHID_CHANNEL_HANDLE = 'murshid_app';
const MURSHID_CHANNEL_NAME = 'مرشد';
const MURSHID_CHANNEL_URL = `https://t.me/${MURSHID_CHANNEL_HANDLE}`;

export { MURSHID_CHANNEL_NAME, MURSHID_CHANNEL_URL };

/** Rows requested per page. Kept small so a long channel never floods memory. */
export const MURSHID_PAGE_SIZE = 15;

/**
 * Background reconciliation window (ms). Deliberately coarse: Realtime covers
 * the instant case, this only guards against a missed event.
 */
export const MURSHID_SYNC_INTERVAL_MS = 45_000;

/** Column list mirrors the real `public.telegram_posts` schema. */
const POST_COLUMNS =
  'id,channel_name,channel_username,telegram_message_id,text,caption,' +
  'media_url,media_type,telegram_post_url,published_at,channel_id,deleted_at';

/** Same list without the soft-delete column, for pre-migration compatibility. */
const POST_COLUMNS_LEGACY =
  'id,channel_name,channel_username,telegram_message_id,text,caption,' +
  'media_url,media_type,telegram_post_url,published_at,channel_id';

interface TelegramPostRow {
  id: string | null;
  channel_name: string | null;
  channel_username: string | null;
  telegram_message_id: number | string | null;
  text: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  telegram_post_url: string | null;
  published_at: string | null;
  channel_id: number | string | null;
  deleted_at: string | null;
}

export type MediaKind = 'photo' | 'video' | 'document';

export interface MurshidPost {
  /**
   * Stable identity = `telegram_message_id`. Survives edits, and is what
   * de-duplication and every merge operation key on.
   */
  id: string;
  /** Row primary key. Needed to match Realtime DELETE payloads. */
  rowId: string | null;
  messageId: string;
  /** Post text when present, otherwise the media caption. Never synthesised. */
  body: string;
  hasText: boolean;
  /**
   * Resolved media location, or null when the stored value is not a
   * browser-fetchable URL (for example a bare Telegram `file_id`).
   */
  mediaUrl: string | null;
  mediaKind: MediaKind | null;
  /** True when media exists but cannot be displayed inline. */
  mediaUnavailable: boolean;
  /** Original Telegram permalink, or one rebuilt from the message id. */
  url: string;
  publishedAt: string;
  /**
   * Set when the row is soft-deleted. A post that is null here is still visible;
   * the feed filters these out and hides them the moment Realtime reports one.
   */
  deletedAt: string | null;
  channelName: string;
  username: string;
}

/** One page of results plus the cursor needed to request the next one. */
export interface MurshidPage {
  posts: MurshidPost[];
  /** Cursor for the next page; null when the feed is exhausted. */
  nextCursor: { publishedAt: string; messageId: number } | null;
  /**
   * True when this page is the complete dataset for the channel. Only then is
   * it safe to conclude a post we hold no longer exists.
   */
  authoritative: boolean;
}

export type MurshidPageResult =
  | { status: 'ok'; page: MurshidPage }
  | { status: 'error' };

/** A single change emitted by the Realtime subscription. */
export type MurshidChange =
  | { type: 'insert'; post: MurshidPost }
  | { type: 'update'; post: MurshidPost }
  | { type: 'delete'; id: string | null; rowId: string | null };

function mediaKind(raw: string | null): MediaKind | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (value.includes('video') || value.includes('mp4') || value.includes('.mov')) return 'video';
  if (value.includes('document') || value.includes('file') || value.includes('pdf')) return 'document';
  if (value.includes('photo') || value.includes('image') || value.includes('jpeg') || value.includes('png')) {
    return 'photo';
  }
  return 'document';
}

/**
 * A stored `media_url` is only usable inline when it is an absolute http(s) URL.
 * Telegram `file_id` values are opaque identifiers, so they must never be handed
 * to an <img>/<video> tag — the media is reported as unavailable instead.
 */
function resolveMediaUrl(raw: string | null, kind: MediaKind | null): { url: string | null; unavailable: boolean } {
  const value = (raw || '').trim();
  if (!value || !kind) return { url: null, unavailable: false };
  if (/^https?:\/\//i.test(value)) return { url: value, unavailable: false };
  // Non-empty but not a URL (e.g. a Telegram file_id).
  return { url: null, unavailable: true };
}

function isOurChannel(username: string | null | undefined): boolean {
  return (username || '').replace(/^@/, '') === MURSHID_CHANNEL_HANDLE;
}

function toPost(row: TelegramPostRow): MurshidPost {
  const messageId = row.telegram_message_id == null ? '' : String(row.telegram_message_id);
  const text = (row.text || '').trim();
  const caption = (row.caption || '').trim();
  const body = text || caption;
  const kind = mediaKind(row.media_type);
  const media = resolveMediaUrl(row.media_url, kind);

  return {
    // Falls back to a composite only for malformed rows with no message id.
    id: messageId || `${row.published_at || ''}|${row.id || ''}`,
    rowId: row.id == null ? null : String(row.id),
    messageId,
    body,
    hasText: body.length > 0,
    mediaUrl: media.url,
    mediaKind: kind,
    mediaUnavailable: media.unavailable,
    url: (row.telegram_post_url || '').trim() || (messageId ? `${MURSHID_CHANNEL_URL}/${messageId}` : ''),
    publishedAt: row.published_at || '',
    deletedAt: row.deleted_at || null,
    channelName: (row.channel_name || '').trim() || MURSHID_CHANNEL_NAME,
    username: MURSHID_CHANNEL_USERNAME,
  };
}

/** Newest first, with `telegram_message_id` as a stable tie-breaker. */
export function compareMurshidPosts(a: MurshidPost, b: MurshidPost): number {
  const at = Date.parse(a.publishedAt) || 0;
  const bt = Date.parse(b.publishedAt) || 0;
  if (bt !== at) return bt - at;
  return (Number(b.messageId) || 0) - (Number(a.messageId) || 0);
}

let cachedChannelId: string | null | undefined;

/**
 * Resolves the `telegram_channels` row id so posts whose `channel_username` is
 * missing can still be matched through `channel_id`. The handle is stored with
 * and without a leading "@" in the wild, so both are tried. Cached per session.
 */
async function resolveChannelId(): Promise<string | null> {
  if (cachedChannelId !== undefined) return cachedChannelId;

  for (const candidate of [MURSHID_CHANNEL_USERNAME, MURSHID_CHANNEL_HANDLE]) {
    try {
      const { data, error } = await supabase!
        .from('telegram_channels')
        .select('id')
        .eq('username', candidate)
        .maybeSingle();
      if (!error && data && data.id != null) {
        cachedChannelId = String(data.id);
        return cachedChannelId;
      }
    } catch {
      /* fall through to the next candidate */
    }
  }

  cachedChannelId = null;
  return cachedChannelId;
}

function buildChannelFilter(channelId: string | null): string {
  const filters = [
    `channel_username.eq.${MURSHID_CHANNEL_USERNAME}`,
    `channel_username.eq.${MURSHID_CHANNEL_HANDLE}`,
  ];
  if (channelId) filters.push(`channel_id.eq.${channelId}`);
  return filters.join(',');
}

/**
 * Runs one page query, hiding soft-deleted rows.
 *
 * `deleted_at` is added by a migration the project owner has to apply. Until it
 * is applied PostgREST rejects the column, so the query is retried without it
 * rather than leaving the feed dead. Once the column exists the soft-delete
 * filter is always applied.
 */
let supportsDeletedAt = true;

type FeedQuery = (qb: ReturnType<typeof supabase.from>, columns: string) => any;

async function runFeedQuery(
  build: FeedQuery,
): Promise<{ data: TelegramPostRow[] | null; error: { message: string } | null }> {
  if (supportsDeletedAt) {
    const withFilter = await build(supabase!.from('telegram_posts'), POST_COLUMNS).is(
      'deleted_at',
      null
    );
    if (!withFilter.error) {
      return withFilter as { data: TelegramPostRow[] | null; error: null };
    }
    if (!/deleted_at/i.test(withFilter.error.message)) {
      // A real failure, unrelated to the migration.
      return withFilter as { data: TelegramPostRow[] | null; error: { message: string } | null };
    }
    // Column not deployed yet — remember that and degrade below.
    supportsDeletedAt = false;
    if (import.meta.env.DEV) {
      console.warn(
        '[murshid] telegram_posts.deleted_at is missing; soft-deleted posts stay visible until the migration is applied.'
      );
    }
  }

  const legacy = await build(supabase!.from('telegram_posts'), POST_COLUMNS_LEGACY);
  return legacy as { data: TelegramPostRow[] | null; error: { message: string } | null };
}

/**
 * Loads one page of stored posts for @murshid_app, newest first. The renderer
 * only reads rows the webhook already wrote — it never calls the Telegram Bot API.
 *
 * Paging uses a keyset cursor on (published_at, telegram_message_id) rather than
 * OFFSET, so concurrent inserts cannot shift rows between pages and produce
 * duplicates or gaps.
 */
export async function fetchMurshidFeedPage(cursor?: {
  publishedAt: string;
  messageId: number;
}): Promise<MurshidPageResult> {
  if (!supabase) return { status: 'error' };

  try {
    const channelId = await resolveChannelId();
    const { data, error } = await runFeedQuery((qb, columns) => {
      let query = qb
        .select(columns)
        .or(buildChannelFilter(channelId))
        .order('published_at', { ascending: false })
        .order('telegram_message_id', { ascending: false });

      if (cursor && cursor.publishedAt) {
        // Strictly older than the cursor row, ordered consistently on both keys.
        query = query.or(
          `published_at.lt.${cursor.publishedAt},` +
            `and(published_at.eq.${cursor.publishedAt},telegram_message_id.lt.${cursor.messageId})`
        );
      }

      return query.limit(MURSHID_PAGE_SIZE + 1);
    });
    if (error) return { status: 'error' };

    const rows = (data as unknown as TelegramPostRow[] | null) ?? [];
    const hasMore = rows.length > MURSHID_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, MURSHID_PAGE_SIZE) : rows;
    // Defensive: a soft-deleted row never reaches the feed even if a stale page
    // or a Realtime payload slips one through.
    const posts = pageRows.filter((row) => !row.deleted_at).map(toPost);

    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last && last.published_at && last.telegram_message_id != null
        ? { publishedAt: last.published_at, messageId: Number(last.telegram_message_id) }
        : null;

    return {
      status: 'ok',
      // No cursor means there is nothing after this page, so it is the whole
      // dataset and absence really does mean "gone".
      page: { posts, nextCursor, authoritative: nextCursor === null },
    };
  } catch {
    // Technical details stay out of the UI on purpose.
    return { status: 'error' };
  }
}

function rowFromPayload(payload: unknown): TelegramPostRow | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload as TelegramPostRow;
}

/**
 * Maps a Realtime INSERT/UPDATE payload for our channel to a post.
 * Returns null for any other channel so it can never enter the feed.
 */
export function postFromRealtimeRow(payload: unknown): MurshidPost | null {
  const row = rowFromPayload(payload);
  if (!row) return null;
  if (!isOurChannel(row.channel_username)) return null;
  if (row.telegram_message_id == null) return null;
  return toPost(row);
}

/**
 * Subscribes to INSERT / UPDATE / DELETE on the channel's rows.
 *
 * Each event gets its own channel on purpose. The deployed project currently
 * publishes no events for this table, and a rejected subscription takes its
 * whole channel down with it — mixing events together meant a rejection could
 * cost us the working ones. Isolating them means an unsupported event can never
 * take out a supported one, and any channel that errors is dropped instead of
 * retried forever.
 *
 * To turn the live path on, publish the table once in the Supabase SQL editor
 * (the browser never needs write access):
 *
 *   alter publication supabase_realtime add table public.telegram_posts;
 *
 * Until then, the periodic reconciliation covers the same ground.
 *
 * A soft delete arrives as an UPDATE that sets `deleted_at`, and the component
 * removes the item. A physical DELETE arrives as a DELETE event. Both are
 * handled. Note that `change.old` only carries the primary key under the
 * default replica identity, so `rowId` is the reliable handle there and
 * `telegram_message_id` is a best-effort fallback.
 */
export function subscribeToMurshidPosts(onChange: (change: MurshidChange) => void): () => void {
  if (!supabase) return () => {};

  const created: Array<ReturnType<typeof supabase.channel>> = [];

  /** Subscribes and drops the channel if the server refuses it. */
  const subscribeIsolated = (
    name: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE',
    handler: (payload: unknown) => void
  ) => {
    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table: 'telegram_posts',
          filter: `channel_username=eq.${MURSHID_CHANNEL_USERNAME}`,
        },
        handler
      )
      .subscribe((status) => {
        // The server rejected this event; stop retrying so it cannot churn.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          try {
            supabase.removeChannel(channel);
          } catch {
            /* already gone */
          }
        }
      });
    created.push(channel);
  };

  const onUpsert = (type: 'insert' | 'update') => (payload: unknown) => {
    const record = payload as { new?: unknown } | null;
    const post = postFromRealtimeRow(record?.new);
    if (post) onChange({ type, post });
  };
  const onDelete = (payload: unknown) => {
    const record = payload as { old?: unknown } | null;
    const row = rowFromPayload(record?.old);
    if (!row) return;
    const id = row.telegram_message_id == null ? null : String(row.telegram_message_id);
    onChange({ type: 'delete', id, rowId: row.id == null ? null : String(row.id) });
  };

  try {
    // Guaranteed-supported path: new posts arrive live.
    subscribeIsolated('murshid-dashboard-posts-insert', 'INSERT', onUpsert('insert'));
    subscribeIsolated('murshid-dashboard-posts-update', 'UPDATE', onUpsert('update'));
    subscribeIsolated('murshid-dashboard-posts-delete', 'DELETE', onDelete);
  } catch {
    return () => {};
  }

  return () => {
    for (const channel of created) {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* nothing to clean up */
      }
    }
  };
}

/** Renders the stored publish timestamp in the app's Arabic locale. */
export function formatTelegramDate(iso: string): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return toLatinDigits(
    parsed.toLocaleString('ar-IQ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  );
}

/** Opens a Telegram link in the user's real browser rather than in-app. */
export function openExternal(url: string): void {
  if (!url) return;
  const open = (window as any).electronAPI?.openExternal;
  if (typeof open === 'function') {
    open(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}