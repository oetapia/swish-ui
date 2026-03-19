#!/bin/bash

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/lib/systemd/system/swish.service"
CONF_FILE="/etc/swish.conf"
NODE_BIN="$(which node)"

echo "Installing Swish UI plugin"
echo "Node: ${NODE_BIN}"
echo "Plugin dir: ${PLUGIN_DIR}"

# Install all dependencies (runtime + build tools)
echo "Installing dependencies"
cd "${PLUGIN_DIR}" && npm install
if [ $? -ne 0 ]; then
  echo "ERROR: npm install failed"
  echo "plugininstallend"
  exit 1
fi

# Build the Vite UI
echo "Building Swish UI"
cd "${PLUGIN_DIR}" && npm run build
if [ $? -ne 0 ]; then
  echo "ERROR: npm run build failed"
  echo "plugininstallend"
  exit 1
fi

# Write default port config
if [ ! -f "${CONF_FILE}" ]; then
  echo "Writing default port config"
  echo "PORT=3007" > "${CONF_FILE}"
fi
chown volumio:volumio "${CONF_FILE}"

# Create systemd service
echo "Creating Swish systemd service"
cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=Swish UI for Volumio
Wants=volumio.service
After=volumio.service

[Service]
Type=simple
User=volumio
Group=volumio
WorkingDirectory=${PLUGIN_DIR}
EnvironmentFile=${CONF_FILE}
ExecStart=${NODE_BIN} ${PLUGIN_DIR}/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

echo "plugininstallend"
