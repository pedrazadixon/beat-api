/**
 * Response Parsers
 * Translated from the various page classes in YouTube.kt
 * 
 * Extracts and normalizes useful data from raw InnerTube API responses.
 */

// ─── Utility Helpers ────────────────────────────────

/**
 * Get odd elements from an array (0-indexed: elements at index 0, 2, 4, etc.)
 */
function oddElements(arr) {
  if (!arr) return [];
  return arr.filter((_, i) => i % 2 === 0);
}

/**
 * Safely get a thumbnail URL from a renderer.
 */
function getThumbnailUrl(thumbnailRenderer) {
  const thumbnails = thumbnailRenderer?.thumbnail?.thumbnails;
  if (!thumbnails || !thumbnails.length) return null;
  return thumbnails[thumbnails.length - 1]?.url || null;
}

/**
 * Extract continuation token from a continuations array.
 */
function getContinuation(continuations) {
  if (!continuations || !continuations.length) return null;
  return continuations[0]?.nextContinuationData?.continuation || null;
}

/**
 * Extract items from a contents array (filter out continuation items).
 */
function getItems(contents) {
  if (!contents) return [];
  return contents.filter(
    (c) => !c.continuationItemRenderer
  );
}

/**
 * Extract continuation from items array (look for continuationItemRenderer).
 */
function getItemsContinuation(contents) {
  if (!contents) return null;
  const contItem = contents.find((c) => c.continuationItemRenderer);
  return contItem?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token || null;
}

// ─── Search Suggestions Parser ───────────────────────

function parseSearchSuggestions(response) {
  const contents = response?.contents;
  return {
    queries: contents?.[0]?.searchSuggestionsSectionRenderer?.contents
      ?.map((c) => {
        const runs = c.searchSuggestionRenderer?.suggestion?.runs;
        if (!runs) return null;
        return runs.map((r) => r.text).join('');
      })
      .filter(Boolean) || [],
    recommendedItems: contents?.[1]?.searchSuggestionsSectionRenderer?.contents
      ?.map((c) => {
        return parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer);
      })
      .filter(Boolean) || [],
  };
}

// ─── Search Summary Parser ──────────────────────────

function parseSearchSummary(response) {
  const tabs = response?.contents?.tabbedSearchResultsRenderer?.tabs;
  const sectionContents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

  const summaries = sectionContents?.map((section) => {
    if (section.musicCardShelfRenderer) {
      const mcsr = section.musicCardShelfRenderer;
      const title = mcsr.header?.musicCardShelfHeaderBasicRenderer?.title?.runs?.[0]?.text || 'Top result';
      const topItem = parseMusicCardShelfRenderer(mcsr);
      const additionalItems = mcsr.contents
        ?.map((c) => parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
        .filter(Boolean) || [];
      const items = [topItem, ...additionalItems].filter(Boolean);
      const uniqueItems = deduplicateById(items);
      return uniqueItems.length ? { title, items: uniqueItems } : null;
    }

    if (section.musicShelfRenderer) {
      const msr = section.musicShelfRenderer;
      const title = msr.title?.runs?.[0]?.text || 'Other';
      const items = getItems(msr.contents)
        ?.map((c) => parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
        .filter(Boolean) || [];
      const uniqueItems = deduplicateById(items);
      return uniqueItems.length ? { title, items: uniqueItems } : null;
    }

    return null;
  }).filter(Boolean) || [];

  return { summaries };
}

// ─── Search Results Parser ──────────────────────────

function parseSearchResults(response) {
  const tabs = response?.contents?.tabbedSearchResultsRenderer?.tabs;
  const sectionContents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
  const lastSection = sectionContents?.[sectionContents.length - 1];
  const musicShelf = lastSection?.musicShelfRenderer;

  return {
    items: getItems(musicShelf?.contents)
      ?.map((c) => parseSearchItem(c.musicResponsiveListItemRenderer || c))
      .filter(Boolean) || [],
    continuation: getContinuation(musicShelf?.continuations) || getItemsContinuation(musicShelf?.contents),
  };
}

function parseSearchContinuation(response) {
  const contents = response?.continuationContents?.musicShelfContinuation?.contents;
  const items = contents
    ?.map((c) => parseSearchItem(c.musicResponsiveListItemRenderer))
    .filter(Boolean) || [];

  return {
    items,
    continuation: items.length
      ? getContinuation(response?.continuationContents?.musicShelfContinuation?.continuations)
      : null,
  };
}

// ─── Album Parser ───────────────────────────────────

function parseAlbumPage(response, browseId) {
  // Check if it's a library-owned release  
  if (browseId?.includes('FEmusic_library_privately_owned_release_detail')) {
    const header = response.header?.musicDetailHeaderRenderer;
    if (!header) return null;

    const playlistId = header.menu?.menuRenderer?.topLevelButtons?.[0]
      ?.buttonRenderer?.navigationEndpoint?.watchPlaylistEndpoint?.playlistId;

    const album = {
      browseId,
      playlistId,
      title: header.title?.runs?.[0]?.text,
      artists: header.subtitle?.runs
        ?.filter((r) => r.navigationEndpoint)
        .map((r) => ({
          name: r.text,
          id: r.navigationEndpoint?.browseEndpoint?.browseId,
        })) || [],
      year: parseInt(header.subtitle?.runs?.[header.subtitle.runs.length - 1]?.text) || null,
      thumbnail: header.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
      explicit: false,
    };

    const songs = getItems(
      response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
        ?.musicShelfRenderer?.contents
    )?.map((c) => parseAlbumSong(c.musicResponsiveListItemRenderer, album)).filter(Boolean) || [];

    return { album, songs, otherVersions: [] };
  }

  // Standard album
  const playlistId = response.microformat?.microformatDataRenderer?.urlCanonical?.split('=').pop();
  const headerContent = response.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;

  if (!headerContent) return null;

  const album = {
    browseId,
    playlistId,
    title: headerContent.title?.runs?.[0]?.text,
    artists: oddElements(headerContent.straplineTextOne?.runs)
      ?.map((r) => ({
        name: r.text,
        id: r.navigationEndpoint?.browseEndpoint?.browseId,
      })) || [],
    year: parseInt(headerContent.subtitle?.runs?.slice(-1)?.[0]?.text) || null,
    thumbnail: headerContent.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
    explicit: false,
  };

  const otherVersions = response.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
    ?.sectionListRenderer?.contents?.[1]?.musicCarouselShelfRenderer?.contents
    ?.map((c) => parseMusicTwoRowItemRenderer(c.musicTwoRowItemRenderer))
    .filter(Boolean) || [];

  return { album, songs: [], otherVersions };
}

// ─── Album Songs Parser ─────────────────────────────

function parseAlbumSongs(response) {
  const contents = response.contents?.twoColumnBrowseResultsRenderer
    ?.secondaryContents?.sectionListRenderer
    ?.contents?.[0]?.musicPlaylistShelfRenderer?.contents;

  const songs = getItems(contents)
    ?.map((c) => parseAlbumSong(c.musicResponsiveListItemRenderer))
    .filter(Boolean) || [];

  const continuation = getContinuation(
    response.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer
      ?.contents?.[0]?.musicPlaylistShelfRenderer?.continuations
  ) || getItemsContinuation(contents);

  return { songs, continuation };
}

// ─── Artist Parser ──────────────────────────────────

function parseArtistPage(response, browseId) {
  const header = response.header;
  const immersive = header?.musicImmersiveHeaderRenderer;
  const visual = header?.musicVisualHeaderRenderer;
  const detail = header?.musicDetailHeaderRenderer;
  const musicHeader = header?.musicHeaderRenderer;

  const title = immersive?.title?.runs?.[0]?.text
    || visual?.title?.runs?.[0]?.text
    || musicHeader?.title?.runs?.[0]?.text;

  const thumbnail = getThumbnailUrl(immersive?.thumbnail?.musicThumbnailRenderer)
    || getThumbnailUrl(visual?.foregroundThumbnail?.musicThumbnailRenderer)
    || getThumbnailUrl(detail?.thumbnail?.musicThumbnailRenderer);

  const sectionContents = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents;

  const descriptionRuns = sectionContents
    ?.find((c) => c.musicDescriptionShelfRenderer)
    ?.musicDescriptionShelfRenderer?.description?.runs
    || immersive?.description?.runs;

  const sections = sectionContents
    ?.map((c) => parseArtistSection(c))
    .filter(Boolean) || [];

  return {
    artist: {
      id: browseId,
      title,
      thumbnail,
      channelId: immersive?.subscriptionButton?.subscribeButtonRenderer?.channelId,
    },
    sections,
    description: descriptionRuns?.map((r) => r.text).join('') || null,
    subscriberCountText: immersive?.subscriptionButton2?.subscribeButtonRenderer?.subscriberCountWithSubscribeText?.runs?.[0]?.text
      || immersive?.subscriptionButton?.subscribeButtonRenderer?.longSubscriberCountText?.runs?.[0]?.text
      || immersive?.subscriptionButton?.subscribeButtonRenderer?.shortSubscriberCountText?.runs?.[0]?.text,
    monthlyListenerCount: immersive?.monthlyListenerCount?.runs?.[0]?.text,
  };
}

function parseArtistSection(content) {
  const carousel = content.musicCarouselShelfRenderer;
  if (!carousel) return null;

  const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
  const browseId = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton
    ?.buttonRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
  const params = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton
    ?.buttonRenderer?.navigationEndpoint?.browseEndpoint?.params;

  const items = carousel.contents
    ?.map((c) => {
      if (c.musicTwoRowItemRenderer) return parseMusicTwoRowItemRenderer(c.musicTwoRowItemRenderer);
      if (c.musicResponsiveListItemRenderer) return parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer);
      return null;
    })
    .filter(Boolean) || [];

  return { title, browseId, params, items };
}

// ─── Home Parser ────────────────────────────────────

function parseHomePage(response) {
  const sectionListRenderer = response.contents?.singleColumnBrowseResultsRenderer
    ?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;

  const sections = sectionListRenderer?.contents
    ?.map((c) => c.musicCarouselShelfRenderer)
    .filter(Boolean)
    .map(parseHomeSection)
    .filter(Boolean) || [];

  const chips = sectionListRenderer?.header?.chipCloudRenderer?.chips
    ?.map((chip) => {
      const cr = chip.chipCloudChipRenderer;
      return {
        title: cr?.text?.runs?.[0]?.text,
        params: cr?.navigationEndpoint?.browseEndpoint?.params,
        isSelected: cr?.isSelected || false,
      };
    })
    .filter((c) => c.title) || [];

  const continuation = getContinuation(sectionListRenderer?.continuations);

  return { chips, sections, continuation };
}

function parseHomeContinuation(response) {
  const sectionListContinuation = response.continuationContents?.sectionListContinuation;
  const continuation = getContinuation(sectionListContinuation?.continuations);

  const sections = sectionListContinuation?.contents
    ?.map((c) => c.musicCarouselShelfRenderer)
    .filter(Boolean)
    .map(parseHomeSection)
    .filter(Boolean) || [];

  return { chips: null, sections, continuation };
}

function parseHomeSection(renderer) {
  if (!renderer) return null;
  const title = renderer.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
  const browseEndpoint = renderer.header?.musicCarouselShelfBasicHeaderRenderer?.moreContentButton
    ?.buttonRenderer?.navigationEndpoint?.browseEndpoint;

  const items = renderer.contents
    ?.map((c) => {
      if (c.musicTwoRowItemRenderer) return parseMusicTwoRowItemRenderer(c.musicTwoRowItemRenderer);
      if (c.musicResponsiveListItemRenderer) return parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer);
      return null;
    })
    .filter(Boolean) || [];

  return {
    title,
    browseId: browseEndpoint?.browseId,
    params: browseEndpoint?.params,
    items,
  };
}

// ─── Explore Parser ─────────────────────────────────

function parseExplorePage(response) {
  const contents = response.contents?.singleColumnBrowseResultsRenderer
    ?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

  const newReleaseSection = contents?.find(
    (c) => c.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer
      ?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint
      ?.browseId === 'FEmusic_new_releases_albums'
  );
  const moodSection = contents?.find(
    (c) => c.musicCarouselShelfRenderer?.header?.musicCarouselShelfBasicHeaderRenderer
      ?.moreContentButton?.buttonRenderer?.navigationEndpoint?.browseEndpoint
      ?.browseId === 'FEmusic_moods_and_genres'
  );

  return {
    newReleaseAlbums: newReleaseSection?.musicCarouselShelfRenderer?.contents
      ?.map((c) => parseMusicTwoRowItemRenderer(c.musicTwoRowItemRenderer))
      .filter(Boolean) || [],
    moodAndGenres: moodSection?.musicCarouselShelfRenderer?.contents
      ?.map((c) => parseMoodAndGenre(c.musicNavigationButtonRenderer))
      .filter(Boolean) || [],
  };
}

// ─── Charts Parser ──────────────────────────────────

function parseChartsPage(response) {
  const sections = [];

  response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents?.forEach((content) => {
      if (content.musicCarouselShelfRenderer) {
        const renderer = content.musicCarouselShelfRenderer;
        const title = renderer.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
        if (!title) return;

        const items = renderer.contents?.map((item) => {
          if (item.musicResponsiveListItemRenderer) return parseChartItem(item.musicResponsiveListItemRenderer);
          if (item.musicTwoRowItemRenderer) return parseMusicTwoRowItemRenderer(item.musicTwoRowItemRenderer);
          return null;
        }).filter(Boolean) || [];

        if (items.length) {
          sections.push({
            title,
            items,
            chartType: determineChartType(title),
          });
        }
      }

      if (content.gridRenderer) {
        const renderer = content.gridRenderer;
        const title = renderer.header?.gridHeaderRenderer?.title?.runs?.[0]?.text;
        if (!title) return;

        const items = renderer.items?.map((item) => {
          return parseMusicTwoRowItemRenderer(item.musicTwoRowItemRenderer);
        }).filter(Boolean) || [];

        if (items.length) {
          sections.push({
            title,
            items,
            chartType: 'NEW_RELEASES',
          });
        }
      }
    });

  return {
    sections,
    continuation: getContinuation(
      response.continuationContents?.sectionListContinuation?.continuations
    ),
  };
}

function determineChartType(title) {
  if (!title) return 'GENRE';
  if (/trending/i.test(title)) return 'TRENDING';
  if (/top/i.test(title)) return 'TOP';
  return 'GENRE';
}

// ─── Playlist Parser ────────────────────────────────

function parsePlaylistPage(response, playlistId) {
  const twoCol = response.contents?.twoColumnBrowseResultsRenderer;
  const base = twoCol?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];
  const header = base?.musicResponsiveHeaderRenderer
    || base?.musicEditablePlaylistDetailHeaderRenderer?.header?.musicResponsiveHeaderRenderer;
  const editable = !!base?.musicEditablePlaylistDetailHeaderRenderer;

  // Parse songs from secondaryContents (this works for all playlist types)
  const playlistShelf = twoCol?.secondaryContents
    ?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer;

  const songs = getItems(playlistShelf?.contents)
    ?.map((c) => parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
    .filter(Boolean) || [];

  const songsContinuation = getContinuation(playlistShelf?.continuations)
    || getItemsContinuation(playlistShelf?.contents);

  const sectionContinuation = getContinuation(
    twoCol?.secondaryContents?.sectionListRenderer?.continuations
  );

  // If header is available (user playlists, logged-in album playlists), use it
  if (header) {
    const playlist = {
      id: playlistId,
      title: header.title?.runs?.[0]?.text,
      author: header.straplineTextOne?.runs?.[0]
        ? {
            name: header.straplineTextOne.runs[0].text,
            id: header.straplineTextOne.runs[0].navigationEndpoint?.browseEndpoint?.browseId,
          }
        : null,
      songCountText: header.secondSubtitle?.runs?.[0]?.text,
      thumbnail: header.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
      isEditable: editable,
    };
    return { playlist, songs, songsContinuation, continuation: sectionContinuation };
  }

  // Fallback for album-type playlists (OLAK5uy_) without login:
  // The header is missing, but songs are available in secondaryContents.
  // Extract metadata from the first song's data.
  if (songs.length || playlistShelf) {
    const firstSong = playlistShelf?.contents?.[0]?.musicResponsiveListItemRenderer;
    const firstThumbnail = firstSong?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;
    
    // Search all flex columns for the album name (MPREb browseId) and artist (UC browseId)
    const allRuns = firstSong?.flexColumns
      ?.flatMap(col => col.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []) || [];
    
    // Try to get a title from the first song's album info or response metadata
    const microformat = response.microformat?.microformatDataRenderer;
    const albumRun = allRuns.find(r => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb'));
    const artistRun = allRuns.find(r => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'));
    const title = microformat?.title || albumRun?.text || playlistId;
    
    const playlist = {
      id: playlistId,
      title,
      author: artistRun
        ? {
            name: artistRun.text,
            id: artistRun.navigationEndpoint.browseEndpoint.browseId,
          }
        : null,
      songCountText: `${songs.length} songs`,
      thumbnail: firstThumbnail || null,
      isEditable: false,
    };
    return { playlist, songs, songsContinuation, continuation: sectionContinuation };
  }

  return null;
}

function parsePlaylistContinuation(response) {
  const mainContents = response.continuationContents?.sectionListContinuation?.contents
    ?.flatMap((c) => c.musicPlaylistShelfRenderer?.contents || []) || [];

  const shelfContents = response.continuationContents?.musicPlaylistShelfContinuation?.contents || [];

  const appendedContents = response.onResponseReceivedActions?.[0]
    ?.appendContinuationItemsAction?.continuationItems || [];

  const allContents = [...mainContents, ...shelfContents, ...appendedContents];

  const songs = allContents
    .map((c) => parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
    .filter(Boolean);

  let nextContinuation = null;
  if (songs.length) {
    nextContinuation =
      getContinuation(response.continuationContents?.sectionListContinuation?.continuations)
      || getContinuation(response.continuationContents?.musicPlaylistShelfContinuation?.continuations)
      || getContinuation(response.continuationContents?.musicShelfContinuation?.continuations)
      || getItemsContinuation(response.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems);
  }

  return { songs, continuation: nextContinuation };
}

// ─── Next/Queue Parser ──────────────────────────────

function parseNextResult(response) {
  const playlistPanelRenderer = response.continuationContents?.playlistPanelContinuation
    || response.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
      ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer
      ?.content?.playlistPanelRenderer;

  if (!playlistPanelRenderer) return null;

  const title = response.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
    ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer
    ?.header?.musicQueueHeaderRenderer?.subtitle?.runs?.[0]?.text;

  const items = playlistPanelRenderer.contents
    ?.map((c) => {
      const renderer = c.playlistPanelVideoRenderer;
      if (!renderer) return null;
      return {
        item: parsePlaylistPanelVideoRenderer(renderer),
        selected: renderer.selected || false,
      };
    })
    .filter((x) => x && x.item) || [];

  const songs = items.map((i) => i.item);
  const currentIndex = items.findIndex((i) => i.selected);

  const tabs = response.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
    ?.watchNextTabbedResultsRenderer?.tabs;

  return {
    title,
    items: songs,
    currentIndex: currentIndex >= 0 ? currentIndex : null,
    lyricsEndpoint: tabs?.[1]?.tabRenderer?.endpoint?.browseEndpoint || null,
    relatedEndpoint: tabs?.[2]?.tabRenderer?.endpoint?.browseEndpoint || null,
    continuation: getContinuation(playlistPanelRenderer.continuations),
  };
}

// ─── Lyrics Parser ──────────────────────────────────

function parseLyrics(response) {
  const desc = response.contents?.sectionListRenderer?.contents
    ?.find((c) => c.musicDescriptionShelfRenderer)
    ?.musicDescriptionShelfRenderer?.description?.runs;
  return desc?.map((r) => r.text).join('') || null;
}

// ─── Related Parser ─────────────────────────────────

function parseRelatedPage(response) {
  const songs = [];
  const albums = [];
  const artists = [];
  const playlists = [];

  response.contents?.sectionListRenderer?.contents?.forEach((section) => {
    section.musicCarouselShelfRenderer?.contents?.forEach((content) => {
      let item = null;
      if (content.musicResponsiveListItemRenderer) {
        item = parseMusicResponsiveListItemRenderer(content.musicResponsiveListItemRenderer);
      } else if (content.musicTwoRowItemRenderer) {
        item = parseMusicTwoRowItemRenderer(content.musicTwoRowItemRenderer);
      }
      if (!item) return;

      switch (item.type) {
        case 'song': songs.push(item); break;
        case 'album': albums.push(item); break;
        case 'artist': artists.push(item); break;
        case 'playlist': playlists.push(item); break;
      }
    });
  });

  return { songs, albums, artists, playlists };
}

// ─── History Parser ─────────────────────────────────

function parseHistoryPage(response) {
  const sections = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents
    ?.map((c) => {
      const shelf = c.musicShelfRenderer;
      if (!shelf) return null;
      return {
        title: shelf.title?.runs?.[0]?.text,
        items: getItems(shelf.contents)
          ?.map((s) => parseMusicResponsiveListItemRenderer(s.musicResponsiveListItemRenderer))
          .filter(Boolean) || [],
      };
    })
    .filter(Boolean) || [];

  return { sections };
}

// ─── Mood & Genres Parser ───────────────────────────

function parseMoodAndGenre(renderer) {
  if (!renderer) return null;
  return {
    title: renderer.buttonText?.runs?.[0]?.text,
    browseId: renderer.clickCommand?.browseEndpoint?.browseId,
    params: renderer.clickCommand?.browseEndpoint?.params,
    color: renderer.solid?.leftStripeColor,
  };
}

// ─── Browse Result Parser ───────────────────────────

function parseBrowseResult(response) {
  const title = response.header?.musicHeaderRenderer?.title?.runs?.[0]?.text;
  const contents = response.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents;

  const items = contents?.map((content) => {
    if (content.gridRenderer) {
      return {
        title: content.gridRenderer.header?.gridHeaderRenderer?.title?.runs?.[0]?.text,
        items: content.gridRenderer.items
          ?.map((i) => parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
          .filter(Boolean) || [],
      };
    }
    if (content.musicCarouselShelfRenderer) {
      return {
        title: content.musicCarouselShelfRenderer.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text,
        items: content.musicCarouselShelfRenderer.contents
          ?.map((c) => parseMusicTwoRowItemRenderer(c.musicTwoRowItemRenderer))
          .filter(Boolean) || [],
      };
    }
    return null;
  }).filter(Boolean) || [];

  return { title, items };
}

// ─── Player Response Parser ─────────────────────────

function parsePlayerResponse(response) {
  if (!response) return null;

  const streamingData = response.streamingData;
  const videoDetails = response.videoDetails;
  const playabilityStatus = response.playabilityStatus;

  return {
    playabilityStatus: {
      status: playabilityStatus?.status,
      reason: playabilityStatus?.reason,
    },
    videoDetails: videoDetails ? {
      videoId: videoDetails.videoId,
      title: videoDetails.title,
      lengthSeconds: videoDetails.lengthSeconds,
      channelId: videoDetails.channelId,
      shortDescription: videoDetails.shortDescription,
      thumbnail: videoDetails.thumbnail?.thumbnails?.slice(-1)?.[0],
      viewCount: videoDetails.viewCount,
      author: videoDetails.author,
      isLiveContent: videoDetails.isLiveContent,
    } : null,
    streamingData: streamingData ? {
      expiresInSeconds: streamingData.expiresInSeconds,
      formats: streamingData.formats?.map(parseStreamFormat) || [],
      adaptiveFormats: streamingData.adaptiveFormats?.map(parseStreamFormat) || [],
    } : null,
  };
}

function parseStreamFormat(format) {
  return {
    itag: format.itag,
    url: format.url || format.signatureCipher,
    mimeType: format.mimeType,
    bitrate: format.bitrate,
    width: format.width,
    height: format.height,
    contentLength: format.contentLength,
    quality: format.quality,
    qualityLabel: format.qualityLabel,
    audioQuality: format.audioQuality,
    audioSampleRate: format.audioSampleRate,
    audioChannels: format.audioChannels,
    averageBitrate: format.averageBitrate,
    approxDurationMs: format.approxDurationMs,
  };
}

// ─── Transcript Parser ──────────────────────────────

function parseTranscript(response) {
  const cueGroups = response.actions?.[0]?.updateEngagementPanelAction?.content
    ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;

  if (!cueGroups) return null;

  return cueGroups.map((group) => {
    const cue = group.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer;
    if (!cue) return null;
    const time = cue.startOffsetMs;
    const text = (cue.cue?.simpleText || '').replace(/^♪\s*/, '').replace(/\s*♪$/, '').trim();
    const min = Math.floor(time / 60000);
    const sec = Math.floor((time / 1000) % 60);
    const ms = time % 1000;
    return `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}]${text}`;
  }).filter(Boolean).join('\n');
}

// ─── Queue Parser ───────────────────────────────────

function parseQueue(response) {
  return response.queueDatas
    ?.map((qd) => parsePlaylistPanelVideoRenderer(qd.content?.playlistPanelVideoRenderer))
    .filter(Boolean) || [];
}

// ─── Generic Item Parsers ───────────────────────────

function parseMusicResponsiveListItemRenderer(renderer) {
  if (!renderer) return null;

  try {
    const flexColumns = renderer.flexColumns || [];
    const firstCol = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text;
    const secondCol = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text;

    const title = firstCol?.runs?.[0]?.text;
    const videoId = renderer.playlistItemData?.videoId
      || renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
        ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
    const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;

    const thumbnail = getThumbnailUrl(renderer.thumbnail?.musicThumbnailRenderer)
      || renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;

    const explicit = renderer.badges?.some(
      (b) => b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE'
    ) || false;

    // Determine type
    const pageType = renderer.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
      ?.browseEndpointContextMusicConfig?.pageType;
    const musicVideoType = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
      ?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

    if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || browseId?.startsWith('UC')) {
      return {
        type: 'artist',
        id: browseId,
        title,
        thumbnail,
        subscribers: secondCol?.runs?.[0]?.text,
      };
    }

    if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') {
      const playlistId = renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
        ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchPlaylistEndpoint?.playlistId;
      return {
        type: 'album',
        browseId,
        playlistId,
        title,
        artists: secondCol?.runs?.filter((r) => r.navigationEndpoint)
          .map((r) => ({ name: r.text, id: r.navigationEndpoint?.browseEndpoint?.browseId })) || [],
        year: parseInt(secondCol?.runs?.slice(-1)?.[0]?.text) || null,
        thumbnail,
        explicit,
      };
    }

    if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') {
      const playlistId = browseId?.replace(/^VL/, '');
      return {
        type: 'playlist',
        id: playlistId,
        browseId,
        title,
        author: secondCol?.runs?.[0] ? {
          name: secondCol.runs[0].text,
          id: secondCol.runs[0].navigationEndpoint?.browseEndpoint?.browseId,
        } : null,
        thumbnail,
      };
    }

    // Default to song
    if (videoId || title) {
      const artists = secondCol?.runs
        ?.filter((r) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
        .map((r) => ({
          name: r.text,
          id: r.navigationEndpoint?.browseEndpoint?.browseId,
        })) || [];

      // If no artists found from browseEndpoint, try basic parsing
      if (!artists.length && secondCol?.runs?.length) {
        const filtered = secondCol.runs.filter((r) => r.text && r.text !== ' • ' && r.text !== ' & ');
        if (filtered.length) {
          artists.push(...filtered.slice(0, 1).map((r) => ({
            name: r.text,
            id: r.navigationEndpoint?.browseEndpoint?.browseId || null,
          })));
        }
      }

      return {
        type: 'song',
        id: videoId,
        title,
        artists,
        thumbnail,
        explicit,
        musicVideoType,
        album: secondCol?.runs?.find((r) =>
          r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb')
        )
          ? {
              name: secondCol.runs.find((r) =>
                r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb')
              ).text,
              id: secondCol.runs.find((r) =>
                r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb')
              ).navigationEndpoint.browseEndpoint.browseId,
            }
          : null,
        duration: renderer.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer
          ?.text?.runs?.[0]?.text
          || (secondCol?.runs?.[secondCol.runs.length - 1]?.text?.match(/^\d+:\d+(:\d+)?$/)
            ? secondCol.runs[secondCol.runs.length - 1].text
            : null),
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

function parseMusicTwoRowItemRenderer(renderer) {
  if (!renderer) return null;

  try {
    const title = renderer.title?.runs?.[0]?.text;
    const subtitle = renderer.subtitle?.runs;
    const thumbnail = getThumbnailUrl(renderer.thumbnailRenderer?.musicThumbnailRenderer);
    const browseId = renderer.navigationEndpoint?.browseEndpoint?.browseId;
    const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId;

    const explicit = renderer.subtitleBadges?.some(
      (b) => b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE'
    ) || false;

    const musicVideoType = renderer.navigationEndpoint?.watchEndpoint
      ?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

    // Album detection
    if (browseId?.startsWith('MPREb')) {
      const playlistId = renderer.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content
        ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchPlaylistEndpoint?.playlistId;
      return {
        type: 'album',
        browseId,
        playlistId,
        title,
        artists: oddElements(subtitle)?.slice(1)
          ?.map((r) => ({
            name: r.text,
            id: r.navigationEndpoint?.browseEndpoint?.browseId,
          }))
          .filter((a) => a.id) || [],
        year: parseInt(subtitle?.slice(-1)?.[0]?.text) || null,
        thumbnail,
        explicit,
      };
    }

    // Song detection
    if (videoId) {
      return {
        type: 'song',
        id: videoId,
        title,
        artists: subtitle?.filter((r) => r.navigationEndpoint?.browseEndpoint?.browseId)
          .map((r) => ({
            name: r.text,
            id: r.navigationEndpoint.browseEndpoint.browseId,
          })) || [],
        thumbnail,
        explicit,
        musicVideoType,
      };
    }

    // Artist detection
    if (browseId?.startsWith('UC')) {
      return {
        type: 'artist',
        id: browseId,
        title,
        thumbnail,
        subscribers: subtitle?.[0]?.text,
      };
    }

    // Playlist detection
    if (browseId?.startsWith('VL') || browseId?.startsWith('RDCLAK')) {
      return {
        type: 'playlist',
        id: browseId?.replace(/^VL/, ''),
        browseId,
        title,
        author: subtitle?.[0] ? {
          name: subtitle[0].text,
          id: subtitle[0].navigationEndpoint?.browseEndpoint?.browseId,
        } : null,
        thumbnail,
      };
    }

    // Fallback
    return {
      type: 'unknown',
      browseId,
      videoId,
      title,
      thumbnail,
      subtitle: subtitle?.map((r) => r.text).join(''),
    };
  } catch (err) {
    return null;
  }
}

function parseMusicCardShelfRenderer(renderer) {
  if (!renderer) return null;

  const title = renderer.title?.runs?.[0]?.text;
  const subtitle = renderer.subtitle?.runs;
  const thumbnail = getThumbnailUrl(renderer.thumbnail?.musicThumbnailRenderer);
  const videoId = renderer.onTap?.watchEndpoint?.videoId;
  const browseId = renderer.onTap?.browseEndpoint?.browseId;

  if (videoId) {
    return {
      type: 'song',
      id: videoId,
      title,
      artists: subtitle?.filter((r) => r.navigationEndpoint?.browseEndpoint)
        .map((r) => ({
          name: r.text,
          id: r.navigationEndpoint.browseEndpoint.browseId,
        })) || [],
      thumbnail,
    };
  }

  if (browseId?.startsWith('MPREb')) {
    return {
      type: 'album',
      browseId,
      title,
      artists: subtitle?.filter((r) => r.navigationEndpoint?.browseEndpoint)
        .map((r) => ({
          name: r.text,
          id: r.navigationEndpoint.browseEndpoint.browseId,
        })) || [],
      thumbnail,
    };
  }

  if (browseId?.startsWith('UC')) {
    return {
      type: 'artist',
      id: browseId,
      title,
      thumbnail,
    };
  }

  return {
    type: 'unknown',
    browseId,
    title,
    thumbnail,
    subtitle: subtitle?.map((r) => r.text).join(''),
  };
}

function parseSearchItem(renderer) {
  return parseMusicResponsiveListItemRenderer(renderer);
}

function parseAlbumSong(renderer, album = null) {
  if (!renderer) return null;

  const flexColumns = renderer.flexColumns || [];
  const firstCol = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text;
  const secondCol = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text;

  const title = firstCol?.runs?.[0]?.text;
  const videoId = renderer.playlistItemData?.videoId
    || renderer.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

  if (!title && !videoId) return null;

  const artists = secondCol?.runs
    ?.filter((r) => r.navigationEndpoint?.browseEndpoint?.browseId)
    .map((r) => ({
      name: r.text,
      id: r.navigationEndpoint.browseEndpoint.browseId,
    })) || album?.artists || [];

  return {
    type: 'song',
    id: videoId,
    title,
    artists,
    thumbnail: album?.thumbnail
      || getThumbnailUrl(renderer.thumbnail?.musicThumbnailRenderer),
    explicit: renderer.badges?.some(
      (b) => b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE'
    ) || false,
    album: album ? { name: album.title, id: album.browseId } : null,
    duration: renderer.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer
      ?.text?.runs?.[0]?.text
      || (secondCol?.runs?.[secondCol.runs.length - 1]?.text?.match(/^\d+:\d+(:\d+)?$/)
        ? secondCol.runs[secondCol.runs.length - 1].text
        : null),
  };
}

function parseChartItem(renderer) {
  if (!renderer) return null;

  const flexColumns = renderer.flexColumns || [];
  if (flexColumns.length < 3 || !renderer.playlistItemData?.videoId) return null;

  const firstCol = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text;
  const secondCol = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text;
  const thirdCol = flexColumns[2]?.musicResponsiveListItemFlexColumnRenderer?.text;

  const title = firstCol?.runs?.[0]?.text;
  if (!title) return null;

  return {
    type: 'song',
    id: renderer.playlistItemData.videoId,
    title,
    artists: secondCol?.runs?.map((r) => ({
      name: r.text,
      id: r.navigationEndpoint?.browseEndpoint?.browseId || null,
    })).filter((a) => a.name) || [],
    thumbnail: getThumbnailUrl(renderer.thumbnail?.musicThumbnailRenderer),
    explicit: renderer.badges?.some(
      (b) => b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE'
    ) || false,
    chartPosition: parseInt(thirdCol?.runs?.[0]?.text) || null,
    chartChange: thirdCol?.runs?.[1]?.text || null,
  };
}

function parsePlaylistPanelVideoRenderer(renderer) {
  if (!renderer) return null;

  const title = renderer.title?.runs?.[0]?.text;
  const videoId = renderer.videoId || renderer.navigationEndpoint?.watchEndpoint?.videoId;
  const thumbnail = renderer.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;

  const artists = renderer.longBylineText?.runs
    ?.filter((r) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))
    .map((r) => ({
      name: r.text,
      id: r.navigationEndpoint.browseEndpoint.browseId,
    })) || [];

  const album = renderer.longBylineText?.runs
    ?.find((r) => r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('MPREb'));

  const musicVideoType = renderer.navigationEndpoint?.watchEndpoint
    ?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

  // Extract library tokens from menu
  let libraryAddToken = null;
  let libraryRemoveToken = null;
  renderer.menu?.menuRenderer?.items?.forEach((item) => {
    const toggleRenderer = item.toggleMenuServiceItemRenderer;
    if (toggleRenderer) {
      const icon = toggleRenderer.defaultIcon?.iconType;
      if (icon === 'LIBRARY_ADD') {
        libraryAddToken = toggleRenderer.defaultServiceEndpoint?.feedbackEndpoint?.feedbackToken;
      }
      if (icon === 'LIBRARY_REMOVE' || icon === 'LIBRARY_SAVED') {
        libraryRemoveToken = toggleRenderer.defaultServiceEndpoint?.feedbackEndpoint?.feedbackToken;
      }
    }
  });

  return {
    type: 'song',
    id: videoId,
    title,
    artists,
    thumbnail,
    musicVideoType,
    album: album ? {
      name: album.text,
      id: album.navigationEndpoint.browseEndpoint.browseId,
    } : null,
    duration: renderer.lengthText?.runs?.[0]?.text || null,
    libraryAddToken,
    libraryRemoveToken,
    explicit: renderer.badges?.some(
      (b) => b.musicInlineBadgeRenderer?.icon?.iconType === 'MUSIC_EXPLICIT_BADGE'
    ) || false,
  };
}

function deduplicateById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || item.browseId;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Library Parser ─────────────────────────────────

function parseLibraryPage(response) {
  const tabs = response.contents?.singleColumnBrowseResultsRenderer?.tabs;
  const contents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0];

  if (contents?.gridRenderer) {
    const items = contents.gridRenderer.items
      ?.map((i) => parseMusicTwoRowItemRenderer(i.musicTwoRowItemRenderer))
      .filter(Boolean) || [];
    return {
      items,
      continuation: getContinuation(contents.gridRenderer.continuations),
    };
  }

  if (contents?.musicShelfRenderer) {
    const items = getItems(contents.musicShelfRenderer.contents)
      ?.map((c) => parseMusicResponsiveListItemRenderer(c.musicResponsiveListItemRenderer))
      .filter(Boolean) || [];
    return {
      items,
      continuation: getContinuation(contents.musicShelfRenderer.continuations),
    };
  }

  return { items: [], continuation: null };
}

// ─── Account Info Parser ────────────────────────────

function parseAccountInfo(response) {
  const header = response.actions?.[0]?.openPopupAction?.popup?.multiPageMenuRenderer
    ?.header?.activeAccountHeaderRenderer;
  if (!header) return null;

  return {
    name: header.accountName?.runs?.[0]?.text,
    email: header.email?.runs?.[0]?.text,
    channelHandle: header.channelHandle?.runs?.[0]?.text,
  };
}

// ─── Visitor Data Parser ────────────────────────────

function parseVisitorData(rawText) {
  try {
    const json = JSON.parse(rawText.substring(5));
    const arr = json[0][2];
    const match = arr.find((el) => {
      if (typeof el === 'string') return /^Cg[ts]/.test(el);
      return false;
    });
    return match || null;
  } catch {
    return null;
  }
}

// ─── Exports ────────────────────────────────────────

module.exports = {
  parseSearchSuggestions,
  parseSearchSummary,
  parseSearchResults,
  parseSearchContinuation,
  parseAlbumPage,
  parseAlbumSongs,
  parseArtistPage,
  parseHomePage,
  parseHomeContinuation,
  parseExplorePage,
  parseChartsPage,
  parsePlaylistPage,
  parsePlaylistContinuation,
  parseNextResult,
  parseLyrics,
  parseRelatedPage,
  parseHistoryPage,
  parsePlayerResponse,
  parseTranscript,
  parseQueue,
  parseBrowseResult,
  parseLibraryPage,
  parseAccountInfo,
  parseVisitorData,
  parseMusicResponsiveListItemRenderer,
  parseMusicTwoRowItemRenderer,
};
