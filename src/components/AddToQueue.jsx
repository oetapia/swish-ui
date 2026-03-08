import React from 'react';


function AddToQueue({ trackId, sourceUrl, type, variant, service, setMessage, title, localhost, current, volumioSocketCmd, responseQueue }) {
	// Set up a queue with an initial resolved promise
	let queue = Promise.resolve();

	async function addToEnd() {
		var message = "Adding to queue: " + title;
		setMessage(message);
		const url = localhost + "/api/v1/addToQueue";
		const data = {
			"service": service ? service : "mpd",
			"uri": sourceUrl ? sourceUrl : `tidal://song/${trackId}`
		};

		await new Promise(resolve => setTimeout(resolve, 500));

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			throw new Error(`Response status: ${response.status}`);
		}

		await response.json();
		setMessage(null);
	}

	// This function adds each request to the queue
	function queueTrackOnVolumio() {
		queue = queue.then(async () => {
			try {
				await addToEnd();
			} catch (error) {
				console.error("Error adding track to Volumio queue:", error.message);
			}
		});
	}

	async function queueTrackNextOnVolumio() {
		if (!current || current.position == null || !volumioSocketCmd) {
			return queueTrackOnVolumio();
		}

		try {
			const queueLength = responseQueue?.length ?? 0;

			// Add track to end of queue
			await addToEnd();

			// Move from end to right after the current track
			const targetPosition = current.position + 1;
			if (queueLength > targetPosition) {
				volumioSocketCmd("moveQueue", { from: queueLength, to: targetPosition });
			}
		} catch (error) {
			console.error("Error queuing next track:", error.message);
			setMessage(null);
		}
	}

	// Automatically queue track if type is "auto"
	if (type === "auto") {
		queueTrackOnVolumio();
	} else {
		return (
			<>
				<button onClick={queueTrackNextOnVolumio} title="Play next">
					{variant === "tracks" ?
						<img src="/icons/icon-single-next.svg" alt="Play Next" className="action" width={16} height={16} /> :
						<img src="/icons/icon-plus-next.svg" alt="Play Next" className="action" width={16} height={16} />
					}
				</button>
				<button onClick={queueTrackOnVolumio} title="Add to queue">
					{variant === "tracks" ?
						<img src="/icons/icon-plus-single.svg" alt="Add to Queue" className="action" width={16} height={16} /> :
						<img src="/icons/icon-plus-multi.svg" alt="Add to Queue" className="action" width={16} height={16} />
					}
				</button>
			</>
		);
	}
}

export default AddToQueue;
