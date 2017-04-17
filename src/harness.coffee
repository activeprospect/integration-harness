assert = require('chai').assert
Mocha = require('mocha')
fs = require('fs')
path = require('path')
server = require('./server')

if process.argv[2] is '--server'
  server.run()
else
  mocha = new Mocha()

  testDir = path.join(__dirname, 'tests')

  fs.readdirSync(testDir).filter (file) ->
    return file.substr(-3) == '.js'
  .forEach (file) ->
    mocha.addFile(path.join(testDir, file))


  mocha.run (failures) ->
    process.on 'exit', () ->
      process.exit (failures)  # exit with non-zero status if there were failures
