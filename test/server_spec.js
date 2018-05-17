const request = require('supertest');
const assert = require('chai').assert;

let htmlMatch = function(regexStrings, text) {
  regexStrings.forEach(function(regexString) {
    let regex = new RegExp(regexString);
    // remove `\n` newlines
    assert.match(text.replace(/\n/g, ''), regex, `${regex} not found`);
  });
};

describe('harness server', function () {
  let server;
  beforeEach(function () {
    process.chdir('test/spec_integration');
    delete require.cache[require.resolve('../lib/server')]; // force full restart for each test
    app = require('../lib/server');
    server = app();
  });

  afterEach(function (done) {
    server.close(done);
    process.chdir("../..");
  });

  it('responds to /', function(done) {
    request(server)
      .get('/')
      .expect(200, done);
  });

  it('404s non-existent page', function(done) {
    request(server)
      .get('/foo/bar')
      .expect(404, done);
  });

  ['validate', 'request', 'response'].forEach((funcName) => {

    it(`returns empty form for ${funcName}() page`, function(done) {
      request(server)
        .get(`/${funcName}/spec`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          let matches = [
            `<h2>spec - <code>${funcName}..<\/code><\/h2>`,  // .. for parens, :-/
            "no fixture <b>&lsaquo;&lsaquo;</b>" // match chevron indicators
          ];
          htmlMatch(matches, res.text);
          done();
        });
    });

    it(`returns fixture #0 for ${funcName}() page`, function(done) {
      request(server)
        .get(`/${funcName}/spec/0`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          let matches = [
            `<h2>spec - <code>${funcName}..<\/code><\/h2>`, // .. for parens, :-/
            "fixture #0 <b>&lsaquo;&lsaquo;</b>" // match chevron indicators
          ];
          if(funcName === "response") {
            matches.push('name="header\\[X-Runtime]" value="16"'); // match form value from fixture
          }
          else { // validate & request
            matches.push('name="lead.phone_1" value="5125551212"'); // match form value from fixture
          }
          htmlMatch(matches, res.text);
          done();
        });
    });
  });

  describe('validate()', function() {

    beforeEach(function() {
      this.matches = [
        "<h2>spec - <code>validate..<\/code><\/h2>", // .. for parens, :-/
        "<p>Actual result:</p>"
      ];
    });

    it(`returns 'missing credentials'`, function(done){
      request(server)
        .post(`/validate/spec`)
        .send(`lead.phone_1=5135552379`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push(`input type="text" name="lead.phone_1" value="5135552379"/>`); // should echo input back
          this.matches.push("<pre>&#34;Missing credentials, contact ActiveProspect Support&#34;</pre>");
          htmlMatch(this.matches, res.text);
          done();
        });
    });

    it(`returns 'valid phone number'`, function(done){
      request(server)
        .post(`/validate/spec`)
        .send(`env.SPEC_ENV_VAR=abcdef`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push(`input type="text" name="env.SPEC_ENV_VAR" value="abcdef"/>`); // should echo input back
          this.matches.push("<pre>&#34;A valid phone number is required&#34;</pre>");
          htmlMatch(this.matches, res.text);
          done();
        });
    });

    it(`returns 'undefined'`, function(done){
      request(server)
        .post(`/validate/spec`)
        .send(`lead.phone_1=5135552379&env.SPEC_ENV_VAR=abcdef`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push(`input type="text" name="lead.phone_1" value="5135552379"/>`); // should echo input back
          this.matches.push(`input type="text" name="env.SPEC_ENV_VAR" value="abcdef"/>`); // should echo input back
          this.matches.push("<span class=\"undefined\">undefined</span>");
          htmlMatch(this.matches, res.text);
          done();
        });
    });

    it(`returns 'undefined' with fixture #0`, function(done) {
      request(server)
        .post(`/validate/spec/0`)
        .send(`lead.phone_1=5135552379&env.SPEC_ENV_VAR=abcdef`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push("fixture #0 <b>&lsaquo;&lsaquo;</b>"); // match chevron indicators
          this.matches.push(`input type="text" name="lead.phone_1" value="5135552379"/>`); // should echo input back
          this.matches.push(`input type="text" name="env.SPEC_ENV_VAR" value="abcdef"/>`); // should echo input back
          this.matches.push("<div class=\"matched_true\">&nbsp;</div>"); // the green check-mark class
          this.matches.push("<span class=\"undefined\">undefined</span>");
          this.matches.push("<p>Expected result:</p>");
          htmlMatch(this.matches, res.text);
          done();
        });
    });
  });

  describe('request()', function() {

    beforeEach(function() {
      this.matches = [
        "<h2>spec - <code>request..<\/code><\/h2>", // .. for parens, :-/
        "<p>Actual result:</p>"
      ];
    });

    it(`returns request with submitted value`, function(done){
      request(server)
        .post(`/request/spec`)
        .send(`lead.phone_1=5135552379`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push(`input type="text" name="lead.phone_1" value="5135552379"/>`); // should echo input back
          this.matches.push("&#34;body&#34;: &#34;Telefonnummer=5135552379&#34;");
          htmlMatch(this.matches, res.text);
          done();
        });
    });

    it(`returns matched-true with fixture #0`, function(done) {
      request(server)
        .post(`/request/spec/0`)
        .send(`lead.phone_1=5125551212&env.SPEC_ENV_VAR=dummy.value`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push("fixture #0 <b>&lsaquo;&lsaquo;</b>"); // match chevron indicators
          this.matches.push(`input type="text" name="lead.phone_1" value="5125551212"/>`); // should echo input back
          this.matches.push(`input type="text" name="env.SPEC_ENV_VAR" value="dummy.value"/>`); // should echo input back
          this.matches.push("<div class=\"matched_true\">&nbsp;</div>"); // the green check-mark class
          this.matches.push("&#34;Authorization&#34;: &#34;key: dummy.value&#34;");
          this.matches.push("&#34;body&#34;: &#34;Telefonnummer=5125551212&#34;");
          this.matches.push("<p>Expected result:</p>");
          htmlMatch(this.matches, res.text);
          done();
        });
    });

    it(`returns matched-false with altered fixture #0`, function(done) {
      request(server)
        .post(`/request/spec/0`)
        .send(`lead.phone_1=9005559090&env.SPEC_ENV_VAR=hax0r`) // i.e., loaded fixture but changed it
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push("fixture #0 <b>&lsaquo;&lsaquo;</b>"); // match chevron indicators
          this.matches.push(`input type="text" name="lead.phone_1" value="9005559090"/>`); // should echo input back
          this.matches.push(`input type="text" name="env.SPEC_ENV_VAR" value="hax0r"/>`); // should echo input back
          this.matches.push("<div class=\"matched_false\">&nbsp;</div>"); // the red X class
          htmlMatch(this.matches, res.text);
          done();
        });
    });
  });

  describe('response()', function() {

    beforeEach(function() {
      this.matches = [
        "<h2>spec - <code>response..<\/code><\/h2>", // .. for parens, :-/
        "<p>Actual result:</p>"
      ];
    });

    it(`returns response with submitted value`, function(done){
      request(server)
        .post(`/response/spec`)
        .send(`status=200&header[Content-Type]=application/json&body={}`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push(`<code>status</code></td> <td><input type="text" name="status" value="200"/>`); // should echo input back
          this.matches.push("&#34;outcome&#34;: &#34;success&#34;");
          htmlMatch(this.matches, res.text);
          done();
        });
    });

    it(`returns matched-true with fixture #0`, function(done) {
      request(server)
        .post(`/response/spec/0`)
        .send(`status=200&header[Content-Type]=application/json&body={"status":"good"}`)
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push("fixture #0 <b>&lsaquo;&lsaquo;</b>"); // match chevron indicators
          this.matches.push(`<code>status</code></td> <td><input type="text" name="status" value="200"/>`); // should echo input back
          this.matches.push("<div class=\"matched_true\">&nbsp;</div>"); // the green check-mark class
          this.matches.push("&#34;outcome&#34;: &#34;success&#34;,");
          this.matches.push("<p>Expected result:</p>");
          htmlMatch(this.matches, res.text);
          done();
        });
    });

    it(`returns matched-false with altered fixture #0`, function(done) {
      request(server)
        .post(`/response/spec/0`)
        .send(`status=500&header[Content-Type]=application/json&body={"status":"fair-to-middling"}`)  // i.e., loaded fixture but changed it
        .expect(200)
        .expect('Content-Type', 'text/html; charset=utf-8')
        .end((err, res) => {
          if (err) return done(err);
          this.matches.push("fixture #0 <b>&lsaquo;&lsaquo;</b>"); // match chevron indicators
          this.matches.push(`<code>status</code></td> <td><input type="text" name="status" value="500"/>`); // should echo input back
          this.matches.push("<div class=\"matched_false\">&nbsp;</div>"); // the red X class
          this.matches.push("&#34;billable&#34;: 0,");
          this.matches.push("<p>Expected result:</p>");
          htmlMatch(this.matches, res.text);
          done();
        });
    });
  });

});
