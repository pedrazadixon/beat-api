import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import config from './test.config.js';

// process.env.BEARER_TOKEN is loaded inside server.js because it calls require('dotenv').config()
const TOKEN = process.env.BEARER_TOKEN;
const AUTH_HEADER = `Bearer ${TOKEN}`;

describe('YouTube Endpoints', () => {
  it('GET /api/youtube/search - debería retornar los resultados de búsqueda', async () => {
    const res = await request(app)
      .get(`/api/youtube/search?q=${encodeURIComponent(config.youtube.searchQuery)}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  }, 15000); // 15 seconds timeout

  it('GET /api/youtube/search/suggestions - debería retornar sugerencias de búsqueda', async () => {
    const res = await request(app)
      .get(`/api/youtube/search/suggestions?q=${encodeURIComponent(config.youtube.suggestionQuery)}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  }, 10000);

  it('GET /api/youtube/search/summary - debería retornar resumen de búsqueda', async () => {
    const res = await request(app)
      .get(`/api/youtube/search/summary?q=${encodeURIComponent(config.youtube.searchQuery)}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // result contains top result + sections or items
  }, 15000);

  it('GET /api/youtube/home - debería retornar página principal', async () => {
    const res = await request(app)
      .get('/api/youtube/home')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  }, 15000);

  it('GET /api/youtube/explore - debería retornar página explora', async () => {
    const res = await request(app)
      .get('/api/youtube/explore')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 15000);

  it('GET /api/youtube/charts - debería retornar charts/éxitos', async () => {
    const res = await request(app)
      .get('/api/youtube/charts')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 15000);

  it('GET /api/youtube/album/:browseId - debería retornar un álbum', async () => {
    const res = await request(app)
      .get(`/api/youtube/album/${config.youtube.albumId}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  }, 10000);

  it('GET /api/youtube/artist/:browseId - debería retornar un artista', async () => {
    const res = await request(app)
      .get(`/api/youtube/artist/${config.youtube.artistId}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  }, 10000);

  it('GET /api/youtube/playlist/:playlistId - debería retornar una lista de reproducción', async () => {
    const res = await request(app)
      .get(`/api/youtube/playlist/${config.youtube.playlistId}`)
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  }, 15000);
});
