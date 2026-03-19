import React, { useEffect, useState, useRef } from 'react';

function LyricsMetadata({ setMessage, meta, volumioSocketCmd, autoScroll, setAutoScroll }) {
  const [loading, setLoading] = useState(false);
  const [lyricsParsed, setLyricsParsed] = useState([]);
  const [lyricsMeta, setLyricsMeta] = useState('');
  const [plainLyrics, setPlainLyrics] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [currentLyricId, setCurrentLyricId] = useState(null);
  const [localSeek, setLocalSeek] = useState(null);
  const [cachedHits, setCachedHits] = useState([]);
  const [currentHitIndex, setCurrentHitIndex] = useState(0);

  const seekIntervalRef = useRef(null);
  const lastSocketUpdateRef = useRef(0);

  function applyHit(hit) {
    setNotFound(false);
    if (hit.parsedLyrics?.length > 0) {
      setPlainLyrics('');
      setLyricsParsed(hit.parsedLyrics);
    } else if (hit.plainLyrics) {
      setLyricsParsed([]);
      setPlainLyrics(hit.plainLyrics);
      setLyricsMeta('');
    } else {
      setLyricsParsed([]);
      setPlainLyrics('');
      setLyricsMeta('');
      setNotFound(true);
    }
  }

  function handleRefresh() {
    if (cachedHits.length < 2) return;
    const nextIndex = (currentHitIndex + 1) % cachedHits.length;
    setCurrentHitIndex(nextIndex);
    applyHit(cachedHits[nextIndex]);
  }

  async function fetchLyricsFromAPI(trackData) {
    const { title, artist, album, duration } = trackData;
    setLoading(true);
    setNotFound(false);
    setPlainLyrics('');
    setLyricsParsed([]);
    setLyricsMeta('');
    setCachedHits([]);
    setCurrentHitIndex(0);
    setMessage("Searching for lyrics...");

    try {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
        ...(album ? { album_name: album } : {}),
        ...(duration ? { duration } : {})
      });
      const res = await fetch(`/api/lrclib/search?${params}`);
      const data = await res.json();

      if (res.ok && Array.isArray(data) && data.length > 0) {
        setCachedHits(data);
        setCurrentHitIndex(0);
        applyHit(data[0]);
        setMessage('');
      } else {
        setNotFound(true);
        setMessage('');
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function findCurrentLyric(parsedLyrics, currentTimeMs) {
    let currentLyric = null;
    let nextLyric = null;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= currentTimeMs) {
        currentLyric = parsedLyrics[i];
      } else {
        nextLyric = parsedLyrics[i];
        break;
      }
    }
    if (currentLyric && currentLyric.time) {
      setCurrentLyricId(currentLyric.time);
      return {
        current: currentLyric,
        next: nextLyric,
        progress: nextLyric
          ? (currentTimeMs - currentLyric.time) / (nextLyric.time - currentLyric.time)
          : 0
      };
    }
    return null;
  }

  useEffect(() => {
    if (meta.title) fetchLyricsFromAPI(meta);
  }, [meta.title, meta.artist, meta.album, meta.duration]);

  useEffect(() => {
    if (meta.seek !== undefined) {
      setLocalSeek(meta.seek);
      lastSocketUpdateRef.current = Date.now();
    }
    return () => { if (seekIntervalRef.current) clearInterval(seekIntervalRef.current); };
  }, [meta.title, meta.artist]);

  useEffect(() => {
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    if (meta.status === "play" && lyricsParsed.length > 0) {
      seekIntervalRef.current = setInterval(() => {
        setLocalSeek(prevSeek => {
          if (prevSeek === null) return meta.seek || 0;
          return prevSeek + 1000;
        });
      }, 1000);
    }
    return () => { if (seekIntervalRef.current) clearInterval(seekIntervalRef.current); };
  }, [meta.status, lyricsParsed.length]);

  useEffect(() => {
    if (meta.seek !== undefined) {
      setLocalSeek(meta.seek);
      lastSocketUpdateRef.current = Date.now();
    }
  }, [meta.seek]);

  useEffect(() => {
    const currentSeek = localSeek !== null ? localSeek : meta.seek;
    if (currentSeek !== undefined && lyricsParsed.length > 0) {
      const currentLyricInfo = findCurrentLyric(lyricsParsed, currentSeek);
      if (currentLyricInfo && autoScroll) {
        const element = document.getElementById(`lyric-${currentLyricInfo.current.time}`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [localSeek, lyricsParsed]);

  useEffect(() => {
    if (lyricsParsed.length > 0) {
      setLyricsMeta(
        <ul className='lyrics'>
          {lyricsParsed.map((line) => (
            <li
              key={line.time}
              id={`lyric-${line.time}`}
              className={currentLyricId === line.time ? 'active' : ''}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const seconds = Math.floor(line.time / 1000);
                setLocalSeek(line.time);
                setAutoScroll(true);
                if (volumioSocketCmd) volumioSocketCmd("seek", seconds);
              }}
            >
              {line.text}
            </li>
          ))}
        </ul>
      );
    }
  }, [currentLyricId, lyricsParsed]);

  const currentHit = cachedHits[currentHitIndex];

  return (
    <div className='scroll-list'>
      <div className='lyrics'>
        {loading && <div>Loading...</div>}
        {!loading && cachedHits.length > 1 && (
          <div className='genius-refresh'>
            <button onClick={handleRefresh}>Try next match</button>
            <span>{currentHitIndex + 1} / {cachedHits.length}</span>
            {currentHit && (
              <span className='lyrics-hit-info'>
                {currentHit.albumName}{currentHit.syncedLyrics ? '' : ' · plain'}
              </span>
            )}
          </div>
        )}
        {!loading && notFound && <div className="lyrics-not-found">No lyrics found</div>}
        {lyricsMeta}
        {!lyricsParsed.length && plainLyrics && (
          <ul className='lyrics plain'>
            {plainLyrics.split('\n').map((line, i) => (
              <li key={i}>{line || '\u00A0'}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default LyricsMetadata;
