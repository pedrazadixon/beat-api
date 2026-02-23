import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import config from './test.config.js';

describe('Stream Endpoints', () => {
  let extractUrl = '';

  it('GET /api/stream/extract?videoId= - debería extraer la url del stream', async () => {
    const res = await request(app)
      .get(`/api/stream/extract?videoId=${config.stream.videoId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.streamUrl).toBeDefined();

    // Guardar la URL extraída para la prueba de proxy proxy URL
    extractUrl = res.body.data.streamUrl;
  }, 20000); // 20 seg por ytdlp extraction

  it('GET /api/stream/proxy?url= - debería hacer proxy del stream sin descargar por completo', (done) => {
    // Si extractUrl falló, usa una dummy y espera el error, pero preferible saltar o fallar
    if (!extractUrl) {
      throw new Error('extractUrl está vación. La prueba de extract falló.');
    }

    const req = request(app)
      .get(`/api/stream/proxy?url=${encodeURIComponent(extractUrl)}`);

    req.buffer(false).end((err, res) => {
      // Para evitar descargar todo el archivo en memoria, solo verificamos las cabeceras/status
      if (err) return done(err);
      expect(res.status).toBe(200);
      done();
    });
  }, 30000);

  it('GET /api/stream/play?videoId= - debería procesar un url de play sin buffer completo', (done) => {
    const req = request(app)
      .get(`/api/stream/play?videoId=${config.stream.videoId}`);

    req.buffer(false).end((err, res) => {
      if (err) return done(err);
      expect(res.status).toBe(200);
      done();
    });
  }, 30000);
});
