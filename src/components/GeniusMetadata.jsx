import React, { useEffect, useState, useRef } from 'react';
import AlbumArt from './AlbumArtGenius';

function renderDomChildren(children) {
  if (!children) return null;
  return children.map((child, i) => {
    if (!child) return null;
    if (typeof child === 'string') return child;
    if (child.tag === 'p') return <p key={i}>{renderDomChildren(child.children)}</p>;
    if (child.tag === 'a') return <a key={i} href={child.attributes?.href} target="_blank" rel="noreferrer">{renderDomChildren(child.children)}</a>;
    if (child.tag === 'em') return <em key={i}>{renderDomChildren(child.children)}</em>;
    if (child.tag === 'strong') return <strong key={i}>{renderDomChildren(child.children)}</strong>;
    if (child.children) return <span key={i}>{renderDomChildren(child.children)}</span>;
    return null;
  });
}

function GeniusMetadata({ setMessage, meta, g_token, localAPI, setSearchTerm }) {
  const [loading, setLoading] = useState(false);
  const [extraMeta, setExtraMeta] = useState('');
  const [songData, setSongData] = useState(null);
  const [GENIUS_TOKEN, setToken] = useState(g_token);
  const [cachedHits, setCachedHits] = useState([]);
  const [currentHitIndex, setCurrentHitIndex] = useState(0);

  const prevTitleRef = useRef('');
  const prevArtistRef = useRef('');

  const headers = {
    Authorization: `Bearer ${GENIUS_TOKEN}`,
  };

  function sanitizeString(inputString) {
    if (!inputString) return '';
    return inputString.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  }

  function sortHitsByScore(hits, title, artist) {
    const normalize = s =>
      s.toLowerCase()
        .replace(/\s*\(.*?\)\s*/g, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normTitle = normalize(title);
    const normArtist = normalize(artist);

    return [...hits]
      .map(hit => {
        const hitTitle = normalize(hit.result.title);
        const hitArtist = normalize(hit.result.primary_artist.name);
        let score = 0;

        if (hitArtist === normArtist) score += 3;
        else if (hitArtist.includes(normArtist) || normArtist.includes(hitArtist)) score += 1;

        const titleWords = normTitle.split(/\s+/).filter(w => w.length > 2);
        if (titleWords.length > 0) {
          const matches = titleWords.filter(w => hitTitle.includes(w)).length;
          score += (matches / titleWords.length) * 2;
        }

        return { hit, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ hit }) => hit);
  }

  async function searchTitle(track_data) {
    setMessage("Searching in Genius...")
    setLoading(true)
    var searchOptions = `${track_data.title} ${track_data.artist}`
    console.log("searching: ", searchOptions)

    const url = `/api/genius/search?q=${encodeURIComponent(searchOptions)}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const json = await response.json();
      console.log('Response from Genius API:', json);

      if (json.response) {
        if (json.response.hits && json.response.hits.length) {
          const sorted = sortHitsByScore(json.response.hits, track_data.title, track_data.artist);
          setCachedHits(sorted);
          setCurrentHitIndex(0);
          searchTracks(sorted[0].result.id);
          console.log('genius hits sorted:', sorted.map((h, i) => `[${i}] ${h.result.title} - ${h.result.primary_artist.name}`))
        }
        setMessage('Found match');
      } else {
        setMessage('No results found.');
      }
    } catch (error) {
      console.error('Error searching tracks:', error.message);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function searchTracks(searchTerm) {
    const message = `Searching for: ${searchTerm}`;
    setMessage(message);
    setLoading(true);
    console.log(message);

    setMessage("Searching matching tracks")

    const url = `/api/genius/songs?q=${encodeURIComponent(searchTerm)}`;

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const json = await response.json();
      console.log('Response from Genius API:', json);

      if (json.response) {
        const song = json.response.song;
        if (song) {
          const relationships = song.song_relationships
            ?.filter(item =>
              (item.type === "samples" || item.type === "sampled_in" ||
               item.type === "covered_by" || item.type === "cover_of") &&
              item.songs?.length > 0
            )
            .map(item => (
              <div key={item.type}>
                {item.type === "samples" && <h4>Samples</h4>}
                {item.type === "sampled_in" && <h4>Sampled in</h4>}
                {item.type === "cover_of" && <h4>Covers of</h4>}
                {item.type === "covered_by" && <h4>Covered by</h4>}
                {item.songs.map(child => (
                  <AlbumArt setSearchTerm={setSearchTerm} key={child.id} meta={child} variant={"search"} />
                ))}
              </div>
            ));

          setExtraMeta(relationships);
          setSongData(song);
          console.log("genius", json.response)
        }
        setMessage('');
      } else {
        setMessage('No results found.');
      }
    } catch (error) {
      console.error('Error searching tracks:', error.message);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    if (cachedHits.length < 2) return;
    const nextIndex = (currentHitIndex + 1) % cachedHits.length;
    setCurrentHitIndex(nextIndex);
    searchTracks(cachedHits[nextIndex].result.id);
  }

  useEffect(() => {
    if (
      meta &&
      (meta.title !== prevTitleRef.current ||
       meta.artist !== prevArtistRef.current) &&
      meta.title &&
      meta.artist
    ) {
      prevTitleRef.current = meta.title;
      prevArtistRef.current = meta.artist;
      searchTitle(meta);
    }
  }, [meta]);

  const youtubeLink = songData?.media?.find(m => m.provider === 'youtube')?.url;

  const featuredArtists = songData?.featured_artists?.length > 0
    ? songData.featured_artists.map(a => a.name).join(', ')
    : null;

  const customPerformances = songData?.custom_performances?.filter(p => p.artists?.length > 0) ?? [];

  const descriptionChildren = songData?.description?.dom?.children?.filter(c => c !== '') ?? [];

  return (
    <div className='scroll-list'>
      <div className=''>
        {loading && "Loading..."}
        {cachedHits.length > 1 && !loading && (
          <div className='genius-refresh'>
            <button onClick={handleRefresh}>Try next match</button>
            <span>{currentHitIndex + 1} / {cachedHits.length}</span>
          </div>
        )}

        {songData?.release_date_for_display && (
          <div className='genius-year'>{songData.release_date_for_display}</div>
        )}

        {extraMeta}

        {featuredArtists && (
          <div className='genius-featured'>
            <span className='genius-label'>Featuring: </span>{featuredArtists}
          </div>
        )}

        {customPerformances.map(p => (
          <div key={p.label} className='genius-performance'>
            <span className='genius-label'>{p.label}: </span>
            {p.artists.map(a => a.name).join(', ')}
          </div>
        ))}

        {youtubeLink && (
          <div className='genius-youtube'>
            <a href={youtubeLink} target="_blank" rel="noreferrer">Watch on YouTube</a>
          </div>
        )}

        {descriptionChildren.length > 0 && (
          <div className='genius-description'>
            {renderDomChildren(descriptionChildren)}
          </div>
        )}

      
      </div>
    </div>
  );
}

export default GeniusMetadata;
