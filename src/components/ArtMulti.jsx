import React, { useEffect, useState } from 'react'

import PlayFromQueue from './PlayFromQueue';

function ArtMulti({meta,  index, variant, volumioSocketCmd, localhost, setMessage}) {

	const [albumArt, setalbumArt] = useState("")

const defaultImageUrl = '/default-cover.png'; // Replace with the path to your default image



  function formatDuration(duration) {
	const minutes = Math.floor(duration / 60);
	const seconds = duration % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`; // Ensures two digits for seconds
  }

 
  function checkArt(source) {

	//console.log("source",source)
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
  



	return (
	  <div className={"album-list"} key={meta.uri} >
  
		  <div className="album-container">
		  		{albumArt}
				<PlayFromQueue 
					index={index} 
					localhost={localhost}
					setMessage={setMessage}
				
				/>
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
				<span className="item">
					{meta.trackType}
				</span>
				{meta.samplerate?
				<span className="item">
					{meta.samplerate}
				</span>:''
				}
				<span className="item">
					{formatDuration(meta.duration)}
				</span>
				
			</p>

		
		  </div>
		  <div className="buttons">

		  <button onClick={() => volumioSocketCmd("removeFromQueue",{value: index})}>
				<img
					src="/icons/icon-trash.svg"
					alt="Add to Queue"
					className="action"
					width={16}
					height={16}
				/>
			</button>

		  </div>

		
	  </div>
  
	)


  
}

export default ArtMulti