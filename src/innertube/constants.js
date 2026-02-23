/**
 * YouTube InnerTube Constants
 * Translated from YouTubeClient.kt & YouTubeConstants.kt
 */

const USER_AGENT_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

const ORIGIN_YOUTUBE_MUSIC = 'https://music.youtube.com';
const REFERER_YOUTUBE_MUSIC = `${ORIGIN_YOUTUBE_MUSIC}/`;
const API_URL_YOUTUBE_MUSIC = `${ORIGIN_YOUTUBE_MUSIC}/youtubei/v1/`;

const CLIENTS = {
  WEB: {
    clientName: 'WEB',
    clientVersion: '2.20260213.00.00',
    clientId: '1',
    userAgent: USER_AGENT_WEB,
    loginSupported: false,
    useSignatureTimestamp: false,
    useWebPoTokens: false,
    isEmbedded: false,
  },
  WEB_REMIX: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20260213.01.00',
    clientId: '67',
    userAgent: USER_AGENT_WEB,
    loginSupported: true,
    useSignatureTimestamp: true,
    useWebPoTokens: true,
    isEmbedded: false,
  },
};

const SEARCH_FILTERS = {
  SONG: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  VIDEO: 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D',
  ALBUM: 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D',
  ARTIST: 'EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D',
  FEATURED_PLAYLIST: 'EgeKAQQoADgBagwQDhAKEAMQBRAJEAQ%3D',
  COMMUNITY_PLAYLIST: 'EgeKAQQoAEABagoQAxAEEAoQCRAF',
};

const LIBRARY_FILTERS = {
  RECENT_ACTIVITY: '4qmFsgIrEhdGRW11c2ljX2xpYnJhcnlfbGFuZGluZxoQZ2dNR0tnUUlCaEFCb0FZQg%3D%3D',
  RECENTLY_PLAYED: '4qmFsgIrEhdGRW11c2ljX2xpYnJhcnlfbGFuZGluZxoQZ2dNR0tnUUlCUkFCb0FZQg%3D%3D',
  PLAYLISTS_ALPHABETICAL: '4qmFsgIrEhdGRW11c2ljX2xpa2VkX3BsYXlsaXN0cxoQZ2dNR0tnUUlBUkFBb0FZQg%3D%3D',
  PLAYLISTS_RECENTLY_SAVED: '4qmFsgIrEhdGRW11c2ljX2xpa2VkX3BsYXlsaXN0cxoQZ2dNR0tnUUlBQkFCb0FZQg%3D%3D',
};

const DEFAULT_TOP_RESULT = 'Top result';
const DEFAULT_OTHER_RESULTS = 'Other';

const MAX_GET_QUEUE_SIZE = 1000;

module.exports = {
  USER_AGENT_WEB,
  ORIGIN_YOUTUBE_MUSIC,
  REFERER_YOUTUBE_MUSIC,
  API_URL_YOUTUBE_MUSIC,
  CLIENTS,
  SEARCH_FILTERS,
  LIBRARY_FILTERS,
  DEFAULT_TOP_RESULT,
  DEFAULT_OTHER_RESULTS,
  MAX_GET_QUEUE_SIZE,
};
