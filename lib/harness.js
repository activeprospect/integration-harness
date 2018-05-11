const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');

const argv = require('yargs')
  .options({
    's': {
      alias: 'server',
      description: 'Start web server'
    },
    'p': {
      alias: 'port',
      description: 'Web server port',
      default: 3000
    }
  })
  .argv;

if (argv.server) {
  const server = require('./server');
  server(argv.port);
}
else {
  mocha = new Mocha();

  fs.readdirSync(__dirname).filter(function (file) {
    return file.substr(-9) === '_tests.js';
  }).forEach(function (file) {
    return mocha.addFile(path.join(__dirname, file));
  });

  mocha.run(function (failures) {
    return process.on('exit', function () {
      return process.exit(failures); // exit with non-zero status if there were failures
    });
  });
}
