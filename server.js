'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

const PORT = parseInt(process.env.PORT, 10) || 3007;
const DIST = path.join(__dirname, 'dist');
const RUNTIME_CONFIG = path.join(__dirname, 'runtime-config.json');

// In-memory log buffer
const logBuffer = [];
const MAX_LOG_LINES = 200;
function appendLog(level, args) {
  const line = { t: new Date().toISOString(), level, msg: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') };
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
}
const _log = console.log.bind(console);
const _error = console.error.bind(console);
console.log = (...args) => { appendLog('info', args); _log(...args); };
console.error = (...args) => { appendLog('error', args); _error(...args); };

// Auto-build in the background if dist is missing (e.g. after a plugin update)
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('[swish-ui] dist not found — running npm install && npm run build in background...');
  exec('npm run build', { cwd: __dirname, maxBuffer: 10 * 1024 * 1024 }, (err, _stdout, stderr) => {
    if (err) {
      console.error('[swish-ui] build failed:', err.message);
      console.error('[swish-ui] stderr:', stderr.slice(-2000));
    } else {
      console.log('[swish-ui] build complete — refresh the page.');
    }
  });
}

// In-memory lyrics cache
const lyricsCache = {};

// In-memory similar tracks cache: { [trackId]: [id, id, ...] }
const similarTracksCache = {};

// In-memory album tracks cache: { [trackId]: [id, id, ...] }
const albumTracksCache = {};

const app = express();
app.use(express.json());

// --- /health ---
app.get('/health', (req, res) => {
  const distExists = fs.existsSync(path.join(DIST, 'index.html'));
  res.json({
    status: 'ok',
    port: PORT,
    distBuilt: distExists,
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime())
  });
});

// --- /api/logs ---
app.get('/api/logs', (req, res) => {
  res.json(logBuffer);
});

// --- /api/config ---
app.get('/api/config', (req, res) => {
  try {
    const cfg = fs.existsSync(RUNTIME_CONFIG)
      ? JSON.parse(fs.readFileSync(RUNTIME_CONFIG, 'utf8'))
      : {};
    res.json({
      tidalClientId: cfg.tidalClientId || '',
      tidalClientSecret: cfg.tidalClientSecret || '',
      geniusClientId: cfg.geniusClientId || '',
      geniusClientSecret: cfg.geniusClientSecret || '',
      geniusAccessToken: cfg.geniusAccessToken || ''
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- /api/lrclib/search ---
function parseLyrics(text) {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const parsedLines = [];
  lines.forEach(line => {
    const timestampMatches = line.match(/\[\d+:\d+\.\d+\]/g);
    if (!timestampMatches) return;
    const lastTimestampIndex = line.lastIndexOf(']') + 1;
    const lyricText = line.substring(lastTimestampIndex).trim();
    timestampMatches.forEach(timestamp => {
      const timeStr = timestamp.substring(1, timestamp.length - 1);
      const [minutes, seconds] = timeStr.split(':');
      const timeMs = (parseInt(minutes) * 60 + parseFloat(seconds)) * 1000;
      parsedLines.push({ time: timeMs, text: lyricText });
    });
  });
  return parsedLines.sort((a, b) => a.time - b.time);
}

function sanitizeString(s) {
  if (!s) return '';
  return s.replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const options = headers ? { headers } : {};
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) { resolve({ error: 'TrackNotFound' }); return; }
        if (res.statusCode !== 200) { reject(new Error('Response status: ' + res.statusCode)); return; }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getGeniusToken() {
  try {
    const cfg = fs.existsSync(RUNTIME_CONFIG)
      ? JSON.parse(fs.readFileSync(RUNTIME_CONFIG, 'utf8'))
      : {};
    return cfg.geniusAccessToken || '';
  } catch (e) {
    return '';
  }
}

function getTidalCredentials() {
  try {
    const cfg = fs.existsSync(RUNTIME_CONFIG)
      ? JSON.parse(fs.readFileSync(RUNTIME_CONFIG, 'utf8'))
      : {};
    return { clientId: cfg.tidalClientId || '', clientSecret: cfg.tidalClientSecret || '' };
  } catch (e) {
    return { clientId: '', clientSecret: '' };
  }
}

// In-memory Tidal token cache
let tidalTokenCache = null;

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error('Response status: ' + res.statusCode)); return; }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getTidalToken() {
  if (tidalTokenCache && tidalTokenCache.expiry > Date.now() + 60000) {
    return tidalTokenCache.token;
  }
  const { clientId, clientSecret } = getTidalCredentials();
  if (!clientId || !clientSecret) return null;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const data = await httpsPost(
    'auth.tidal.com',
    '/v1/oauth2/token',
    { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    'grant_type=client_credentials'
  );
  tidalTokenCache = { token: data.access_token, expiry: Date.now() + data.expires_in * 1000 };
  return tidalTokenCache.token;
}

async function searchAllWithFallbacks(track, artist, album) {
  const attempts = [
    `track_name=${encodeURIComponent(track)}&artist_name=${encodeURIComponent(artist)}&album_name=${encodeURIComponent(album || '')}`,
    `track_name=${encodeURIComponent(sanitizeString(track))}&artist_name=${encodeURIComponent(artist)}&album_name=${encodeURIComponent(sanitizeString(album || ''))}`,
    `track_name=${encodeURIComponent(track)}&artist_name=${encodeURIComponent(artist)}`,
    `track_name=${encodeURIComponent(sanitizeString(track))}&artist_name=${encodeURIComponent(artist)}`
  ];
  for (const query of attempts) {
    const result = await httpsGet(`https://lrclib.net/api/search?${query}`);
    if (Array.isArray(result) && result.length > 0) {
      // Sort: results with syncedLyrics first, then plainLyrics-only
      return result.sort((a, b) => {
        const aS = !!a.syncedLyrics, bS = !!b.syncedLyrics;
        if (aS && !bS) return -1;
        if (!aS && bS) return 1;
        return 0;
      });
    }
  }
  return [];
}

app.get('/api/lrclib/search', async (req, res) => {
  const { track_name, artist_name, album_name } = req.query;
  if (!track_name || !artist_name) {
    return res.status(400).json({ error: 'track_name and artist_name are required' });
  }
  const cacheKey = `${track_name}-${artist_name}-${album_name || ''}`;
  if (lyricsCache[cacheKey]) return res.json(lyricsCache[cacheKey]);
  try {
    const hits = await searchAllWithFallbacks(track_name, artist_name, album_name);
    if (hits.length === 0) return res.status(404).json({ error: 'No lyrics found' });
    const result = hits.map(hit => ({
      ...hit,
      parsedLyrics: hit.syncedLyrics ? parseLyrics(hit.syncedLyrics) : []
    }));
    lyricsCache[cacheKey] = result;
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});



// --- /api/genius/search ---
app.get('/api/genius/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });
  const token = getGeniusToken();
  if (!token) return res.status(500).json({ error: 'Genius access token not configured' });
  try {
    const json = await httpsGet(
      `https://api.genius.com/search?q=${encodeURIComponent(q)}`,
      { Authorization: `Bearer ${token}` }
    );
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- /api/genius/songs ---
app.get('/api/genius/songs', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q (song id) is required' });
  const token = getGeniusToken();
  if (!token) return res.status(500).json({ error: 'Genius access token not configured' });
  try {
    const json = await httpsGet(
      `https://api.genius.com/songs/${encodeURIComponent(q)}`,
      { Authorization: `Bearer ${token}` }
    );
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- /api/tidal/similar-tracks ---
// GET /api/tidal/similar-tracks?trackId=xxx&countryCode=DE
// Returns the raw Tidal similarTracks relationship response and caches track IDs
app.get('/api/tidal/similar-tracks', async (req, res) => {
  const { trackId, countryCode = 'DE' } = req.query;
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  try {
    const token = await getTidalToken();
    if (!token) return res.status(500).json({ error: 'Tidal credentials not configured' });
    const params = new URLSearchParams({ countryCode, include: 'similarTracks' });
    const json = await httpsGet(
      `https://openapi.tidal.com/v2/tracks/${encodeURIComponent(trackId)}/relationships/similarTracks?${params}`,
      { Authorization: `Bearer ${token}` }
    );
    if (json.data && Array.isArray(json.data)) {
      similarTracksCache[trackId] = json.data.map(t => t.id);
    }
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- /api/tidal/queue-similar-tracks ---
// POST /api/tidal/queue-similar-tracks?trackId=xxx&service=tidal
// Sends cached similar tracks to Volumio's queue via addToQueue
app.post('/api/tidal/queue-similar-tracks', async (req, res) => {
  const { trackId, service = 'tidal' } = req.query;
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  const trackIds = similarTracksCache[trackId];
  if (!trackIds || trackIds.length === 0) {
    return res.status(404).json({ error: 'No cached similar tracks for this trackId. Call /api/tidal/similar-tracks first.' });
  }
  const errors = [];
  for (const id of trackIds) {
    try {
      await new Promise((resolve, reject) => {
        const body = JSON.stringify({ service, uri: `tidal://song/${id}` });
        const reqOpts = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/v1/addToQueue',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const r = http.request(reqOpts, (response) => {
          response.resume();
          response.on('end', resolve);
        });
        r.on('error', reject);
        r.write(body);
        r.end();
      });
    } catch (e) {
      errors.push({ id, error: e.message });
    }
  }
  res.json({ queued: trackIds.length - errors.length, total: trackIds.length, errors });
});

// --- /api/tidal/album-tracks ---
// GET /api/tidal/album-tracks?trackId=xxx&countryCode=DE
// Returns the track list for the first album associated with the given track
app.get('/api/tidal/album-tracks', async (req, res) => {
  const { trackId, countryCode = 'DE' } = req.query;
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  try {
    const token = await getTidalToken();
    if (!token) return res.status(500).json({ error: 'Tidal credentials not configured' });
    const albumParams = new URLSearchParams({ countryCode, include: 'albums' });
    const albumRel = await httpsGet(
      `https://openapi.tidal.com/v2/tracks/${encodeURIComponent(trackId)}/relationships/albums?${albumParams}`,
      { Authorization: `Bearer ${token}` }
    );
    const albumId = albumRel.data && albumRel.data[0] && albumRel.data[0].id;
    if (!albumId) return res.status(404).json({ error: 'No album found for track' });
    const itemParams = new URLSearchParams({ countryCode, include: 'items' });
    const json = await httpsGet(
      `https://openapi.tidal.com/v2/albums/${encodeURIComponent(albumId)}/relationships/items?${itemParams}`,
      { Authorization: `Bearer ${token}` }
    );
    if (json.data && Array.isArray(json.data)) {
      albumTracksCache[trackId] = json.data.map(t => t.id);
    }
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- /api/tidal/queue-album-tracks ---
// POST /api/tidal/queue-album-tracks?trackId=xxx&service=tidal
// Sends cached album tracks to Volumio's queue via addToQueue
app.post('/api/tidal/queue-album-tracks', async (req, res) => {
  const { trackId, service = 'tidal' } = req.query;
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  const trackIds = albumTracksCache[trackId];
  if (!trackIds || trackIds.length === 0) {
    return res.status(404).json({ error: 'No cached album tracks for this trackId. Call /api/tidal/album-tracks first.' });
  }
  const errors = [];
  for (const id of trackIds) {
    try {
      await new Promise((resolve, reject) => {
        const body = JSON.stringify({ service, uri: `tidal://song/${id}` });
        const reqOpts = {
          hostname: 'localhost',
          port: 3000,
          path: '/api/v1/addToQueue',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const r = http.request(reqOpts, (response) => {
          response.resume();
          response.on('end', resolve);
        });
        r.on('error', reject);
        r.write(body);
        r.end();
      });
    } catch (e) {
      errors.push({ id, error: e.message });
    }
  }
  res.json({ queued: trackIds.length - errors.length, total: trackIds.length, errors });
});

// --- /api/clear-cache ---
app.post('/api/clear-cache', (req, res) => {
  Object.keys(lyricsCache).forEach(k => delete lyricsCache[k]);
  res.json({ success: true });
});

// --- Static files ---
app.use(express.static(DIST));

app.get('*', (req, res) => {
  const indexHtml = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    return res.status(503).send(`
      <html><body style="font-family:monospace;background:#111;color:#f90;padding:2rem">
        <h2>swish-ui: UI not built</h2>
        <p>The Vite build has not run yet. SSH into Volumio and run:</p>
        <pre style="background:#222;padding:1rem">cd $(cat /etc/swish.conf | grep -oP '(?<=WorkingDirectory=).*' 2>/dev/null || echo "/data/plugins/user_interface/swish-ui") && npm install && npm run build && sudo systemctl restart swish.service</pre>
        <p>Or check: <a href="/health" style="color:#0af">/health</a></p>
      </body></html>
    `);
  }
  res.sendFile(indexHtml);
});

const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] swish-ui listening on port ${PORT}`);
  console.log(`  dist built: ${fs.existsSync(path.join(DIST, 'index.html'))}`);
  console.log(`  node: ${process.version}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${PORT} is already in use. Another service may be running on this port.`);
    console.error(`  Check with: sudo lsof -i :${PORT}`);
    console.error(`  Free it with: sudo fuser -k ${PORT}/tcp`);
  } else {
    console.error('[ERROR] Server error:', err.message);
  }
  process.exit(1);
});
