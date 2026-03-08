import React from 'react';


function RemoveFromQueue({ localhost }) {
	// Set up a queue with an initial resolved promise


	async function volumioCmd(command) {
	  const url = `${localhost}/api/v1/commands/?cmd=${command}`;
	  try {
		const response = await fetch(url);
		if (!response.ok) {
		  throw new Error(`Response status: ${response.status}`);
		}
		const json = await response.json();
		console.log(json);
	  } catch (error) {
		console.error(error.message);
	  }
	}
  



		return (
			
			<button onClick={() => volumioCmd("clearQueue")}>
				<img
					src="/icons/icon-trash.svg"
					alt="Add to Queue"
					className="action"
					width={16}
					height={16}
				/>
			</button>
			
		);
	
}

export default RemoveFromQueue;
