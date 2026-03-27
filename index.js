'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');

const id = 'swish: ';
const confFile = '/etc/swish.conf';
const serviceFile = '/lib/systemd/system/swish.service';
const runtimeConfigFile = path.join(__dirname, 'runtime-config.json');

module.exports = ControllerSwish;

function ControllerSwish(context) {
  const self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.context.logger;
  self.configManager = self.context.configManager;
}

ControllerSwish.prototype.onVolumioStart = function () {
  const self = this;
  const configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

ControllerSwish.prototype.onStart = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.loadI18nStrings();
  const serviceExists = require('fs').existsSync(serviceFile);
  const setup = serviceExists
    ? self.writePortConf(self.config.get('port')).then(self.writeRuntimeConfig.bind(self))
    : self.writePortConf(self.config.get('port'))
        .then(self.writeRuntimeConfig.bind(self))
        .then(self.writeServiceFile.bind(self))
        .then(self.systemctl.bind(self, 'daemon-reload'));
  setup
    .then(self.systemctl.bind(self, 'start swish.service'))
    .then(function () {
      self.logger.info(id + 'Swish UI started on port ' + self.config.get('port'));
    })
    .fail(function (err) {
      self.logger.error(id + 'Failed to start swish.service: ' + err);
    })
    .fin(function () {
      defer.resolve();
    });

  return defer.promise;
};

ControllerSwish.prototype.onStop = function () {
  const self = this;
  const defer = libQ.defer();
  self.systemctl('stop swish.service').fin(function () { defer.resolve(); });
  return defer.promise;
};

ControllerSwish.prototype.onRestart = function () {
  const self = this;
  self.onStop().then(self.onStart.bind(self));
};

// Configuration ---------------------------------------------------------------------------------

ControllerSwish.prototype.getUIConfig = function () {
  const self = this;
  const defer = libQ.defer();
  const langCode = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(
    path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json')
  )
    .then(function (uiconf) {
      uiconf.sections[0].content[0].value = self.config.get('port');
      uiconf.sections[1].content[0].value = self.config.get('tidalClientId');
      uiconf.sections[1].content[1].value = self.config.get('tidalClientSecret');
      uiconf.sections[2].content[0].value = self.config.get('geniusClientId');
      uiconf.sections[2].content[1].value = self.config.get('geniusClientSecret');
      uiconf.sections[2].content[2].value = self.config.get('geniusAccessToken');
      defer.resolve(uiconf);
    })
    .fail(function (e) {
      self.logger.error(id + 'Could not fetch UI configuration: ' + e);
      defer.reject(new Error());
    });

  return defer.promise;
};

ControllerSwish.prototype.getConfigurationFiles = function () { return ['config.json']; };
ControllerSwish.prototype.setUIConfig = function () {};
ControllerSwish.prototype.getConf = function (varName) { return this.config.get(varName); };
ControllerSwish.prototype.setConf = function (varName, varValue) { this.config.set(varName, varValue); };

ControllerSwish.prototype.saveConf = function (confData) {
  const self = this;
  const port = parseInt(confData.port, 10);
  if (isNaN(port) || port < 1024 || port > 65535) {
    self.commandRouter.pushToastMessage('error', 'Swish', 'Port must be a number between 1024 and 65535');
    return;
  }
  const portChanged = self.config.get('port') !== port;
  self.config.set('port', port);
  self.writePortConf(port)
    .then(self.writeRuntimeConfig.bind(self))
    .then(function () {
      if (portChanged) return self.systemctl('daemon-reload').then(self.systemctl.bind(self, 'restart swish.service'));
    })
    .then(function () {
      self.commandRouter.pushToastMessage('success', 'Swish', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
    })
    .fail(function (err) { self.logger.error(id + 'Failed to save config: ' + err); });
};

ControllerSwish.prototype.saveTidalConf = function (confData) {
  const self = this;
  self.config.set('tidalClientId', confData.tidalClientId || '');
  self.config.set('tidalClientSecret', confData.tidalClientSecret || '');
  self.writeRuntimeConfig()
    .then(function () {
      self.commandRouter.pushToastMessage('success', 'Swish', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
    })
    .fail(function (err) { self.logger.error(id + 'Failed to save Tidal config: ' + err); });
};

ControllerSwish.prototype.saveGeniusConf = function (confData) {
  const self = this;
  self.config.set('geniusClientId', confData.geniusClientId || '');
  self.config.set('geniusClientSecret', confData.geniusClientSecret || '');
  self.config.set('geniusAccessToken', confData.geniusAccessToken || '');
  self.writeRuntimeConfig()
    .then(function () {
      self.commandRouter.pushToastMessage('success', 'Swish', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
    })
    .fail(function (err) { self.logger.error(id + 'Failed to save Genius config: ' + err); });
};

// Helpers ---------------------------------------------------------------------------------------

ControllerSwish.prototype.writeRuntimeConfig = function () {
  const self = this;
  const defer = libQ.defer();
  const runtimeConfig = {
    tidalClientId: self.config.get('tidalClientId') || '',
    tidalClientSecret: self.config.get('tidalClientSecret') || '',
    geniusClientId: self.config.get('geniusClientId') || '',
    geniusClientSecret: self.config.get('geniusClientSecret') || '',
    geniusAccessToken: self.config.get('geniusAccessToken') || ''
  };
  fs.outputJson(runtimeConfigFile, runtimeConfig, function (err) {
    if (err) { self.logger.error(id + 'Error writing runtime config: ' + err); defer.reject(err); }
    else { self.logger.info(id + 'Runtime config written.'); defer.resolve(); }
  });
  return defer.promise;
};

ControllerSwish.prototype.writeServiceFile = function () {
  const self = this;
  const defer = libQ.defer();
  const nodeBin = process.execPath;
  const serverScript = path.join(__dirname, 'server.js');
  const serviceContent = [
    '[Unit]',
    'Description=Swish UI for Volumio',
    'Wants=volumio.service',
    'After=volumio.service',
    '',
    '[Service]',
    'Type=simple',
    'User=volumio',
    'Group=volumio',
    'WorkingDirectory=' + __dirname,
    'EnvironmentFile=' + confFile,
    'ExecStart=' + nodeBin + ' ' + serverScript,
    'Restart=on-failure',
    'RestartSec=5',
    'StandardOutput=journal',
    'StandardError=journal',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    ''
  ].join('\n');
  const tmpFile = '/tmp/swish.service.tmp';
  fs.outputFile(tmpFile, serviceContent, function (err) {
    if (err) { self.logger.error(id + 'Error writing temp service file: ' + err); defer.reject(err); return; }
    exec('/usr/bin/sudo /bin/cp ' + tmpFile + ' ' + serviceFile, { uid: 1000, gid: 1000 }, function (error) {
      if (error) { self.logger.error(id + 'Error installing service file: ' + error); defer.reject(error); }
      else { self.logger.info(id + 'Service file written.'); defer.resolve(); }
    });
  });
  return defer.promise;
};

ControllerSwish.prototype.writePortConf = function (port) {
  const self = this;
  const defer = libQ.defer();
  fs.outputFile(confFile, 'PORT=' + port + '\n', function (err) {
    if (err) { self.logger.error(id + 'Error writing port config: ' + err); defer.reject(err); }
    else { self.logger.info(id + 'Port config written: ' + port); defer.resolve(); }
  });
  return defer.promise;
};

ControllerSwish.prototype.systemctl = function (systemctlCmd) {
  const self = this;
  const defer = libQ.defer();
  exec('/usr/bin/sudo /bin/systemctl ' + systemctlCmd, { uid: 1000, gid: 1000 }, function (error) {
    if (error !== null) {
      self.logger.error(id + 'Failed to ' + systemctlCmd + ': ' + error);
      self.commandRouter.pushToastMessage('error', 'Swish', 'Failed to ' + systemctlCmd + ': ' + error);
      defer.reject(error);
    } else {
      self.logger.info(id + 'systemctl ' + systemctlCmd + ' succeeded.');
      defer.resolve();
    }
  });
  return defer.promise;
};
