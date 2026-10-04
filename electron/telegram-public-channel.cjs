'use strict';

/**
 * Read-only reader for a Telegram PUBLIC channel web view.
 *
 * Fetches https://t.me/s/<username> and returns only the text/photo/date needed
 * by the dashboard card. This is NOT the Bot API:
 *   - no bot token, no user session, no credentials of any kind;
 *   - nothing is posted, edited or deleted through it;
 *   - it runs in the Electron main process, never in the renderer.
 *
 * Because it reflects whatever the public page currently renders, a message that
 * is deleted or edited upstream simply stops being returned on the next read.
 * Nothing is cached across reads, so the caller never shows a tombstoned post as
 * if it were live.
 */

const PUBLIC_ORIGIN = 'https://t.me';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_POSTS = 40;

/** Only these usernames may ever be requested, so this can never become an open proxy. */
const ALLOWED_CHANNELS = new Set(['murshid_app']);

const CHANNEL_USERNAME_RE = /^[A-Za-z0-9_]{4,64}$/;

function assertAllowedChannel(username) {
  const name = String(username || '').trim().replace(/^@/, '');
  if (!CHANNEL_USERNAME_RE.test(name)) throw new Error('invalid channel username');
  if (!ALLOWED_CHANNELS.has(name.toLowerCase())) throw new Error('channel not allowed');
  return name.toLowerCase();
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
  laquo: '\u00ab', raquo: '\u00bb', ldquo: '\u201c', rdquo: '\u201d',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', rsquo: '\u2019',
  lsquo: '\u2018', ldblquo: '\u00ab', rdblquo: '\u00bb', times: '\u00d7',
};

function decodeEntities(input) {
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : m))
    .replace(/&(?![a-z]+;|#\d+;|#x[0-9a-f]+;)\s+/gi, '');
}

/**
 * Telegram renders message bodies as a small subset of HTML. Convert to plain
 * text: no markup is ever handed back to the renderer, so remote HTML can never
 * be injected into the DOM.
 */
function messageBodyToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|blockquote|li)>/gi, '\n')
      .replace(/<li\s*[^>]*>/gi, '\u2022 ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Accept only real remote media URLs; blocks javascript:/data: and friends. */
function safeMediaUrl(candidate) {
  const value = decodeEntities(String(candidate || '')).trim().replace(/^['"]|['"]$/g, '');
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

function firstMatch(segment, regex) {
  const m = segment.match(regex);
  return m ? m[1] : null;
}

/**
 * Split the page into message blocks. Telegram emits one
 * `tgme_widget_message_wrap` element per message, oldest first.
 */
function parseChannelHtml(html, username) {
  const posts = [];
  const marker = /<div class="tgme_widget_message_wrap/g;
  const starts = [];
  let m;
  while ((m = marker.exec(html)) !== null) starts.push(m.index);
  if (starts.length === 0) return posts;

  for (let i = 0; i < starts.length; i += 1) {
    const segment = html.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : html.length);

    const dataPost = firstMatch(segment, /data-post="([^"]+)"/);
    if (!dataPost) continue;

    // data-post looks like "<username>/<messageId>"; only keep this channel's own.
    const slash = dataPost.lastIndexOf('/');
    if (slash < 0) continue;
    const postChannel = dataPost.slice(0, slash).toLowerCase();
    const messageId = Number.parseInt(dataPost.slice(slash + 1), 10);
    if (postChannel !== username.toLowerCase() || !Number.isFinite(messageId)) continue;

    const bodyHtml = firstMatch(
      segment,
      /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    const datetime = firstMatch(segment, /datetime="([^"]+)"/);

    const photoRaw =
      firstMatch(segment, /tgme_widget_message_photo_wrap[^>]*background-image:url\(([^)]+)\)/) ||
      firstMatch(segment, /<img[^>]+class="tgme_widget_message_photo[^>]*src="([^"]+)"/);
    const videoRaw = firstMatch(
      segment,
      /tgme_widget_message_video_thumb[^>]*background-image:url\(([^)]+)\)/
    );

    const viewsRaw = firstMatch(segment, /tgme_widget_message_views">([^<]*)</);
    const views = viewsRaw ? Number.parseInt(viewsRaw.replace(/[^\d]/g, ''), 10) : NaN;

    posts.push({
      messageId,
      text: bodyHtml === null ? '' : messageBodyToText(bodyHtml),
      publishedAt: datetime || null,
      photoUrl: safeMediaUrl(photoRaw),
      videoThumbUrl: safeMediaUrl(videoRaw),
      views: Number.isFinite(views) ? views : null,
      link: `${PUBLIC_ORIGIN}/${username}/${messageId}`,
      isService: /service_message/.test(segment),
      edited: /tgme_widget_message_meta_edited/.test(segment),
    });
  }

  // Newest first, bounded, so a long channel cannot grow the payload.
  posts.sort((a, b) => {
    const at = Date.parse(a.publishedAt || '') || 0;
    const bt = Date.parse(b.publishedAt || '') || 0;
    if (bt !== at) return bt - at;
    return b.messageId - a.messageId;
  });
  return posts.slice(0, MAX_POSTS);
}

/** Read the current public state of one allowed channel. */
async function readPublicChannel(username, options = {}) {
  const channel = assertAllowedChannel(username);
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let html;
  try {
    const res = await fetchImpl(`${PUBLIC_ORIGIN}/s/${channel}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) throw new Error(`telegram responded ${res.status}`);
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  return {
    channel,
    source: `${PUBLIC_ORIGIN}/s/${channel}`,
    fetchedAt: new Date().toISOString(),
    posts: parseChannelHtml(html, channel),
  };
}

module.exports = { readPublicChannel, parseChannelHtml, messageBodyToText, assertAllowedChannel, ALLOWED_CHANNELS };
