import React from 'react'

function ToastMessages({message}) {
  return (
	<div className='toast'>
		<p className={message?" active ":""}>
			{message}
		</p>
	</div>
  )
}

export default ToastMessages