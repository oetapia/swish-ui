import React from 'react'

import { useState } from "react";

function Shutdown({volumioSocketCmd, shutdownPanel}) {

    const [openPanel, setOpenPanel] = useState(shutdownPanel);

    async function eraseCache() {
      try {
        await fetch('/api/clear-cache', { method: 'POST' });
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }
    

  return (
    <div>
        <div className={`panel  player-panel ${openPanel ? "open-panel" : "closed-panel"}`}>
            <div className="panel-control">
              <button 
                      className="button-open"
                      onClick={() => setOpenPanel(!openPanel)}
                    >
                      {openPanel ? (
                        <img src="/icons/icon-shutdown.svg" alt="Toggle" className="toggle-panel" width={18} height={18} />
                      ) : (
                        <img src="/icons/icon-shutdown.svg" alt="Toggle" className="toggle-panel" width={18} height={18} />
                      )}
                </button>
            </div>
            <div className="contained">
                <button 
                  className="button"
                  onClick={() => volumioSocketCmd("shutdown")}
                >
           <img src="/icons/icon-shutdown.svg" alt="Shutdown" className="toggle-panel" width={24} height={24} />
            
                </button>
                <button 
                  className="button"
                  onClick={() => volumioSocketCmd("reboot")}
                >
            <img src="/icons/icon-restart.svg" alt="Restart" className="toggle-panel" width={24} height={24} />
                </button>
                <button 
                  className="button"
                  onClick={eraseCache}
                >
            <img src="/icons/icon-erase-cache.svg" alt="Erase Cache" className="toggle-panel" width={24} height={24} />
                </button>
        </div>   
           </div>
    </div>
  )
}

export default Shutdown