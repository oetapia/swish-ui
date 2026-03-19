'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

const PORT = parseInt(process.env.PORT, 10) || 3007;
const DIST = path.join(__dirname, 'dist');
const RUNTIME_CONFIG = path.join(__dirname, 'runtime-config.json');

// In-memory lyrics cache
const lyricsCache = {};

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
