/**
 * Display source for the "مرشد" card.
 *
 * This module deliberately does NOT read Supabase. The card represents the live
 * public Telegram channel page (https://t.me/s/murshid_app). The renderer never
 * fetches that URL itself and never parses HTML: it asks the Electron main
 * process, which performs a credential-free read and returns plain text.
 *
 * Consequences that matter:
 *   - a message deleted upstream simply stops being returned, so it disappears;
 *   - an edited message comes back with its new text under the same id;
 *   - nothing is merged with, or retained from, any local copy, so a post that
 *     is no longer public can never be shown as if it were still there.
 */

/** Matches the requested 30–60s cadence without hammering the public page. */
export const MURSHID_PUBLIC_REFRESH_MS = 45_000;

export const MURSHID_PUBLIC_CHANNEL = 'murshid_app';

export const MURSHID_PUBLIC_CHANNEL_USERNAME = '@murshid_app';

export const MURSHID_PUBLIC_CHANNEL_LABEL = 'Murshid - مرشد';

export interface PublicChannelPost {
  messageId: number;
  text: string;
  publishedAt: string | null;
  photoUrl: string | null;
  videoThumbUrl: string | null;
  views: number | null;
  link: string | null;
  isService: boolean;
  edited: boolean;
}

export interface PublicChannelSnapshot {
  channel: string;
  source: string | null;
  fetchedAt: string | null;
  posts: PublicChannelPost[];
  error?: string;
}

function bridge(): { getPublicChannelPosts?: (u: string) => Promise<PublicChannelSnapshot> } | undefined {
  return (window as any).electronAPI;
}

/**
 * Read the channel's current public state.
 *
 * Throws when the read fails so the caller can decide what to display; it never
 * returns an empty list to paper over a network or parse failure.
 */
export async function fetchPublicChannelPosts(
  channel: string = MURSHID_PUBLIC_CHANNEL
): Promise<PublicChannelSnapshot> {
  const read = bridge()?.getPublicChannelPosts;
  if (typeof read !== 'function') {
    throw new Error('public channel reader is unavailable');
  }
  const snapshot = await read(channel);
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('public channel reader returned nothing');
  }
  if (snapshot.error) throw new Error(snapshot.error);
  return snapshot;
}

/** Only keep entries this channel could legitimately contain. */
function normalize(snapshot: PublicChannelSnapshot, channel: string): PublicChannelPost[] {
  if (snapshot.channel && snapshot.channel.toLowerCase() !== channel.toLowerCase()) return [];
  return (snapshot.posts || []).filter((p) => Number.isFinite(p?.messageId));
}

export function sortPublicPosts(posts: PublicChannelPost[]): PublicChannelPost[] {  return posts.slice().sort((a, b) => {
    const at = Date.parse(a.publishedAt || '') || 0;
    const bt = Date.parse(b.publishedAt || '') || 0;
    if (bt !== at) return bt - at;
    return b.messageId - a.messageId;
  });
}

export function formatPublicPostDate(iso: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('ar-IQ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Short "last updated" stamp used to make stale content obviously stale. */
export function formatFetchedAt(iso: string | null): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export interface PublicChannelFeedOptions {
  channel?: string;
  intervalMs?: number;
  onUpdate: (posts: PublicChannelPost[], fetchedAt: string) => void;
  onError: (message: string) => void;
}

/**
 * Poll the public channel while the dashboard is visible.
 *
 * Ticks at `intervalMs`, immediately on becoming visible/focused, and never
 * while hidden. Nothing is scheduled when the window is closed.
 */
export function subscribeToPublicChannel(options: PublicChannelFeedOptions): () => void {
  const channel = options.channel || MURSHID_PUBLIC_CHANNEL;
  const intervalMs = options.intervalMs || MURSHID_PUBLIC_REFRESH_MS;
  let stopped = false;
  let inFlight = false;
  let timer: number | null = null;

  async function refresh(): Promise<void> {
    if (stopped || inFlight) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    inFlight = true;
    try {
      const snapshot = await fetchPublicChannelPosts(channel);
      if (stopped) return;
      options.onUpdate(sortPublicPosts(normalize(snapshot, channel)), snapshot.fetchedAt || new Date().toISOString());
    } catch (err) {
      if (stopped) return;
      options.onError(err instanceof Error ? err.message : String(err));
    } finally {
      inFlight = false;
    }
  }

  function schedule(): void {
    if (stopped) return;
    if (timer !== null) clearInterval(timer);
    timer = window.setInterval(refresh, intervalMs);
  }

  function onVisibility(): void {
    if (stopped) return;
    if (!document.hidden) void refresh();
  }

  void refresh();
  schedule();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onVisibility);

  return () => {
    stopped = true;
    if (timer !== null) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onVisibility);
  };
}
