

import React, { useState, useEffect } from 'react';
import LyricsMetadata from './LyricsMetadata';


function LyricsNow({ response, setMessage, setPlayingNow, lyricsPanel, lyricsSize, volumioSocketCmd }) {
  const [sizePanel, setSizePanel] = useState(lyricsSize);
  const [openPanel, setOpenPanel] = useState(lyricsPanel);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (response && response.title) {
      document.title = `${response.title} - ${response.artist}`;
    }
  }, [response]);

  return (
    <div className={`panel ${sizePanel} player-panel ${openPanel ? "open-panel" : "closed-panel"}`}>
      <div className="panel-control">
        <button className="button-open" onClick={() => setOpenPanel(!openPanel)}>
          <img src="/icons/icon-lyrics.svg" alt="Toggle" className="toggle-panel" width={openPanel ? 18 : 24} height={openPanel ? 18 : 24} />
        </button>
      </div>

      <div className="contained">
        {openPanel && response && (
          <LyricsMetadata setMessage={setMessage} meta={response} volumioSocketCmd={volumioSocketCmd} autoScroll={autoScroll} setAutoScroll={setAutoScroll} />
        )}

        <button
          className={`autoscroll-toggle ${autoScroll ? 'active' : ''}`}
          onClick={() => setAutoScroll(prev => !prev)}
          title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        >
          {autoScroll ? 
            <img src="/icons/icon-auto-pause.svg" alt="Pause Scroll" className="action" width={24} height={24} />
            : 
              <img src="/icons/icon-auto-play.svg" alt="Play Scroll" className="action" width={24} height={24} />
            }
        </button>

        {sizePanel ? (
          <button onClick={() => setSizePanel("")}>
            <img src="/icons/icon-collapse.svg" alt="Collapse" className="action" width={24} height={24} />
          </button>
        ) : (
          <button onClick={() => setSizePanel("large")}>
            <img src="/icons/icon-expand.svg" alt="Expand" className="action" width={24} height={24} />
          </button>
        )}
      </div>
    </div>
  );
}

export default LyricsNow;
