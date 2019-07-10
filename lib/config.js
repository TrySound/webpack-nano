/*
  Copyright © 2018 Andrew Powell

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at http://mozilla.org/MPL/2.0/.

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of this Source Code Form.
*/
const { existsSync } = require('fs');
const { resolve } = require('path');

const { sync: resolveModule } = require('resolve');

const rechoir = require('rechoir');

const esmRegister = {
  module: 'esm',
  register(hook) {
    // register on .js extension due to https://github.com/joyent/node/blob/v0.12.0/lib/module.js#L353
    // which only captures the final extension (.babel.js -> .js)
    const esmLoader = hook(module);
    /* eslint-disable */
    require.extensions['.js'] = esmLoader('module')._extensions['.js'];
    /* eslint-enable */
  }
};
const fileTypes = {
  '.esm.js': [esmRegister],
  '.es6': ['@babel/register', esmRegister],
  '.mjs': ['@babel/register', esmRegister],
  '.babel.js': ['@babel/register', 'babel-register', 'babel-core/register', 'babel/register'],
  '.babel.ts': ['@babel/register'],
  '.ts': [
    'ts-node/register',
    'typescript-node/register',
    'typescript-register',
    'typescript-require'
  ]
};
const configTypes = {
  function: (c, argv) => Promise.resolve(c(argv.env || {}, argv)),
  object: (c) => Promise.resolve(c)
};
const cwd = process.cwd();
const defaultConfigPath = resolve(cwd, 'webpack.config.js');

const requireLoader = (opts) => {
  if (opts.require) {
    if (typeof opts.require === 'string') {
      opts.require = [opts.require];
    }
    opts.require.forEach((module) => {
      if (module) {
        console.log('bla', resolveModule(module, { basedir: cwd }));
        /* This check ensures we ignore `-r ""`, trailing `-r`, or
         * other silly things the user might (inadvertently) be doing.
         */
        require(resolveModule(module, { basedir: cwd }));
      }
    });
  }
};

const loadConfig = async (argv) => {
  if (!argv.config && existsSync(defaultConfigPath)) {
    // eslint-disable-next-line no-param-reassign
    argv.config = defaultConfigPath;
  }

  // let's not process any config if the user hasn't specified any
  if (argv.config) {
    const configName = typeof argv.config !== 'string' ? Object.keys(argv.config)[0] : null;
    // e.g. --config.batman webpack.config.js
    const configPath = argv.config[configName] || argv.config;
    const resolvedPath = resolve(configPath);

    requireLoader(argv);

    let configExport = require(resolvedPath); // eslint-disable-line global-require, import/no-dynamic-require

    if (configExport.default) {
      configExport = configExport.default;
    }

    if (configName) {
      if (!Array.isArray(configExport)) {
        throw new TypeError(
          `A config with name was specified, but the config ${configPath} does not export an Array.`
        );
      }

      configExport = configExport.find((c) => c.name === configName);

      if (!configExport) {
        throw new RangeError(`A config with name '${configName}' was not found in ${configPath}`);
      }
    }

    const configType = typeof configExport;
    const config = await configTypes[configType](configExport, argv);
    const watchConfig = [].concat(config).find((c) => !!c.watch);

    return { config, watchConfig };
  }

  return { config: {} };
};

module.exports = { loadConfig };
