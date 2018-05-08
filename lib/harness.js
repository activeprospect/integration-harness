const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');

if (process.argv[2] === '--server') {
  const server = require('./server');
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
