/**
 * InnerTube HTTP Client
 * Translated from InnerTube.kt
 * 
 * Provides low-level access to YouTube InnerTube API endpoints.
 * Handles request construction, headers, authentication, and retries.
 */

const axios = require('axios');
const crypto = require('crypto');
const {
  API_URL_YOUTUBE_MUSIC,
  ORIGIN_YOUTUBE_MUSIC,
  REFERER_YOUTUBE_MUSIC,
  CLIENTS,
} = require('./constants');

class InnerTube {
  constructor() {
    this.locale = {
      gl: process.env.YT_LOCALE_GL || 'US',
      hl: process.env.YT_LOCALE_HL || 'en',
    };
    this.visitorData = process.env.YT_VISITOR_DATA || null;
    this.dataSyncId = process.env.YT_DATA_SYNC_ID || null;
    this.cookie = process.env.YT_COOKIE || null;
    this.cookieMap = {};
    this.proxy = null;
    this.proxyAuth = null;
    this.useLoginForBrowse = false;

    if (this.cookie) {
      this.cookieMap = this._parseCookieString(this.cookie);
    }
  }

  _parseCookieString(cookieStr) {
    const map = {};
    if (!cookieStr) return map;
    cookieStr.split(';').forEach((pair) => {
      const [key, ...rest] = pair.trim().split('=');
      if (key) map[key.trim()] = rest.join('=').trim();
    });
    return map;
  }

  _sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  /**
   * Build the InnerTube context object from a client config.
   */
  _buildContext(client, visitorData, dataSyncId) {
    return {
      client: {
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        gl: this.locale.gl,
        hl: this.locale.hl,
        visitorData: visitorData || undefined,
      },
      user: {
        lockedSafetyMode: false,
        onBehalfOfUser: client.loginSupported ? dataSyncId || undefined : undefined,
      },
      request: {
        internalExperimentFlags: [],
        useSsl: true,
      },
    };
  }

  /**
   * Build common headers for InnerTube requests.
   */
  _buildHeaders(client, setLogin = false) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Goog-Api-Format-Version': '1',
      'X-YouTube-Client-Name': client.clientId,
      'X-YouTube-Client-Version': client.clientVersion,
      'X-Origin': ORIGIN_YOUTUBE_MUSIC,
      'Referer': REFERER_YOUTUBE_MUSIC,
      'User-Agent': client.userAgent,
    };

    if (this.visitorData) {
      headers['X-Goog-Visitor-Id'] = this.visitorData;
    }

    if (setLogin && client.loginSupported && this.cookie) {
      headers['Cookie'] = this.cookie;
      if (this.cookieMap['SAPISID']) {
        const currentTime = Math.floor(Date.now() / 1000);
        const sapisidHash = this._sha1(`${currentTime} ${this.cookieMap['SAPISID']} ${ORIGIN_YOUTUBE_MUSIC}`);
        headers['Authorization'] = `SAPISIDHASH ${currentTime}_${sapisidHash}`;
      }
    }

    return headers;
  }

  /**
   * Retry wrapper for transient errors with exponential backoff.
   */
  async _withRetry(fn, maxAttempts = 3, initialDelay = 500) {
    let delay = initialDelay;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= maxAttempts - 1) throw err;
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }

  /**
   * Make a POST request to the InnerTube API.
   */
  async _post(endpoint, client, body, params = {}, setLogin = false) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL_YOUTUBE_MUSIC}${endpoint}`;
    const headers = this._buildHeaders(client, setLogin);

    return this._withRetry(async () => {
      const response = await axios.post(url, body, {
        headers,
        params: { prettyPrint: false, ...params },
        timeout: 60000,
      });
      return response.data;
    });
  }

  /**
   * Make a GET request.
   */
  async _get(url, client, params = {}, setLogin = false) {
    const headers = this._buildHeaders(client, setLogin);

    return this._withRetry(async () => {
      const response = await axios.get(url, {
        headers,
        params,
        timeout: 60000,
      });
      return response.data;
    });
  }

  // ─── InnerTube Endpoints ────────────────────────────

  async search(client, query = null, params = null, continuation = null) {
    const context = this._buildContext(
      client,
      this.visitorData,
      this.useLoginForBrowse ? this.dataSyncId : null
    );
    const body = { context, query, params };
    const urlParams = {};
    if (continuation) {
      urlParams.continuation = continuation;
      urlParams.ctoken = continuation;
    }
    return this._post('search', client, body, urlParams, this.useLoginForBrowse);
  }

  async browse(client, browseId = null, params = null, continuation = null, setLogin = false) {
    const context = this._buildContext(
      client,
      this.visitorData,
      (setLogin || this.useLoginForBrowse) ? this.dataSyncId : null
    );
    const body = { context, browseId, params, continuation };
    return this._post('browse', client, body, {}, setLogin || this.useLoginForBrowse);
  }

  /**
   * Browse continuation using URL query params (ctoken + continuation).
   * Used for grid/section continuations where the token must be a query param, not in the body.
   */
  async browseWithCtoken(client, continuation, setLogin = false) {
    const context = this._buildContext(
      client,
      this.visitorData,
      (setLogin || this.useLoginForBrowse) ? this.dataSyncId : null
    );
    const body = { context };
    return this._post('browse', client, body, { ctoken: continuation, continuation, type: 'next' }, setLogin || this.useLoginForBrowse);
  }


  async player(client, videoId, playlistId = null, signatureTimestamp = null, poToken = null) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    if (client.isEmbedded) {
      context.thirdParty = { embedUrl: `https://www.youtube.com/watch?v=${videoId}` };
    }

    const body = {
      context,
      videoId,
      playlistId,
      contentCheckOk: true,
      racyCheckOk: true,
    };

    if (client.useSignatureTimestamp && signatureTimestamp) {
      body.playbackContext = {
        contentPlaybackContext: { signatureTimestamp },
      };
    }
    if (client.useWebPoTokens && poToken) {
      body.serviceIntegrityDimensions = { poToken };
    }

    return this._post('player', client, body, {}, true);
  }

  async next(client, videoId, playlistId, playlistSetVideoId, index, params, continuation = null) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = {
      context,
      videoId,
      playlistId,
      playlistSetVideoId,
      index,
      params,
      continuation,
    };
    return this._post('next', client, body, {}, true);
  }

  async getSearchSuggestions(client, input) {
    const context = this._buildContext(client, this.visitorData, null);
    const body = { context, input };
    return this._post('music/get_search_suggestions', client, body);
  }

  async getQueue(client, videoIds = null, playlistId = null) {
    const context = this._buildContext(client, this.visitorData, null);
    const body = { context, videoIds, playlistId };
    return this._post('music/get_queue', client, body);
  }

  async getTranscript(client, videoId) {
    const context = this._buildContext(client, null, null);
    const params = Buffer.from(`\n${String.fromCharCode(11)}${videoId}`).toString('base64');
    const body = { context, params };
    return this._post(
      'https://music.youtube.com/youtubei/v1/get_transcript',
      client,
      body,
      { key: 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX3' }
    );
  }

  async feedback(client, tokens) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, feedbackTokens: tokens };
    return this._post('feedback', client, body, {}, true);
  }

  async accountMenu(client) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context };
    return this._post('account/account_menu', client, body, {}, true);
  }

  async likeVideo(client, videoId) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, target: { videoId } };
    return this._post('like/like', client, body, {}, true);
  }

  async unlikeVideo(client, videoId) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, target: { videoId } };
    return this._post('like/removelike', client, body, {}, true);
  }

  async likePlaylist(client, playlistId) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, target: { playlistId } };
    return this._post('like/like', client, body, {}, true);
  }

  async unlikePlaylist(client, playlistId) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, target: { playlistId } };
    return this._post('like/removelike', client, body, {}, true);
  }

  async createPlaylist(client, title) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, title };
    return this._post('playlist/create', client, body, {}, true);
  }

  async deletePlaylist(client, playlistId) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, playlistId };
    return this._post('playlist/delete', client, body, {}, true);
  }

  async editPlaylist(client, playlistId, actions) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, playlistId: playlistId.replace(/^VL/, ''), actions };
    return this._post('browse/edit_playlist', client, body, {}, true);
  }

  async subscribeChannel(client, channelId) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, channelIds: [channelId] };
    return this._post('subscription/subscribe', client, body, {}, true);
  }

  async unsubscribeChannel(client, channelId) {
    const context = this._buildContext(client, this.visitorData, this.dataSyncId);
    const body = { context, channelIds: [channelId] };
    return this._post('subscription/unsubscribe', client, body, {}, true);
  }

  async getSwJsData() {
    const response = await this._withRetry(async () => {
      return axios.get('https://music.youtube.com/sw.js_data', { timeout: 30000 });
    });
    return response;
  }
}

module.exports = InnerTube;
