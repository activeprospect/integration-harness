const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');
const server = require('./server');

if (process.argv[2] === '--server') {
  server.run();
}
else {
  mocha = new Mocha();
  testDir = path.join(__dirname, 'tests');
  fs.readdirSync(testDir).filter(function (file) {
    return file.substr(-3) === '.js';
  }).forEach(function (file) {
    return mocha.addFile(path.join(testDir, file));
  });
  mocha.run(function (failures) {
    return process.on('exit', function () {
      return process.exit(failures); // exit with non-zero status if there were failures
    });
  });
}
