import React from 'react';


function PlayFromQueue({ localhost,index, setMessage }) {
	// Set up a queue with an initial resolved promise


	async function volumioCmd(command,number) {
	//console.log("inside play",command,number)
	  const url = `${localhost}/api/v1/commands/?cmd=${command}&N=${number}`;
	  //console.log("inside play",url)
	  setMessage("Sent "+command+" "+number)
	  try {
		const response = await fetch(url);
		if (!response.ok) {
		  throw new Error(`Response status: ${response.status}`);
		}
		const json = await response.json();
		console.log(json);
		setMessage("")
	  } catch (error) {
		console.error(error.message);
	  }
	}
  



		return (
			
			<button className="overlay btn" onClick={()=>volumioCmd("play",index)}>
			<img
			src="/icons/icon-play-circle.svg"
			alt="Play"
			className="action"
			width={32}
			height={32}
			/>
		  </button>
			
		);
	
}

export default PlayFromQueue;
