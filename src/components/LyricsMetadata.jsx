import React, { useEffect, useState, useRef } from 'react';

function LyricsMetadata({ setMessage, meta, volumioSocketCmd, autoScroll, setAutoScroll }) {
  const [loading, setLoading] = useState(false);
  const [lyricsParsed, setLyricsParsed] = useState([]);
  const [lyricsMeta, setLyricsMeta] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [currentLyricId, setCurrentLyricId] = useState(null);
  const [localSeek, setLocalSeek] = useState(null);

  // References for efficient updates
  const seekIntervalRef = useRef(null);
  const lastSocketUpdateRef = useRef(0);
  
 // Fetch lyrics from the Next.js API route
 async function fetchLyricsFromAPI(trackData) {
  const { title, artist, album, duration } = trackData;
  setLoading(true);
  setNotFound(false);
  setMessage("Searching for lyrics...");

  try {
    // Call the Next.js API route to get lyrics
    const res = await fetch(`/api/lrclib/search?track_name=${title}&artist_name=${artist}&album_name=${album}&duration=${duration}`);
    const data = await res.json();

    if (res.ok && data.trackName) {
      // Process the parsed lyrics returned from the API
      setLyricsParsed(data.parsedLyrics || []);
      setLyricsMeta(
        <ul className='lyrics'>
          {data.parsedLyrics.map((line) => (
            <li
              key={line.time}
              id={`lyric-${line.time}`}
              className={currentLyricId === line.time ? 'active' : ''}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const seconds = Math.floor(line.time / 1000);
                console.log('[lyric-click] time_ms:', line.time, 'seconds:', seconds, 'hasCmd:', !!volumioSocketCmd);
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
      setMessage('');
    } else {
      setNotFound(true);
      setLyricsParsed([]);
      setLyricsMeta('');
      setMessage('');
    }
  } catch (error) {
    setMessage(`Error: ${error.message}`);
  } finally {
    setLoading(false);
  }
}


  // Find the current and next lyrics based on time
  function findCurrentLyric(parsedLyrics, currentTimeMs) {
    let currentLyric = null;
    let nextLyric = null;
    
    // Find the current lyric (last one before currentTime)
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= currentTimeMs) {
        currentLyric = parsedLyrics[i];
      } else {
        nextLyric = parsedLyrics[i];
        break;
      }
    }
    
    if (currentLyric && currentLyric.time) {
      // Set the current lyric ID to trigger a re-render with the new active class
      setCurrentLyricId(currentLyric.time);
      
      return {
        current: currentLyric,
        next: nextLyric,
        progress: nextLyric ? 
          (currentTimeMs - currentLyric.time) / (nextLyric.time - currentLyric.time) : 
          0
      };
    }
    
    return null;
  }

  // Search for lyrics when track metadata changes
  useEffect(() => {
    if (meta.title) {
      fetchLyricsFromAPI(meta);
    }
  }, [meta.title, meta.artist, meta.album, meta.duration]);
  
  // Initialize local seek state from incoming meta data
  useEffect(() => {
    if (meta.seek !== undefined) {
      setLocalSeek(meta.seek);
      lastSocketUpdateRef.current = Date.now();
    }
    
    return () => {
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    };
  }, [meta.title, meta.artist]); // Reset when song changes

  // Set up interval for local seek updates - only when playing
  useEffect(() => {
    // Clear any existing interval first
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }

    // Only start the interval if we're playing
    if (meta.status === "play" && lyricsParsed.length > 0) {
      seekIntervalRef.current = setInterval(() => {
        setLocalSeek(prevSeek => {
          if (prevSeek === null) return meta.seek || 0;
          return prevSeek + 1000; // Add 1 second (1000ms)
        });
      }, 1000);
    }
    
    return () => {
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    };
  }, [meta.status, lyricsParsed.length]);

  // Use meta.seek for initial sync and periodic updates, but otherwise use localSeek
  useEffect(() => {
    // When we get a new seek value from parent (meta.seek), sync our local seek
    if (meta.seek !== undefined) {
      setLocalSeek(meta.seek);
      lastSocketUpdateRef.current = Date.now();
    }
  }, [meta.seek]);

  // Process lyrics based on our current position (either local or from server)
  useEffect(() => {
    // Use localSeek if available, otherwise fall back to meta.seek
    const currentSeek = localSeek !== null ? localSeek : meta.seek;
    
    if (currentSeek !== undefined && lyricsParsed.length > 0) {
      const currentLyricInfo = findCurrentLyric(lyricsParsed, currentSeek);
      
      if (currentLyricInfo && autoScroll) {
        const element = document.getElementById(`lyric-${currentLyricInfo.current.time}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [localSeek, lyricsParsed]);

  // Re-render the lyrics list when currentLyricId changes
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
                console.log('[lyric-click] time_ms:', line.time, 'seconds:', seconds, 'hasCmd:', !!volumioSocketCmd);
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

  return (
    <div className='scroll-list'>
      <div className='lyrics'>
        {loading && <div>Loading...</div>}
        {!loading && notFound && <div className="lyrics-not-found">No lyrics found</div>}
        {lyricsMeta}
      </div>
    </div>
  );
}

export default LyricsMetadata;