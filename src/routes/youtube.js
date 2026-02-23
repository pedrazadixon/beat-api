/**
 * YouTube Music API Routes
 * REST endpoints for the translated InnerTube API.
 */

const express = require('express');
const YouTube = require('../innertube/youtube');

const router = express.Router();
const yt = new YouTube();

// ─── Helper ─────────────────────────────────────────

function wrapAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── Search ─────────────────────────────────────────

/**
 * GET /api/youtube/search/suggestions?q=query
 */
router.get('/search/suggestions', wrapAsync(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
  const data = await yt.searchSuggestions(q);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/search/summary?q=query
 */
router.get('/search/summary', wrapAsync(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
  const data = await yt.searchSummary(q);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/search?q=query&filter=SONG|VIDEO|ALBUM|ARTIST|FEATURED_PLAYLIST|COMMUNITY_PLAYLIST
 */
router.get('/search', wrapAsync(async (req, res) => {
  const { q, filter } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
  const data = await yt.search(q, filter || null);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/search/continuation?token=...
 */
router.get('/search/continuation', wrapAsync(async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Query parameter "token" is required' });
  const data = await yt.searchContinuation(token);
  res.json({ success: true, data });
}));

// ─── Album ──────────────────────────────────────────

/**
 * GET /api/youtube/album/:browseId?withSongs=true
 */
router.get('/album/:browseId', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const withSongs = req.query.withSongs !== 'false';
  const data = await yt.album(browseId, withSongs);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/album/:playlistId/songs
 */
router.get('/album/:playlistId/songs', wrapAsync(async (req, res) => {
  const { playlistId } = req.params;
  const songs = await yt.albumSongs(playlistId);
  res.json({ success: true, data: { songs } });
}));

// ─── Artist ─────────────────────────────────────────

/**
 * GET /api/youtube/artist/:browseId
 */
router.get('/artist/:browseId', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const data = await yt.artist(browseId);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/artist/:browseId/albums
 */
router.get('/artist/:browseId/albums', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const data = await yt.artistAlbums(browseId);
  res.json({ success: true, data });
}));


/**
 * GET /api/youtube/artist/:browseId/items?params=...
 */
router.get('/artist/:browseId/items', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const { params } = req.query;
  const data = await yt.artistItems(browseId, params || null);
  const { _visitorData, ...publicData } = data; // Strip internal field
  res.json({ success: true, data: publicData });
}));

/**
 * GET /api/youtube/artist/items/continuation?token=...
 */
router.get('/artist/items/continuation', wrapAsync(async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Query parameter "token" is required' });
  const data = await yt.artistItemsContinuation(token);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/artist/albums/continuation?token=...&visitorData=...
 * Paginates over artist albums. Requires the token AND visitorData from the previous response.
 * Both fields are returned together in /artist/:browseId/albums and each continuation response.
 */
router.get('/artist/albums/continuation', wrapAsync(async (req, res) => {
  const { token, visitorData } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Query parameter "token" is required' });
  if (!visitorData) return res.status(400).json({ success: false, error: 'Query parameter "visitorData" is required (returned alongside "continuation" in the albums response)' });
  const data = await yt.artistAlbumsContinuation(token, visitorData);
  res.json({ success: true, data });
}));



// ─── Playlist ───────────────────────────────────────


/**
 * GET /api/youtube/playlist/:playlistId
 */
router.get('/playlist/:playlistId', wrapAsync(async (req, res) => {
  const { playlistId } = req.params;
  const data = await yt.playlist(playlistId);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/playlist/continuation?token=...
 */
router.get('/playlist/continuation', wrapAsync(async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Query parameter "token" is required' });
  const data = await yt.playlistContinuation(token);
  res.json({ success: true, data });
}));

// ─── Home ───────────────────────────────────────────

/**
 * GET /api/youtube/home?continuation=...&params=...
 */
router.get('/home', wrapAsync(async (req, res) => {
  const { continuation, params } = req.query;
  const data = await yt.home(continuation || null, params || null);
  res.json({ success: true, data });
}));

// ─── Explore ────────────────────────────────────────

/**
 * GET /api/youtube/explore
 */
router.get('/explore', wrapAsync(async (req, res) => {
  const data = await yt.explore();
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/new-releases
 */
router.get('/new-releases', wrapAsync(async (req, res) => {
  const data = await yt.newReleaseAlbums();
  res.json({ success: true, data: { albums: data } });
}));

/**
 * GET /api/youtube/mood-and-genres
 */
router.get('/mood-and-genres', wrapAsync(async (req, res) => {
  const data = await yt.moodAndGenres();
  res.json({ success: true, data });
}));

// ─── Charts ─────────────────────────────────────────

/**
 * GET /api/youtube/charts?continuation=...
 */
router.get('/charts', wrapAsync(async (req, res) => {
  const { continuation } = req.query;
  const data = await yt.charts(continuation || null);
  res.json({ success: true, data });
}));

// ─── Browse ─────────────────────────────────────────

/**
 * GET /api/youtube/browse/:browseId?params=...
 */
router.get('/browse/:browseId', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const { params } = req.query;
  const data = await yt.browse(browseId, params || null);
  res.json({ success: true, data });
}));

// ─── Library ────────────────────────────────────────

/**
 * GET /api/youtube/library/:browseId
 */
router.get('/library/:browseId', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const data = await yt.library(browseId);
  res.json({ success: true, data });
}));

/**
 * GET /api/youtube/library/continuation?token=...
 */
router.get('/library/continuation', wrapAsync(async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Query parameter "token" is required' });
  const data = await yt.libraryContinuation(token);
  res.json({ success: true, data });
}));

// ─── History ────────────────────────────────────────

/**
 * GET /api/youtube/history
 */
router.get('/history', wrapAsync(async (req, res) => {
  const data = await yt.musicHistory();
  res.json({ success: true, data });
}));

// ─── Player ─────────────────────────────────────────

/**
 * GET /api/youtube/player/:videoId?playlistId=...&client=WEB_REMIX
 */
router.get('/player/:videoId', wrapAsync(async (req, res) => {
  const { videoId } = req.params;
  const { playlistId, client, signatureTimestamp, poToken } = req.query;
  const data = await yt.player(
    videoId,
    playlistId || null,
    client || 'WEB_REMIX',
    signatureTimestamp ? parseInt(signatureTimestamp) : null,
    poToken || null
  );
  res.json({ success: true, data });
}));

// ─── Next / Queue ───────────────────────────────────

/**
 * GET /api/youtube/next/:videoId?playlistId=...
 */
router.get('/next/:videoId', wrapAsync(async (req, res) => {
  const { videoId } = req.params;
  const { playlistId, playlistSetVideoId, index, params, continuation } = req.query;
  const data = await yt.next(
    videoId,
    playlistId || null,
    playlistSetVideoId || null,
    index ? parseInt(index) : null,
    params || null,
    continuation || null
  );
  res.json({ success: true, data });
}));

/**
 * POST /api/youtube/queue
 * Body: { videoIds: [...], playlistId: "..." }
 */
router.post('/queue', wrapAsync(async (req, res) => {
  const { videoIds, playlistId } = req.body;
  const data = await yt.queue(videoIds || null, playlistId || null);
  res.json({ success: true, data });
}));

// ─── Lyrics & Related ───────────────────────────────

/**
 * GET /api/youtube/lyrics/:browseId
 */
router.get('/lyrics/:browseId', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const { params } = req.query;
  const data = await yt.lyrics(browseId, params || null);
  res.json({ success: true, data: { lyrics: data } });
}));

/**
 * GET /api/youtube/related/:browseId
 */
router.get('/related/:browseId', wrapAsync(async (req, res) => {
  const { browseId } = req.params;
  const data = await yt.related(browseId);
  res.json({ success: true, data });
}));

// ─── Transcript ─────────────────────────────────────

/**
 * GET /api/youtube/transcript/:videoId
 */
router.get('/transcript/:videoId', wrapAsync(async (req, res) => {
  const { videoId } = req.params;
  const data = await yt.transcript(videoId);
  res.json({ success: true, data: { transcript: data } });
}));

// ─── Account ────────────────────────────────────────

/**
 * GET /api/youtube/account
 */
router.get('/account', wrapAsync(async (req, res) => {
  const data = await yt.accountInfo();
  res.json({ success: true, data });
}));

// ─── Likes & Subscribe ─────────────────────────────

/**
 * POST /api/youtube/like/video
 * Body: { videoId: "...", like: true|false }
 */
router.post('/like/video', wrapAsync(async (req, res) => {
  const { videoId, like = true } = req.body;
  if (!videoId) return res.status(400).json({ success: false, error: 'videoId is required' });
  await yt.likeVideo(videoId, like);
  res.json({ success: true });
}));

/**
 * POST /api/youtube/like/playlist
 * Body: { playlistId: "...", like: true|false }
 */
router.post('/like/playlist', wrapAsync(async (req, res) => {
  const { playlistId, like = true } = req.body;
  if (!playlistId) return res.status(400).json({ success: false, error: 'playlistId is required' });
  await yt.likePlaylist(playlistId, like);
  res.json({ success: true });
}));

/**
 * POST /api/youtube/subscribe
 * Body: { channelId: "...", subscribe: true|false }
 */
router.post('/subscribe', wrapAsync(async (req, res) => {
  const { channelId, subscribe = true } = req.body;
  if (!channelId) return res.status(400).json({ success: false, error: 'channelId is required' });
  await yt.subscribeChannel(channelId, subscribe);
  res.json({ success: true });
}));

// ─── Playlist Management ────────────────────────────

/**
 * POST /api/youtube/playlist/create
 * Body: { title: "..." }
 */
router.post('/playlist/create', wrapAsync(async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'title is required' });
  const playlistId = await yt.createPlaylist(title);
  res.json({ success: true, data: { playlistId } });
}));

/**
 * POST /api/youtube/playlist/rename
 * Body: { playlistId: "...", name: "..." }
 */
router.post('/playlist/rename', wrapAsync(async (req, res) => {
  const { playlistId, name } = req.body;
  if (!playlistId || !name) return res.status(400).json({ success: false, error: 'playlistId and name are required' });
  await yt.renamePlaylist(playlistId, name);
  res.json({ success: true });
}));

/**
 * DELETE /api/youtube/playlist/:playlistId
 */
router.delete('/playlist/:playlistId', wrapAsync(async (req, res) => {
  const { playlistId } = req.params;
  await yt.deletePlaylist(playlistId);
  res.json({ success: true });
}));

/**
 * POST /api/youtube/playlist/add
 * Body: { playlistId: "...", videoId: "..." }
 */
router.post('/playlist/add', wrapAsync(async (req, res) => {
  const { playlistId, videoId } = req.body;
  if (!playlistId || !videoId) return res.status(400).json({ success: false, error: 'playlistId and videoId are required' });
  await yt.addToPlaylist(playlistId, videoId);
  res.json({ success: true });
}));

/**
 * POST /api/youtube/playlist/remove
 * Body: { playlistId: "...", videoId: "...", setVideoId: "..." }
 */
router.post('/playlist/remove', wrapAsync(async (req, res) => {
  const { playlistId, videoId, setVideoId } = req.body;
  if (!playlistId || !videoId || !setVideoId) {
    return res.status(400).json({ success: false, error: 'playlistId, videoId, and setVideoId are required' });
  }
  await yt.removeFromPlaylist(playlistId, videoId, setVideoId);
  res.json({ success: true });
}));

// ─── Library Song Toggle ────────────────────────────

/**
 * POST /api/youtube/library/add
 * Body: { videoId: "..." }
 */
router.post('/library/add', wrapAsync(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ success: false, error: 'videoId is required' });
  const result = await yt.addSongToLibrary(videoId);
  res.json({ success: true, data: { processed: result } });
}));

/**
 * POST /api/youtube/library/remove
 * Body: { videoId: "..." }
 */
router.post('/library/remove', wrapAsync(async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ success: false, error: 'videoId is required' });
  const result = await yt.removeSongFromLibrary(videoId);
  res.json({ success: true, data: { processed: result } });
}));

// ─── Error handler ──────────────────────────────────

router.use((err, req, res, _next) => {
  console.error(`[YT_ROUTE_ERROR] ${req.method} ${req.path}:`, err.message);
  const status = err.response?.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = router;
