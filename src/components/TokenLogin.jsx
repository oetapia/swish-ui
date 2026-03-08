

import React, { useEffect, useState } from 'react';

function TokenLogin({ ClientId, ClientSecret,setToken, source, service, setMessage}) {
  

  // Helper function to base64 encode client credentials
  const encodeCredentials = (clientId, clientSecret) => {
    return btoa(`${clientId}:${clientSecret}`);
  };

  const getToken = async () => {

    setMessage("Loading Token")

    try {
      const creds = encodeCredentials(ClientId, ClientSecret);
      const response = await fetch(source, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      const data = await response.json();

      if (response.ok) {
        const expiryTime = Date.now() + data.expires_in * 1000; // Convert expiry to milliseconds
        const tokenData = {
          token: data.access_token,
          expiry: expiryTime
        };

        // Store token data in localStorage
        localStorage.setItem('authToken'+service, JSON.stringify(tokenData));
        setToken(tokenData.token);
        setMessage("")
      } else {
        console.error('Failed to fetch token:', data);
      }
    } catch (error) {
      console.error('Error fetching token:', error);
    }
  };

  const checkToken = () => {
    const storedToken = localStorage.getItem('authToken'+service);

	console.log("stored",storedToken)

    if (storedToken) {
      const tokenData = JSON.parse(storedToken);

      // Check if the token has expired
      if (Date.now() < tokenData.expiry) {
        setToken(tokenData.token);
      } else {
        // Token has expired; fetch a new one
        getToken();
      }
    } else {
      // No token stored; fetch a new one
      getToken();
    }
  };

  useEffect(() => {
    checkToken();
  }, []);


}

export default TokenLogin;
