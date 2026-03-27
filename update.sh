#!/bin/bash

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node)"

echo "Updating Swish UI plugin"
echo "Node: ${NODE_BIN}"
echo "Plugin dir: ${PLUGIN_DIR}"

# Install/update dependencies
echo "Installing dependencies"
cd "${PLUGIN_DIR}" && npm install
if [ $? -ne 0 ]; then
  echo "ERROR: npm install failed"
  echo "plugininstallend"
  exit 1
fi

# Rebuild the Vite UI
echo "Building Swish UI"
cd "${PLUGIN_DIR}" && npm run build
if [ $? -ne 0 ]; then
  echo "ERROR: npm run build failed"
  echo "plugininstallend"
  exit 1
fi

# Restart the service to pick up the new build
echo "Restarting Swish service"
sudo systemctl restart swish.service

echo "plugininstallend"
