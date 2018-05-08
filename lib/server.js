const path = require('path');
const _ = require('lodash');
const flat = require('flat');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const lcTypesParser = require('leadconduit-integration').test.types.parser;
const helper = require('./helper');
const assert = require('chai').assert;

let ui;
try {
  ui = require(path.join(process.cwd(), './lib/ui'));
}
catch(e) {
  console.log("no rich UI found");
}


let matchedExpected = function(method, actual, expected) {
  let matched = true;
  try {
    assert.deepEqual(actual, expected);
  }
  catch (e) {
    matched = false;
  }

  return(matched);
};

let parseVars = function(parser, body) {
  let deleteBlanks = function (obj) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] === '') {
        delete(obj[key]);
      }
    }
    return (obj);
  };

  let vars = flat.unflatten(deleteBlanks(body));
  if(!vars.lead) { vars.lead = {}; } // every vars at least has `.lead`

  return(parser(vars));
};

let getFixture = function(fixtures, method, fixtureId) {
  if (!fixtures || !method || !fixtureId || !fixtures[method]) {
    return;
  }
  return (fixtures[method][fixtureId]);
};

let getExtraVars = function(integration) {
  if (integration.fixtures.extra_vars) {
    return (flat.flatten(integration.fixtures.extra_vars));
  }
};

let setupEnv = function(body) {
  let envVars = flat.unflatten(body).env;
  if (!body.env) {
    body.env = {};
  }
  for (let key in envVars) {
    if (envVars.hasOwnProperty(key) && envVars[key].length) {
      process.env[key] = body.env[key] = envVars[key];
    }
    else {
      delete process.env[key];
    }
  }
};

module.exports = {

  run: () => {
    let loaded = helper.loadModule();

    let moduleInfo = {
      name: loaded.name || path.basename(process.cwd()),
      hasUI: !!ui,
      metadata: loaded.metadata
    };

    let app = express();

    // use __dirname paths to access harness' own files
    app.use(express.static(path.resolve(__dirname, 'public')));
    app.set('views', path.resolve(__dirname, 'views'));
    app.set('view engine', 'ejs');

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(session({ secret: 'dev', resave: false, saveUninitialized: true }));
    if(ui) {
      app.use('/ui', ui);
    }

    app.use('/images', express.static(path.join(process.cwd(), 'lib', 'ui', 'public', 'images')));

    moduleInfo.integrations = helper.getIntegrations(loaded);

    app.get("/", (request, response) => response.render('index', {moduleInfo: moduleInfo}));

    // render the user's page with all options
    app.get([/^\/(validate|request|response|handle)\/(.*)\/(\d+)/, /^\/(validate|request|response|handle)\/([^/]*)/], (req, res) => {
      let method = req.params[0];   // validate, request, etc.
      let endpoint = req.params[1]; // query_item, add_item, etc.
      let fixtureId = req.params[2] ? req.params[2] : null; // 0, 1, etc.

      let integration = helper.getIntegration(moduleInfo.integrations, endpoint, false);
      let fixture = getFixture(integration.fixtures, method, fixtureId);
      let extraVars = getExtraVars(integration);

      let values;
      if(fixture) {
        values = fixture.res ? fixture.res : flat.flatten(fixture.vars);
        values.extraVars = extraVars;
        values.nockOptions = fixture.nockOptions;
        if (!values.env) {values.env = {}}

        if(fixture.envVariables) {
          fixture.envVariables.forEach(varName => {
            values.env[varName] = 'dummy.value';
          });
        }
      }

      else if(method === 'response') {
        // basic JSON template
        values = {
          status: 200,
          headers: {"Content-Type": "application/json"},
          body: "{  \"sample\": true }"
        };
      }
      else {
        values = req;
        if (!values.env) {values.env = {}}
      }

      if (!res.locals) {res.locals = {}}

      res.render('method', {moduleInfo: moduleInfo, endpoint: integration, method: method, values: values, fixtures: integration.fixtures ? integration.fixtures[method] : {}, fixtureId: fixtureId, result: false});
    });

    app.post([/^\/handle\/(.*)\/(\d+)/, /^\/handle\/([^/]*)/], (req, res) => {
      let method = "handle";
      let endpoint = req.params[0];
      let fixtureId = req.params[1] ? req.params[1] : null;

      let integration = helper.getIntegration(moduleInfo.integrations, endpoint, false);
      let fixture = getFixture(integration.fixtures, method, fixtureId);
      let extraVars = getExtraVars(integration);

      let body = req.body;
      let vars = parseVars(lcTypesParser(integration.requestVariables()), body);
      vars = _.merge(vars, extraVars);

      let expected;
      let nockOptions = fixture ? _.merge(fixture.nockOptions, vars.nockoptions) : vars.nockoptions;
      if(fixture) {
        body.nockOptions = fixture.nockOptions;
        expected = fixture.expected;
      }

      body.extraVars = extraVars;

      helper.invokeHandle(integration[method], vars, nockOptions, (err, actual) => {
        let result = {
          actual: actual,
          expected: expected ? expected : null
        };

        if(fixture) {
          result.matchedExpected = matchedExpected(method, actual, expected);
        }

        res.render('method', {moduleInfo: moduleInfo, endpoint: integration, method: method, values: body, fixtures: integration.fixtures ? integration.fixtures[method] : {}, fixtureId: fixtureId, result: result });
      });
    });

    app.post([/^\/(validate|request|response)\/(.*)\/(\d+)/, /^\/(validate|request|response)\/([^/]*)/], (req, res) => {
      let method = req.params[0];
      let endpoint = req.params[1];
      let fixtureId = req.params[2] ? req.params[2] : null;

      let integration = helper.getIntegration(moduleInfo.integrations, endpoint, false);
      let fixture = getFixture(integration.fixtures, method, fixtureId);
      let extraVars = getExtraVars(integration);

      let response, actual;
      if(method === 'response') {
        response = {
          status: req.body.status,
          headers: req.body.header,
          body: req.body.body
        };

        try {
          actual = integration[method]({}, {}, response);
        }
        catch (err) {
          actual = err.message;
        }
      }
      else { // method is 'validate' or 'request'
        response = req.body;
        setupEnv(response);
        let vars = parseVars(lcTypesParser(integration.requestVariables()), response);
        try {
          actual = integration[method](vars);
        }
        catch (err) {
          actual = err.message;
        }
      }

      response.extraVars = extraVars;

      let result = {
        actual: actual
      };
      if(fixture) {
        result.expected = fixture.expected;
        result.matchedExpected = matchedExpected(method, actual, fixture.expected);
      }

      res.render('method', {moduleInfo: moduleInfo, endpoint: integration, method: method, values: response, fixtures: integration.fixtures ? integration.fixtures[method] : {}, fixtureId: fixtureId, result: result });
    });


    app.listen(3000, () => { console.log(`Harness for '${moduleInfo.name}' started on http://localhost:3000`); });
  }
};

