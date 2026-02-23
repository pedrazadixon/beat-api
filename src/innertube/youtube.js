/**
 * YouTube Music API (High-Level)
 * Translated from YouTube.kt
 * 
 * Provides high-level methods that combine InnerTube requests with response parsing.
 * This is the main interface for the YouTube Music API.
 */

const InnerTube = require('./innertube');
const { CLIENTS, SEARCH_FILTERS, LIBRARY_FILTERS, MAX_GET_QUEUE_SIZE } = require('./constants');
const parsers = require('./parsers');

class YouTube {
  constructor() {
    this.innerTube = new InnerTube();
  }

  get locale() { return this.innerTube.locale; }
  set locale(value) { this.innerTube.locale = value; }

  get visitorData() { return this.innerTube.visitorData; }
  set visitorData(value) { this.innerTube.visitorData = value; }

  get cookie() { return this.innerTube.cookie; }
  set cookie(value) { this.innerTube.cookie = value; }

  // ─── Search ────────────────────────────────────────

  async searchSuggestions(query) {
    const response = await this.innerTube.getSearchSuggestions(CLIENTS.WEB_REMIX, query);
    return parsers.parseSearchSuggestions(response);
  }

  async searchSummary(query) {
    const response = await this.innerTube.search(CLIENTS.WEB_REMIX, query);
    return parsers.parseSearchSummary(response);
  }

  async search(query, filter = null) {
    const filterValue = filter ? (SEARCH_FILTERS[filter.toUpperCase()] || filter) : null;
    const response = await this.innerTube.search(CLIENTS.WEB_REMIX, query, filterValue);
    return parsers.parseSearchResults(response);
  }

  async searchContinuation(continuation) {
    const response = await this.innerTube.search(CLIENTS.WEB_REMIX, null, null, continuation);
    return parsers.parseSearchContinuation(response);
  }

  // ─── Album ─────────────────────────────────────────

  async album(browseId, withSongs = true) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, browseId);
    const result = parsers.parseAlbumPage(response, browseId);
    if (!result) throw new Error('Failed to parse album page');

    if (withSongs && result.album.playlistId && !result.songs.length) {
      const songsResult = await this.albumSongs(result.album.playlistId, result.album);
      result.songs = songsResult;
    }

    return result;
  }

  async albumSongs(playlistId, album = null) {
    let response = await this.innerTube.browse(CLIENTS.WEB_REMIX, `VL${playlistId}`);
    const parsed = parsers.parseAlbumSongs(response);
    const songs = [...parsed.songs];
    let continuation = parsed.continuation;

    const seenContinuations = new Set();
    let requestCount = 0;
    const maxRequests = 50;

    while (continuation && requestCount < maxRequests) {
      if (seenContinuations.has(continuation)) break;
      seenContinuations.add(continuation);
      requestCount++;

      response = await this.innerTube.browse(CLIENTS.WEB_REMIX, null, null, continuation);
      const contItems = response.onResponseReceivedActions?.[0]
        ?.appendContinuationItemsAction?.continuationItems;
      if (contItems) {
        contItems.forEach((item) => {
          const song = parsers.parseMusicResponsiveListItemRenderer(
            item.musicResponsiveListItemRenderer
          );
          if (song) songs.push(song);
        });
      }
      continuation = response.continuationContents?.musicPlaylistShelfContinuation
        ?.continuations?.[0]?.nextContinuationData?.continuation || null;
    }

    return songs;
  }

  // ─── Artist ────────────────────────────────────────

  async artist(browseId) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, browseId);
    return parsers.parseArtistPage(response, browseId);
  }

  async artistAlbums(browseId) {
    const artistPage = await this.artist(browseId);
    if (!artistPage || !artistPage.sections) return { albums: [], continuation: null, visitorData: null };

    // Find the section that contains albums
    const albumsSection = artistPage.sections.find((section) =>
      section.items && section.items.some((item) => item && item.type === 'album')
    );

    if (!albumsSection) return { albums: [], continuation: null, visitorData: null };

    // If there's a browseId (moreEndpoint), fetch the first page of albums
    if (albumsSection.browseId) {
      const firstPage = await this.artistItems(albumsSection.browseId, albumsSection.params);
      const albums = firstPage.items.filter((item) => item && item.type === 'album');

      return {
        title: albumsSection.title,
        albums,
        // continuation + visitorData are both required to load the next page
        continuation: firstPage.continuation || null,
        visitorData: firstPage.continuation ? (firstPage._visitorData || null) : null,
      };
    }

    // Otherwise return items from the artist page section directly (no continuation possible)
    return {
      title: albumsSection.title,
      albums: albumsSection.items.filter((item) => item && item.type === 'album'),
      continuation: null,
      visitorData: null
    };
  }


  async artistItems(browseId, params = null) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, browseId, params);
    // Capture visitorData from this request's response for use in continuations
    const responseVisitorData = response.responseContext?.visitorData || null;

    const contents = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];

    const grid = contents?.gridRenderer;
    const carousel = contents?.musicCarouselShelfRenderer;
    const shelf = contents?.musicShelfRenderer;
    const playlistShelf = contents?.musicPlaylistShelfRenderer;

    if (grid) {
      return {
        title: grid.header?.gridHeaderRenderer?.title?.runs?.[0]?.text || '',
        items: grid.items
          ?.map((i) => parsers.parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
          .filter(Boolean) || [],
        continuation: grid.continuations?.[0]?.nextContinuationData?.continuation || null,
        _visitorData: responseVisitorData, // Internal use: needed for continuation requests
      };
    }

    if (carousel) {
      return {
        title: carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text || '',
        items: carousel.contents
          ?.map((c) => {
            if (c.musicTwoRowItemRenderer) return parsers.parseMusicTwoRowItemRenderer(c.musicTwoRowItemRenderer);
            if (c.musicResponsiveListItemRenderer) return parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer);
            return null;
          })
          .filter(Boolean) || [],
        continuation: null,
        _visitorData: responseVisitorData,
      };
    }

    if (shelf) {
      const items = shelf.contents
        ?.filter((c) => !c.continuationItemRenderer)
        .map((c) => parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
        .filter(Boolean) || [];
      return {
        title: shelf.title?.runs?.[0]?.text
          || response.header?.musicHeaderRenderer?.title?.runs?.[0]?.text || '',
        items,
        continuation: shelf.continuations?.[0]?.nextContinuationData?.continuation || null,
        _visitorData: responseVisitorData,
      };
    }

    // Fallback to musicPlaylistShelfRenderer
    const items = playlistShelf?.contents
      ?.filter((c) => !c.continuationItemRenderer)
      .map((c) => parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
      .filter(Boolean) || [];
    return {
      title: response.header?.musicHeaderRenderer?.title?.runs?.[0]?.text || '',
      items,
      continuation: playlistShelf?.contents
        ?.find((c) => c.continuationItemRenderer)
        ?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token || null,
      _visitorData: responseVisitorData,
    };
  }


  /**
   * Continuation for artist albums specifically.
   * Requires the visitorData returned by artistAlbums() to work correctly.
   */
  async artistAlbumsContinuation(continuation, visitorData = null) {
    const originalVisitorData = this.innerTube.visitorData;
    if (visitorData) this.innerTube.visitorData = visitorData;

    try {
      const response = await this.innerTube.browseWithCtoken(CLIENTS.WEB_REMIX, continuation);
      const gc = response.continuationContents?.gridContinuation;

      if (!gc) {
        return { albums: [], continuation: null, visitorData: null };
      }

      const albums = gc.items
        ?.map((i) => parsers.parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
        .filter((i) => i && i.type === 'album') || [];

      const nextToken = albums.length
        ? gc.continuations?.[0]?.nextContinuationData?.continuation || null
        : null;

      // Capture the response visitorData for the next continuation call
      const nextVisitorData = response.responseContext?.visitorData || visitorData || null;

      return {
        albums,
        continuation: nextToken,
        visitorData: nextToken ? nextVisitorData : null,
      };
    } finally {
      this.innerTube.visitorData = originalVisitorData;
    }
  }

  async artistItemsContinuation(continuation) {
    const response = await this.innerTube.browseWithCtoken(CLIENTS.WEB_REMIX, continuation);

    if (response.continuationContents?.gridContinuation) {
      const gc = response.continuationContents.gridContinuation;
      const items = gc.items
        ?.map((i) => parsers.parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
        .filter(Boolean) || [];
      return {
        items,
        continuation: items.length
          ? gc.continuations?.[0]?.nextContinuationData?.continuation || null
          : null,
      };
    }

    if (response.continuationContents?.musicPlaylistShelfContinuation) {
      const mpc = response.continuationContents.musicPlaylistShelfContinuation;
      const items = mpc.contents
        ?.filter((c) => !c.continuationItemRenderer)
        .map((c) => parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
        .filter(Boolean) || [];
      return {
        items,
        continuation: items.length
          ? mpc.continuations?.[0]?.nextContinuationData?.continuation || null
          : null,
      };
    }

    // sectionListContinuation: returned when the grid uses a sectionList-based continuation token.
    // Structure: sectionListContinuation → contents[] → (itemSectionRenderer | gridRenderer | musicShelfRenderer)
    // itemSectionRenderer adds an extra nesting level: itemSectionRenderer.contents[] → gridRenderer/shelf
    if (response.continuationContents?.sectionListContinuation) {
      const slc = response.continuationContents.sectionListContinuation;
      const allItems = [];
      let nextContinuation = null;

      const parseSectionContent = (section) => {
        const grid = section.gridRenderer;
        const shelf = section.musicShelfRenderer;
        const carousel = section.musicCarouselShelfRenderer;

        if (grid) {
          const parsed = grid.items
            ?.map((i) => parsers.parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
            .filter(Boolean) || [];
          allItems.push(...parsed);
          if (!nextContinuation) {
            nextContinuation = grid.continuations?.[0]?.nextContinuationData?.continuation || null;
          }
        } else if (shelf) {
          const parsed = shelf.contents
            ?.filter((c) => !c.continuationItemRenderer)
            .map((c) => parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
            .filter(Boolean) || [];
          allItems.push(...parsed);
          if (!nextContinuation) {
            nextContinuation = shelf.continuations?.[0]?.nextContinuationData?.continuation || null;
          }
        } else if (carousel) {
          const parsed = carousel.contents
            ?.map((c) => {
              if (c.musicTwoRowItemRenderer) return parsers.parseMusicTwoRowItemRenderer(c.musicTwoRowItemRenderer);
              if (c.musicResponsiveListItemRenderer) return parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer);
              return null;
            })
            .filter(Boolean) || [];
          allItems.push(...parsed);
        }
      };

      for (const section of slc.contents || []) {
        if (section.itemSectionRenderer) {
          // itemSectionRenderer wraps the actual renderer one level deeper
          for (const inner of section.itemSectionRenderer.contents || []) {
            parseSectionContent(inner);
          }
        } else {
          parseSectionContent(section);
        }
      }

      // Also check sectionListContinuation-level continuations
      if (!nextContinuation) {
        nextContinuation = slc.continuations?.[0]?.nextContinuationData?.continuation || null;
      }

      return {
        items: allItems,
        continuation: allItems.length ? nextContinuation : null,
      };
    }


    // onResponseReceivedActions fallback
    const contItems = response.onResponseReceivedActions?.[0]
      ?.appendContinuationItemsAction?.continuationItems;
    const items = contItems
      ?.filter((c) => !c.continuationItemRenderer)
      .map((c) => parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
      .filter(Boolean) || [];
    return {
      items,
      continuation: items.length
        ? contItems?.find((c) => c.continuationItemRenderer)
            ?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token || null
        : null,
    };
  }

  // ─── Playlist ──────────────────────────────────────

  async playlist(playlistId) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, `VL${playlistId}`, null, null, true);
    const result = parsers.parsePlaylistPage(response, playlistId);
    if (!result) throw new Error('Failed to parse playlist page');
    return result;
  }

  async playlistContinuation(continuation) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, null, null, continuation, true);
    return parsers.parsePlaylistContinuation(response);
  }

  // ─── Home ──────────────────────────────────────────

  async home(continuation = null, params = null) {
    if (continuation) {
      const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, null, null, continuation);
      return parsers.parseHomeContinuation(response);
    }
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, 'FEmusic_home', params);
    return parsers.parseHomePage(response);
  }

  // ─── Explore ───────────────────────────────────────

  async explore() {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, 'FEmusic_explore');
    return parsers.parseExplorePage(response);
  }

  async newReleaseAlbums() {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, 'FEmusic_new_releases_albums');
    const contents = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.gridRenderer?.items;
    return contents
      ?.map((i) => parsers.parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
      .filter(Boolean) || [];
  }

  async moodAndGenres() {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, 'FEmusic_moods_and_genres');
    // Parse from section list
    const sections = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    return sections.map((section) => {
      const carousel = section.musicCarouselShelfRenderer;
      if (!carousel) return null;
      return {
        title: carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text,
        items: carousel.contents
          ?.map((c) => {
            const btn = c.musicNavigationButtonRenderer;
            if (!btn) return null;
            return {
              title: btn.buttonText?.runs?.[0]?.text,
              browseId: btn.clickCommand?.browseEndpoint?.browseId,
              params: btn.clickCommand?.browseEndpoint?.params,
              color: btn.solid?.leftStripeColor,
            };
          })
          .filter(Boolean) || [],
      };
    }).filter(Boolean);
  }

  // ─── Charts ────────────────────────────────────────

  async charts(continuation = null) {
    const response = await this.innerTube.browse(
      CLIENTS.WEB_REMIX,
      'FEmusic_charts',
      'ggMGCgQIgAQ%3D',
      continuation
    );
    return parsers.parseChartsPage(response);
  }

  // ─── Browse ────────────────────────────────────────

  async browse(browseId, params = null) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, browseId, params);
    return parsers.parseBrowseResult(response);
  }

  // ─── Library ───────────────────────────────────────

  async library(browseId, tabIndex = 0) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, browseId, null, null, true);
    return parsers.parseLibraryPage(response);
  }

  async libraryContinuation(continuation) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, null, null, continuation, true);
    const contents = response.continuationContents;

    if (contents?.gridContinuation) {
      return {
        items: contents.gridContinuation.items
          ?.map((i) => parsers.parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
          .filter(Boolean) || [],
        continuation: contents.gridContinuation.continuations?.[0]?.nextContinuationData?.continuation || null,
      };
    }

    return {
      items: contents?.musicShelfContinuation?.contents
        ?.map((c) => parsers.parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
        .filter(Boolean) || [],
      continuation: contents?.musicShelfContinuation?.continuations?.[0]?.nextContinuationData?.continuation || null,
    };
  }

  // ─── History ───────────────────────────────────────

  async musicHistory() {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, 'FEmusic_history', null, null, true);
    return parsers.parseHistoryPage(response);
  }

  // ─── Player ────────────────────────────────────────

  async player(videoId, playlistId = null, clientName = 'WEB_REMIX', signatureTimestamp = null, poToken = null) {
    const client = CLIENTS[clientName] || CLIENTS.WEB_REMIX;
    const response = await this.innerTube.player(client, videoId, playlistId, signatureTimestamp, poToken);
    return parsers.parsePlayerResponse(response);
  }

  // ─── Next / Queue ─────────────────────────────────

  async next(videoId, playlistId = null, playlistSetVideoId = null, index = null, params = null, continuation = null) {
    const response = await this.innerTube.next(
      CLIENTS.WEB_REMIX,
      videoId, playlistId, playlistSetVideoId, index, params, continuation
    );
    return parsers.parseNextResult(response);
  }

  async queue(videoIds = null, playlistId = null) {
    if (videoIds && videoIds.length > MAX_GET_QUEUE_SIZE) {
      throw new Error(`Max queue size is ${MAX_GET_QUEUE_SIZE}`);
    }
    const response = await this.innerTube.getQueue(CLIENTS.WEB_REMIX, videoIds, playlistId);
    return parsers.parseQueue(response);
  }

  // ─── Lyrics & Related ─────────────────────────────

  async lyrics(browseId, params = null) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, browseId, params);
    return parsers.parseLyrics(response);
  }

  async related(browseId) {
    const response = await this.innerTube.browse(CLIENTS.WEB_REMIX, browseId);
    return parsers.parseRelatedPage(response);
  }

  // ─── Transcript ────────────────────────────────────

  async transcript(videoId) {
    const response = await this.innerTube.getTranscript(CLIENTS.WEB, videoId);
    return parsers.parseTranscript(response);
  }

  // ─── Account ───────────────────────────────────────

  async accountInfo() {
    const response = await this.innerTube.accountMenu(CLIENTS.WEB_REMIX);
    return parsers.parseAccountInfo(response);
  }

  async visitorDataFromApi() {
    const response = await this.innerTube.getSwJsData();
    return parsers.parseVisitorData(typeof response === 'string' ? response : JSON.stringify(response));
  }

  // ─── Likes / Subscribe ─────────────────────────────

  async likeVideo(videoId, like = true) {
    if (like) {
      return this.innerTube.likeVideo(CLIENTS.WEB_REMIX, videoId);
    }
    return this.innerTube.unlikeVideo(CLIENTS.WEB_REMIX, videoId);
  }

  async likePlaylist(playlistId, like = true) {
    if (like) {
      return this.innerTube.likePlaylist(CLIENTS.WEB_REMIX, playlistId);
    }
    return this.innerTube.unlikePlaylist(CLIENTS.WEB_REMIX, playlistId);
  }

  async subscribeChannel(channelId, subscribe = true) {
    if (subscribe) {
      return this.innerTube.subscribeChannel(CLIENTS.WEB_REMIX, channelId);
    }
    return this.innerTube.unsubscribeChannel(CLIENTS.WEB_REMIX, channelId);
  }

  // ─── Playlist Management ──────────────────────────

  async createPlaylist(title) {
    const response = await this.innerTube.createPlaylist(CLIENTS.WEB_REMIX, title);
    return response.playlistId;
  }

  async deletePlaylist(playlistId) {
    return this.innerTube.deletePlaylist(CLIENTS.WEB_REMIX, playlistId);
  }

  async renamePlaylist(playlistId, name) {
    return this.innerTube.editPlaylist(CLIENTS.WEB_REMIX, playlistId, [
      { action: 'ACTION_SET_PLAYLIST_NAME', playlistName: name },
    ]);
  }

  async addToPlaylist(playlistId, videoId) {
    return this.innerTube.editPlaylist(CLIENTS.WEB_REMIX, playlistId, [
      { action: 'ACTION_ADD_VIDEO', addedVideoId: videoId },
    ]);
  }

  async removeFromPlaylist(playlistId, videoId, setVideoId) {
    return this.innerTube.editPlaylist(CLIENTS.WEB_REMIX, playlistId, [
      { action: 'ACTION_REMOVE_VIDEO', removedVideoId: videoId, setVideoId },
    ]);
  }

  // ─── Feedback / Library Toggle ─────────────────────

  async feedback(tokens) {
    const response = await this.innerTube.feedback(CLIENTS.WEB_REMIX, tokens);
    return response.feedbackResponses?.every((r) => r.isProcessed) || false;
  }

  async addSongToLibrary(videoId) {
    const nextResult = await this.next(videoId);
    const song = nextResult?.items?.find((s) => s.id === videoId);
    if (!song?.libraryAddToken) throw new Error('Add to library token not available');
    return this.feedback([song.libraryAddToken]);
  }

  async removeSongFromLibrary(videoId) {
    const nextResult = await this.next(videoId);
    const song = nextResult?.items?.find((s) => s.id === videoId);
    if (!song?.libraryRemoveToken) throw new Error('Remove from library token not available');
    return this.feedback([song.libraryRemoveToken]);
  }
}

module.exports = YouTube;
