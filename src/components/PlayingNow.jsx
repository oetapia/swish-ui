

import React, { useState, useEffect, useRef } from 'react';
import ArtSingle from './ArtSingle';


function PlayingNow({ refresh, setRefresh, token, response, volumioSocketCmd, localhost, setPlayingNow, setMessage, g_token, localAPI, setSearchTerm }) {
  const [openPanel, setOpenPanel] = useState(true);
  const [sizePanel, setSizePanel] = useState("small");
  const [localSeek, setLocalSeek] = useState(null);
  const seekIntervalRef = useRef(null);
  const lastSocketUpdateRef = useRef(0);
  const socketUpdateIntervalRef = useRef(5000); // 5 seconds between socket updates

  function formatDuration(duration) {
    // Check if duration is in milliseconds (large number) and convert to seconds if needed
    const durationInSeconds = duration > 1000 ? Math.floor(duration / 1000) : duration;
    
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Initialize player state in useEffect, not during render
  useEffect(() => {
    // Only call this on mount or when dependencies change
    volumioSocketCmd(`getState`);
  }, []);

  // Update playingNow state in useEffect, not during render
  useEffect(() => {
    // This prevents the state update during parent render
    if (response) {
      setPlayingNow(response.position);
    }
  }, [response, setPlayingNow]);

  // Set up document title
  useEffect(() => {
    if (response && response.title) {
      document.title = `${response.title} - ${response.artist}`;
    }
  }, [response]);

  // Handle local seek updates and periodic socket refresh
  useEffect(() => {
    // Initialize local seek state from response
    if (response && response.seek !== undefined) {
      setLocalSeek(response.seek);
      lastSocketUpdateRef.current = Date.now();
    }

    // Clean up function
    return () => {
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    };
  }, [response]);

  // Set up the seek interval when playing
  useEffect(() => {
    if (response && response.status === "play") {
      // Clear any existing interval
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }

      // Update local seek value every second
      seekIntervalRef.current = setInterval(() => {
        setLocalSeek(prevSeek => {
          if (prevSeek === null) return null;
          
          // If playing, increment the seek time
          const newSeek = prevSeek + 1000; // Add 1 second (1000ms)
          return newSeek;
        });
      }, 1000);
    } else {
      // If not playing, clear the interval
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    }

    // Clean up
    return () => {
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
    };
  }, [response && response.status, volumioSocketCmd]);

  // NEW: Separate useEffect for server refresh
  useEffect(() => {
    // Only set up the refresh interval if we're playing
    if (response && response.status === "play") {
      const refreshInterval = setInterval(() => {
        const now = Date.now();
        if (now - lastSocketUpdateRef.current >= socketUpdateIntervalRef.current) {
          volumioSocketCmd(`getState`);
          lastSocketUpdateRef.current = now;
        }
      }, 1000); // Check every second if we need to refresh

      return () => clearInterval(refreshInterval);
    }
  }, [response && response.status, volumioSocketCmd]);

  // The seek display value - use localSeek if available, otherwise fall back to response.seek
  const displaySeek = localSeek !== null ? localSeek : (response && response.seek);
  const seekPercentage = response && response.duration 
    ? Math.min(Math.max((displaySeek / (response.duration * 1000)) * 100, 0), 100) 
    : 0;

  return (
    <div className={`panel ${sizePanel} player-panel ${openPanel ? "open-panel" : "closed-panel"}`}>
      <div className="panel-control">
        <button 
          className="button-open"
          onClick={() => setOpenPanel(!openPanel)}
        >
          {openPanel ? (
            <img src="/icons/icon-album.svg" alt="Toggle" className="toggle-panel" width={18} height={18} />
          ) : (
            <img src="/icons/icon-album.svg" alt="Toggle" className="toggle-panel" width={24} height={24} />
          )}
        </button>
      </div>

      <div className="contained">
        {response && (
          <>
            <ArtSingle localAPI={localAPI} g_token={g_token} setMessage={setMessage} meta={response} refresh={refresh} localhost={localhost} setRefresh={setRefresh} token={token} variant="single" setPlayingNow={setPlayingNow} setSearchTerm={setSearchTerm} duration={formatDuration(response.duration * 1000)}  />
            
            <div className="volume-buttons">
              {response.mute ?
                <button onClick={() => volumioSocketCmd("unmute")}>
                  <img src="/icons/icon-unmute.svg" alt="Unmute" className="action" width={16} height={16} />
                </button> :
                <button onClick={() => volumioSocketCmd("mute")}>
                  <img src="/icons/icon-mute.svg" alt="Mute" className="action" width={16} height={16} />
                </button>
              }
              <button onClick={() => volumioSocketCmd("volume", "-")}>
                <img src="/icons/icon-volume-down.svg" alt="Vol -" className="action" width={16} height={16} />
              </button>
           
              {response.volume && (
                <div className='volume-level'>
                  {response.volume}
                  <div className="progress-container overlay">
                    <div
                      className="progress-fill"
                      title={response.volume}
                      style={{ width: `${Math.min(Math.max(response.volume, 0), 100)}%` }}
                    >
                    </div>
                  </div>
                </div>
              )}

              <button onClick={() => volumioSocketCmd("volume", "+")}>
                <img src="/icons/icon-volume-up.svg" alt="Vol +" className="action" width={16} height={16} />
              </button>

              <button onClick={() => volumioSocketCmd("prev")}>
                <img src="/icons/icon-prev.svg" alt="Prev" className="action" width={24} height={32} />
              </button>
              {response.status === "play" ?
                <button onClick={() => volumioSocketCmd("pause")}>
                  <img src="/icons/icon-pause-circle.svg" alt="Pause" className="action" width={32} height={32} />
                </button> :
                <button onClick={() => volumioSocketCmd("play")}>
                  <img src="/icons/icon-play-circle.svg" alt="Play" className="action" width={32} height={32} />
                </button>
              }
              
              <button onClick={() => volumioSocketCmd("next")}>
                <img src="/icons/icon-next.svg" alt="Next" className="action" width={24} height={32} />
              </button>
              <button onClick={() => volumioSocketCmd("addToFavourites", response)}>
                <img src="/icons/icon-heart.svg" alt="Favorite" className="action" width={16} height={16} />
              </button>
            </div>
            
            {(response.seek !== undefined || localSeek !== null) && response.duration && (
              <div className='seek-level'>
                {formatDuration(displaySeek)} / {formatDuration(response.duration * 1000)}
                <div
                  className="progress-container overlay"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const fraction = (e.clientX - rect.left) / rect.width;
                    const seconds = Math.floor(fraction * response.duration);
                    console.log('[seek-bar] click fraction:', fraction, 'seconds:', seconds, 'duration:', response.duration);
                    setLocalSeek(seconds * 1000);
                    volumioSocketCmd("seek", seconds);
                  }}
                >
                  <div
                    className="progress-fill"
                    title={formatDuration(displaySeek)}
                    style={{ width: `${seekPercentage}%` }}
                  >
                  </div>
                </div>
              </div>
            )}


            {sizePanel?
              <button onClick={() => setSizePanel("")}>
                <img src="/icons/icon-expand.svg" alt="Collapse" className="action" width={24} height={24} />
              </button>:
                <button onClick={() => setSizePanel("small")}>
                  <img src="/icons/icon-collapse.svg" alt="Collapse" className="action" width={24} height={24} />
                </button>
                
              }
          </>
        )}
      </div>
    </div>
  );
}

export default PlayingNow;