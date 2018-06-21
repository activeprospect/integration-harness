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
  helper.log("no rich UI found");
}


const matchedExpected = function(method, actual, expected) {
  let matched = true;
  try {
    assert.deepEqual(actual, expected);
  }
  catch (e) {
    matched = false;
  }

  return(matched);
};

const parseVars = function(parser, body) {
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

const getFixture = function(fixtures, method, fixtureId) {
  if (!fixtures || !method || !fixtureId || !fixtures[method]) {
    return;
  }
  return (fixtures[method][fixtureId]);
};

const getExtraVars = function(integration) {
  if (integration.fixtures.extra_vars) {
    return (flat.flatten(integration.fixtures.extra_vars));
  }
};

const setupEnv = function(body) {
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

const buildRenderData = function(params, moduleInfo) {
  const method = params[0]; // validate, request, etc.
  const integrationName = params[1];  // query_item, add_item, etc.
  const fixtureId = params[2] ? params[2] : null; // 0, 1, etc.

  const endpoint = helper.getIntegration(moduleInfo.integrations, integrationName, false /*generateFixtures*/);

  let data = {
    moduleInfo: moduleInfo,
    method: method,
    integrationName: integrationName,
    fixtureId: fixtureId,

    endpoint: endpoint,
    fixtures: endpoint.fixtures ? endpoint.fixtures[method] : {},
    fixture: getFixture(endpoint.fixtures, method, fixtureId),

    values: null,
    result: false
  };
  return(data);
};

let loaded = helper.loadModule();

const moduleInfo = {
  name: loaded.name || path.basename(process.cwd()),
  hasUI: !!ui,
  metadata: loaded.metadata
};

let buildApp = () => {
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
    let renderData = buildRenderData(req.params, moduleInfo);

    let values = req; // default, may be overridden

    let fixture = renderData.fixture;
    if(fixture) {
      values = fixture.res ? fixture.res : flat.flatten(fixture.vars);
      values.extraVars = getExtraVars(renderData.endpoint);
      values.nockOptions = fixture.nockOptions;
      if (!values.env) {values.env = {}}

      if(fixture.envVariables) {
        fixture.envVariables.forEach(varName => {
          values.env[varName] = 'dummy.value';
        });
      }
    }
    else if(renderData.method === 'response') {
      // basic JSON template
      values = {
        status: 200,
        headers: {"Content-Type": "application/json"},
        body: "{  \"sample\": true }"
      };
    }

    if (!values.env) {values.env = {}}
    if (!res.locals) {res.locals = {}}

    renderData.values = values;

    res.render('method', renderData);
  });

  app.post([/^\/(validate|request|response)\/(.*)\/(\d+)/, /^\/(validate|request|response)\/([^/]*)/], (req, res) => {
    let renderData = buildRenderData(req.params, moduleInfo);

    let integrationFunction = renderData.endpoint[renderData.method];

    let values, actual;
    if(renderData.method === 'response') {
      values = {
        status: req.body.status,
        headers: req.body.header,
        body: req.body.body
      };

      try {
        // invoke `response()`
        actual = integrationFunction({}, {}, values);
      }
      catch (err) {
        actual = err.message;
      }
    }
    else { // method is 'validate' or 'request'
      values = req.body;
      setupEnv(values);
      let vars = parseVars(lcTypesParser(renderData.endpoint.requestVariables()), values);
      try {
        // invoke `validate() or request()`
        actual = integrationFunction(vars);
      }
      catch (err) {
        actual = err.message;
      }
    }

    values.extraVars = getExtraVars(renderData.endpoint);

    let result = { actual };
    if(renderData.fixture) {
      result.expected = renderData.fixture.expected;
      result.matchedExpected = matchedExpected(renderData.method, actual, renderData.fixture.expected);
    }

    renderData.values = values;
    renderData.result = result;

    res.render('method', renderData);
  });

  app.post([/^\/(handle)\/(.*)\/(\d+)/, /^\/(handle)\/([^/]*)/], (req, res) => {
    let renderData = buildRenderData(req.params, moduleInfo);

    // todo: finish converting this to use `renderData`
    let method = req.params[0];
    let endpoint = req.params[1];
    let fixtureId = req.params[2] ? req.params[2] : null;

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

      // values: body instead of values: values and result: result
      res.render('method', {moduleInfo: moduleInfo, endpoint: integration, method: method, values: body, fixtures: integration.fixtures ? integration.fixtures[method] : {}, fixtureId: fixtureId, result: result });
    });
  });

  app.get('*', (req, res) => { res.sendStatus(404); });

  return app;
};

module.exports = function(port = 3033) {
  server = buildApp().listen(port, function () {
    helper.log(`Harness for '${moduleInfo.name}' started on http://localhost:${server.address().port}`);
  });
  return server;
};
