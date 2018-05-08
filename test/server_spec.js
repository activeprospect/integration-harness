const request = require('supertest');

describe('harness server', function () {
  let server;
  beforeEach(function () {
    delete require.cache[require.resolve('../lib/server')]; // force full restart for each test
    server = require('../lib/server');
  });

  afterEach(function (done) {
    server.close(done);
  });

  it('responds to /', function(done) {
    request(server)
      .get('/')
      .expect(200, done);
  });

  it('404 everything else', function(done) {
    request(server)
      .get('/foo/bar')
      .expect(404, done);
  });
});
