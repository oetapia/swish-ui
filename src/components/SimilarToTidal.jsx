

import { useState,useEffect } from 'react'

import AddToQueue from './AddToQueue';


function SearchTidal({passedId,  token, type, service, setMessage, localhost, current}) {
	

const [data, setData] = useState(null)
const [trackId, setTrackId] = useState(null)
const [fetchInitiated, setFetchInitiated] = useState(false); // New state to control fetch
const [queueReady, setQueueReady] = useState(false); // State to trigger queuing process
const [TIDAL_ACCESS_TOKEN,setToken] = useState(token)


var TIDAL_API_BASE_URL = "https://openapi.tidal.com/v2"
var COUNTRY_CODE = "DE"

// Function to fetch similar tracks
async function searchSimilarTracks(trackId) {

	var url
	var params

	if (type==="radio") {
		
		 url = `${TIDAL_API_BASE_URL}/tracks/${trackId}/relationships/similarTracks`
		 params = new URLSearchParams({
			countryCode: COUNTRY_CODE,
			include: "similarTracks"
		});
	}

	else if (type==="album") {
		
		 url = `${TIDAL_API_BASE_URL}/tracks/${trackId}/relationships/albums`;
		 params = new URLSearchParams({
			countryCode: COUNTRY_CODE,
			include: "albums"
		});
	}


	const headers = {
		"Authorization": `Bearer ${TIDAL_ACCESS_TOKEN}`
	};

	try {
		const response = await fetch(`${url}?${params}`, { headers });

		if (!response.ok) {
			throw new Error(`Failed to fetch similar tracks: ${response.status}`);
		}

		var data

		if (type==="radio") {
		 data = await response.json();
		}

		if (type === "album") {

			var middata = await response.json();
			console.log("album", middata)
			// Fetch tracks for the album
			const albumId = middata.data[0]?.id;
			if (albumId) {
			  const albumUrl = `${TIDAL_API_BASE_URL}/albums/${albumId}/relationships/items`;
			  const albumParams = new URLSearchParams({
				countryCode: COUNTRY_CODE,
				include: "items"
			  });
	
			  const albumResponse = await fetch(`${albumUrl}?${albumParams}`, { headers });
	
			  if (!albumResponse.ok) {
				throw new Error(`Failed to fetch album tracks: ${albumResponse.status}`);
			  }
	
			  data = await albumResponse.json();
			} else {
			  console.error("No album data found.");
			  return;
			}
		  }
		
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