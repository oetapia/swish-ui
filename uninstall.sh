#!/bin/bash

echo "Uninstalling Swish UI plugin"

sudo systemctl stop swish.service 2>/dev/null || true
sudo systemctl disable swish.service 2>/dev/null || true

if [ -f "/lib/systemd/system/swish.service" ]; then
  sudo rm /lib/systemd/system/swish.service
  sudo systemctl daemon-reload
fi

if [ -f "/etc/swish.conf" ]; then
  sudo rm /etc/swish.conf
fi

echo "Done"
echo "pluginuninstallend"
