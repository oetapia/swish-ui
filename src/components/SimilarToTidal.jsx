import { useState } from 'react'

function SearchTidal({ passedId, type, service, setMessage }) {

  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const endpoint = type === 'radio'
      ? `/api/tidal/queue-similar-tracks?trackId=${encodeURIComponent(passedId)}&countryCode=DE&service=${service}`
      : `/api/tidal/queue-album-tracks?trackId=${encodeURIComponent(passedId)}&countryCode=DE&service=${service}`;
    try {
      setMessage(type === 'radio' ? 'Queuing similar tracks...' : 'Queuing album tracks...');
      const response = await fetch(endpoint, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || response.status);
      setMessage(`Queued ${data.queued} tracks`);
    } catch (error) {
      console.error('Error queuing tracks:', error);
      setMessage('Error queuing tracks');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  return (
    <button
      className="btn-basic"
      title={type + ' from track'}
      onClick={handleClick}
      disabled={loading}
    >
      {type === 'radio' ?
        <img src="/icons/icon-radio.svg" alt="Track from Radio" className="action" width={16} height={16} /> :
        <img src="/icons/icon-album-all.svg" alt="Tracks from Album" className="action" width={16} height={16} />
      }
    </button>
  );
}

export default SearchTidal
