import { useState, useEffect } from "react";

import SearchVolumio from "./components/SearchVolumio";
import TokenLogin from "./components/TokenLogin";
import PlayingNow from "./components/PlayingNow";
import LyricsNow from "./components/LyricsNow";
import GeniusNow from "./components/GeniusNow";
import QueueList from "./components/QueueList";
import ToastMessages from "./components/ToastMessages";
import WebSockets from './components/WebSockets';
import Shutdown from './components/Shutdown';

export default function HomeContent() {
  const searchParams = new URLSearchParams(window.location.search);

  // Read values from URL with defaults
  const initQueuePanel =
    searchParams.get("queuePanel") !== null
      ? searchParams.get("queuePanel") === "true"
      : true;

  const initLyricsPanel =
    searchParams.get("lyricsPanel") !== null
      ? searchParams.get("lyricsPanel") === "true"
      : false;

  const initLyricsSize = searchParams.get("lyricsSize") || "";

  const initGeniusPanel =
    searchParams.get("geniusPanel") !== null
      ? searchParams.get("geniusPanel") === "true"
      : false;

  const initGeniusSize = searchParams.get("geniusSize") || "";

  // Panels & UI states
  const [lyricsPanel, setLyricsPanel] = useState(initLyricsPanel);
  const [lyricsSize, setLyricsSize] = useState(initLyricsSize);
  const [geniusPanel, setGeniusPanel] = useState(initGeniusPanel);
  const [geniusSize, setGeniusSize] = useState(initGeniusSize);
  const [queuePanel, setQueuePanel] = useState(initQueuePanel);

  // Other states
  const [refresh, setRefresh] = useState(false);
  const [token, setToken] = useState(null);
  const [g_token, setGToken] = useState(null);
  const [socketCommand, setSocketCommand] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState(null);
  const [playingNow, setPlayingNow] = useState(null);
  const [responseState, setResponseState] = useState(null);
  const [responseQueue, setResponseQueue] = useState(null);
  const [clientIdTidal, setClientIdTidal] = useState(null);
  const [clientSecretTidal, setClientSecretTidal] = useState(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        setClientIdTidal(cfg.tidalClientId || null);
        setClientSecretTidal(cfg.tidalClientSecret || null);
      })
      .catch((err) => console.error('Failed to load config:', err));
  }, []);

  const localhost = `http://${window.location.hostname}`;
  const localAPI = window.location.origin;

  function volumioSocketCmd(command, value = null) {
    switch (command) {
      case "play":
      case "pause":
      case "unmute":
      case "mute":
      case "stop":
      case "prev":
      case "next":
      case "shutdown":
      case "reboot":
        setSocketCommand(command);
        break;
      case "seek":
        console.log('[volumioSocketCmd] seek value:', value);
        if (value !== null) setSocketCommand({ command: "seek", value });
        break;
      case "random":
        setSocketCommand({ command: "setRandom", value: { value } });
        break;
      case "repeat":
        setSocketCommand({ command: "setRepeat", value: { value } });
        break;
      case "volume":
        setSocketCommand({ command: "volume", value });
        break;
      case "getQueue":
        setSocketCommand(command);
        break;
      case "getState":
        setSocketCommand(command);
        break;
      case "addToFavourites":
        setSocketCommand({
          command: "addToFavourites",
          value: { uri: value.uri, title: value.title, service: value.service },
        });
        break;
      case "removeFromQueue":
        setSocketCommand({ command: "removeFromQueue", value });
        break;
      case "addToQueue":
        setSocketCommand({ command: "addToQueue", uri: value });
        break;
      case "moveQueue":
        setSocketCommand({ command: "moveQueue", from: value.from, to: value.to });
        break;
      default:
        console.error("Unknown command");
    }
  }

  return (
    <div className="whole">
      {clientIdTidal && clientSecretTidal && (
        <TokenLogin
          ClientId={clientIdTidal}
          setToken={setToken}
          ClientSecret={clientSecretTidal}
          service={"tidal"}
          source={"https://auth.tidal.com/v1/oauth2/token"}
          setMessage={setMessage}
        />
      )}

      <WebSockets
        url={localhost}
        socketCommand={socketCommand}
        setResponseState={setResponseState}
        setResponseQueue={setResponseQueue}
        setMessage={setMessage}
      />

      <main className="container">
        <ToastMessages message={message} />

        <Shutdown volumioSocketCmd={volumioSocketCmd}></Shutdown>
        <SearchVolumio
          setMessage={setMessage}
          refresh={refresh}
          localhost={localhost}
          setRefresh={setRefresh}
          searchTerm={searchTerm}
          current={responseState}
          volumioSocketCmd={volumioSocketCmd}
          responseQueue={responseQueue}
        />

        <QueueList
          onMove={volumioSocketCmd}
          refresh={refresh}
          setRefresh={setRefresh}
          token={token}
          response={responseQueue}
          playingNow={playingNow}
          localhost={localhost}
          setMessage={setMessage}
          volumioSocketCmd={volumioSocketCmd}
          queuePanel={queuePanel}
        />

        <PlayingNow
          g_token={g_token}
          refresh={refresh}
          setRefresh={setRefresh}
          token={token}
          setPlayingNow={setPlayingNow}
          localhost={localhost}
          volumioSocketCmd={volumioSocketCmd}
          response={responseState}
          setMessage={setMessage}
          localAPI={localAPI}
          setSearchTerm={setSearchTerm}
        />

        <LyricsNow
          response={responseState}
          setMessage={setMessage}
          setPlayingNow={setPlayingNow}
          lyricsPanel={lyricsPanel}
          lyricsSize={lyricsSize}
          volumioSocketCmd={volumioSocketCmd}
        />
        <GeniusNow
          response={responseState}
          setMessage={setMessage}
          g_token={g_token}
          localAPI={localAPI}
          setSearchTerm={setSearchTerm}
          lyricsPanel={geniusPanel}
          lyricsSize={geniusSize}
        />
      </main>
    </div>
  );
}
