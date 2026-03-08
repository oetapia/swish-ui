

import React, { useState } from 'react';
import GeniusMetadata from './GeniusMetadata';


function GeniusNow({ response, setMessage, g_token, localAPI, setSearchTerm, lyricsPanel, lyricsSize }) {
  const [sizePanel, setSizePanel] = useState(lyricsSize);
  const [openPanel, setOpenPanel] = useState(lyricsPanel);

  return (
    <div className={`panel ${sizePanel} player-panel ${openPanel ? "open-panel" : "closed-panel"}`}>
      <div className="panel-control">
        <button className="button-open" onClick={() => setOpenPanel(!openPanel)}>
          <img src="/icons/icon-author-search.svg" alt="Toggle" className="toggle-panel" width={openPanel ? 18 : 24} height={openPanel ? 18 : 24} />
        </button>
      </div>

      <div className="contained">
        {openPanel && response && (
          <GeniusMetadata setMessage={setMessage} meta={response} g_token={g_token} localAPI={localAPI} setSearchTerm={setSearchTerm} />
        )}

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

export default GeniusNow;
