import React, { useEffect, useState } from 'react'
import AddToQueue from './AddToQueue';
import QueryAlbum from './QueryAlbum';

function AlbumArt({meta, type, index, refresh, setRefresh, variant, localhost, setMessage, current, volumioSocketCmd, responseQueue}) {

	const [albumArt, setalbumArt] = useState("")

const defaultImageUrl = '/default-cover.png'; // Replace with the path to your default image

	

  function formatDuration(duration) {
	const minutes = Math.floor(duration / 60);
	const seconds = duration % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`; // Ensures two digits for seconds
  }



  function checkArt(source) {

	console.log("source",source,localhost)
	var structure	

	if (source && source.includes("/albumart?")) {

	structure = <img
	className={`cover ${variant}`}
	src={localhost+source || defaultImageUrl} // Use meta.image or fallback
	onError={(e) => { e.target.src = defaultImageUrl; }} // Fallback if image fails to load
	alt={meta.title || "Default Album Art"}
/>

	}

	else {

		structure = <img
		className={`cover ${variant}`}
		src={source || defaultImageUrl} // Use meta.image or fallback
		onError={(e) => { e.target.src = defaultImageUrl; }} // Fallback if image fails to load
		alt={meta.title || "Default Album Art"}
	/>

	}

	return setalbumArt(structure)
  }

  useEffect(() => {
	checkArt(meta.albumart)
  
  }, [meta])
  
  


  if (type==="search"){

	  return (
		<>
		<li className={"album-list"} key={meta.uri+index} >
	
			<div className="album-container">

			{albumArt}
		
			</div>
	
			<div className="meta">
				<p className="primary">
					<span className="title">
					{meta.title?meta.title:meta.name}
					</span>
				</p>
				
				<p className="secondary">
				<span className="artist">
					{meta.artist}
				</span>
				</p>
				<p className="secondary">
				<span className="album">
					{meta.album}
				</span> 
				</p>
				<p className="extra">
				{
					meta.trackType ?
					<span className="item">
					  {meta.trackType}
				  </span>:''
				}
				  
				  {meta.samplerate?
				  <span className="item">
					  {meta.samplerate}
				  </span>:''
				  }

				{
				meta.duration?
				<span className="item">
					  {formatDuration(meta.duration)}
				  </span>:''
				}
				  
			  </p>

				
			</div>
			  <AddToQueue localhost={localhost} title={meta.name||meta.title} setMessage={setMessage} sourceUrl={meta.uri} service={meta.service} refresh={refresh} variant={variant} setRefresh={setRefresh} current={current} volumioSocketCmd={volumioSocketCmd} responseQueue={responseQueue} ></AddToQueue>
			
		</li>
		<QueryAlbum variant={variant} meta={meta} localhost={localhost} refresh={refresh} setRefresh={setRefresh} setMessage={setMessage} current={current} volumioSocketCmd={volumioSocketCmd} responseQueue={responseQueue} />
		</>
	  )
  }

 
}

export default AlbumArt