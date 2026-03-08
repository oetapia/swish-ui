// WebSockets.js

import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const WebSockets = ({ url, socketCommand, setResponseState, setResponseQueue, setMessage }) => {
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    if (!socket) {
      const socketConnection = io(url, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
  
      socketConnection.on('connect', () => {
        console.log('WebSocket connected');
      });
  
      socketConnection.on('connect_error', (error) => {
        console.error('Connection error:', error);
      });
  
      socketConnection.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });
  
      socketConnection.on('pushQueue', (data) => {
        setResponseQueue(data);
      });
  
      socketConnection.on('pushState', (data) => {
        setResponseState(data);
      });
  
      setSocket(socketConnection);
  
      return () => {
        console.log('Cleaning up WebSocket connection...');
        socketConnection.disconnect();
      };
    }
  }, [url]);

  // Send command when socketCommand changes
  useEffect(() => {
    //setMessage(JSON.stringify(socketCommand))
    if (socket && socketCommand) {
      if (typeof socketCommand === 'object') {
        if (socketCommand.command === "moveQueue") {
          // Ensure we only send the necessary data
          socket.emit("moveQueue", { from: socketCommand.from, to: socketCommand.to });
        } else {
          socket.emit(socketCommand.command, socketCommand.value);
        }
      } else {
        
        socket.emit(socketCommand);
        //setMessage("")
      }
      console.log('[WebSockets] emitted:', JSON.stringify(socketCommand));
    }
  }, [socket, socketCommand]);

  //return <div>WebSocket Connection Status</div>;
};

export default WebSockets;
