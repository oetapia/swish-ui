

import { useState,useEffect } from 'react'

import AddToQueue from './AddToQueue';


function SearchTidal({passedId, type, service, setMessage, localhost}) {


const [data, setData] = useState(null)
const [trackId, setTrackId] = useState(null)
const [fetchInitiated, setFetchInitiated] = useState(false); // New state to control fetch
const [queueReady, setQueueReady] = useState(false); // State to trigger queuing process


// Function to fetch similar tracks
async function searchSimilarTracks(trackId) {
	try {
		var endpoint
		if (type === "radio") {
			endpoint = `/api/tidal/similar-tracks?trackId=${encodeURIComponent(trackId)}`;
		} else if (type === "album") {
			endpoint = `/api/tidal/album-tracks?trackId=${encodeURIComponent(trackId)}`;
		}

		const response = await fetch(endpoint);

		if (!response.ok) {
			throw new Error(`Failed to fetch similar tracks: ${response.status}`);
		}

		const data = await response.json();

		// Extract similar track IDs
		const trackIds = data.data.map(track => track.id);

		// Store fetched track IDs
		setData(trackIds);
		setQueueReady(true); // Ready to queue after fetching
	} catch (error) {
		console.error("Error fetching similar tracks:", error);
	}
}

// Initiate fetch only on button click
const handleSearchClick = () => {
	setFetchInitiated(true);
};

// Effect to handle fetch initiation and reset `fetchInitiated` flag
useEffect(() => {
	if (fetchInitiated) {
		searchSimilarTracks(trackId);
		setFetchInitiated(false); // Reset to prevent repeated calls
	}
}, [fetchInitiated, trackId]);

// Effect to queue tracks once data is ready
useEffect(() => {
	if (queueReady && data) {
		data.forEach(trackId => {
			// Queue each track
			<AddToQueue localhost={localhost} setMessage={setMessage} title="Similar" service={service}  key={trackId} trackId={trackId} type="auto" />;
		});
		setQueueReady(false); // Reset queue readiness
		setData(null); // Clear data to prevent re-queuing
	}
}, [queueReady, data]);

// Update trackId when `passedId` changes, without auto-triggering fetch
useEffect(() => {
	setTrackId(passedId);
}, [passedId]);

return (
	<>
		
			<button 
				className="btn-basic" 
				title={type+" from track"}
				onClick={handleSearchClick} // Use handler to initiate fetch
			>
				{type==="radio"?
				<img
					src="/icons/icon-radio.svg"
					alt="Track from Radio"
					className="action"
					width={16}
					height={16}
				/>:
				<img
					src="/icons/icon-album-all.svg"
					alt="Tracks from Album"
					className="action"
					width={16}
					height={16}
				/>
				}
			</button>
		
		
		
			{data && queueReady ? (
				data.map(trackId => (
					<AddToQueue localhost={localhost} title={type} setMessage={setMessage} service={service} key={trackId} trackId={trackId} type="auto" />
				))
			) : (
				"" // Empty state or placeholder if needed
			)}
		
	</>
);
}

export default SearchTidal