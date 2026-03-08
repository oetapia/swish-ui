import React, { useEffect, useState } from 'react'


function AlbumArt({meta, type, index, refresh, setRefresh, variant,localhost, setMessage, setSearchTerm}) {

	const [albumArt, setalbumArt] = useState("")

const defaultImageUrl = '/default-cover.png'; // Replace with the path to your default image

	// Improved sanitization function - less aggressive
	function sanitizeString(inputString) {
	if (!inputString) return '';
	
	// Only remove content in parentheses, keep everything else
	return inputString.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  }

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
	checkArt(meta.header_image_thumbnail_url)
  
  }, [meta])
  
  

	  return (
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
					{meta.artist_names}
				</span>
				</p>
				<p className="secondary">
				<span className="album">
					{meta.album}
				</span> 
				</p>
				<p className="extra">
				  
				  {meta.release_date_for_display?
				  <span className="item">
					  {meta.release_date_for_display}
				  </span>:''
				  }

				{
				meta.id?
				<span className="item">
					  {formatDuration(meta.id)}
				  </span>:''
				}
				  
			  </p>


				
			</div>
			  
<button 
				className="btn-basic" 
				title={" from track"}
				onClick={()=>setSearchTerm(sanitizeString(meta.artist_names)+" "+sanitizeString(meta.title))} // Use handler to initiate fetch
			>
				
				<img
					src="/icons/icon-search.svg"
					alt="Track from Radio"
					className="action"
					width={16}
					height={16}
				/>
				
				
			</button>
	
		</li>
	
	  )
  }

 


export default AlbumArt