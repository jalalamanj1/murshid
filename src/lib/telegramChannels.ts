/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TelegramChannel {
  /** Username without the leading "@" — used to build t.me links and fetch previews. */
  id: string;
  title: string;
  username: string;
  url: string;
  /** Arabic category tag shown beside the username. */
  tag: string;
  /** Existing `channel-*` colour class from index.css. */
  color: string;
  /** Single Arabic letter used as the avatar fallback. */
  letter: string;
}

/**
 * Single source of truth for the Telegram channels surfaced on the dashboard.
 * This is a static reference list, not a channel-management system: both the
 * "channels" card and the "مرشد" feed read from here so the selector can never
 * drift from the channels that are actually offered.
 */
export const TELEGRAM_CHANNELS: TelegramChannel[] = [
  {
    id: 'almadrase',
    title: 'موسوعة الإدارة المدرسية',
    username: '@almadrase',
    url: 'https://t.me/almadrase',
    tag: 'الإدارة المدرسية',
    color: 'channel-emerald',
    letter: 'م',
  },
  {
    id: 'b8a8b',
    title: 'بصمة مرشد',
    username: '@b8a8b',
    url: 'https://t.me/b8a8b',
    tag: 'إرشاد مهني',
    color: 'channel-amber',
    letter: 'ب',
  },
  {
    id: 'psychology95',
    title: 'مكتبة علم النفس',
    username: '@psychology95',
    url: 'https://t.me/psychology95',
    tag: 'علم النفس',
    color: 'channel-blue',
    letter: 'ك',
  },
  {
    id: 'Psychological_measurement_bag',
    title: 'حقيبة المقاييس النفسية',
    username: '@Psychological_measurement_bag',
    url: 'https://t.me/Psychological_measurement_bag',
    tag: 'المقاييس النفسية',
    color: 'channel-rose',
    letter: 'ح',
  },
  {
    id: 'eilmanafss',
    title: 'كتب علم النفس',
    username: '@eilmanafss',
    url: 'https://t.me/eilmanafss',
    tag: 'مراجع وكتب',
    color: 'channel-cyan',
    letter: 'ت',
  },
  {
    id: 'alarshad_altarbawii',
    title: 'كروب الارشاد التربوي العام',
    username: '@alarshad_altarbawii',
    url: 'https://t.me/alarshad_altarbawii',
    tag: 'مجتمع مهني',
    color: 'channel-purple',
    letter: 'ك',
  },
];

export const DEFAULT_TELEGRAM_CHANNEL_ID = 'eilmanafss';