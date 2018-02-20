const path = require('path');
const fs   = require('fs');
const yaml = require('js-yaml');
const _ = require('lodash');
const types = require('leadconduit-types');
const nock = require('nock');


const loadFixtures = function(integrationName) {
  let fixtures = [];
  try {
    // todo: add support for multiple harness files per integration
    fixtures = yaml.safeLoad(fs.readFileSync(path.join(process.cwd(), `harness/${integrationName}.yaml`), "utf8"));
  }
  catch (e) {
    if (e.name === 'YAMLException') {
      throw(e);
    }
  }
  return(fixtures);
};

// returns a 'vars' object populated by type-correct values for all the input request variables that are required
const generateRequiredVars = function(requestVars) {
  let requiredVars = requestVars.filter((value) => value.required);

  let exampleData = {};
  if (requiredVars.length) {
    for (const theVar of requiredVars) {
      let type = types[theVar.type];
      let example = type ? type.parse(type.examples[0].normal || type.examples[0]) : null;
      _.set(exampleData, theVar.name, example);
    }
  }
  return (exampleData);
};

module.exports = {

  loadModule: () => {
    let thisModule = null;
    try {
      thisModule = require(process.cwd());
    }
    catch(e) {
      throw new Error(`uh-oh, no module found in '${process.cwd()}'`);
    }
    return (thisModule);
  },

  getIntegrations: (theModule) => {
    let integrations = {};
    if (theModule.outbound) {
      let looksOk = true;

      for (const integration in theModule.outbound) {
        // look for either 'request' or 'handle'
        if(theModule.outbound.hasOwnProperty(integration)) {
          looksOk = theModule.outbound[integration].request || theModule.outbound[integration].handle;
        }
      }

      if (looksOk) {
        integrations = theModule.outbound;
      }
      else {
        // like BR :-(   todo: still needed?
        integrations = theModule;
        console.log("Module outbound key looks malformed");
      }
    }
    else {
      warnings.push("no outbound integrations found!");
      console.error('error: no outbound integrations found!');
    }
    return (integrations);
  },

  getIntegration: (integrations, name, generateFixtures = true) => {
    let integration = integrations[name];
    integration.name = name;

    if (!integration.requestVariables && integration.request) integration.requestVariables = integration.request.variables;
    if (!integration.responseVariables && integration.response) integration.responseVariables = integration.response.variables;
    if (!integration.envVariables) integration.envVariables = [];

    // load integration-local fixture to use in tests
    integration.fixtures = loadFixtures(name);

    // ...if there is no integration-local fixture for validate(), create one
    if (!integration.fixtures.validate) {
      integration.fixtures.validate = generateFixtures ? [{
        // vars: dummy example data for all required request-vars, message: undefined (i.e., no validate message)
        vars: generateRequiredVars(integration.requestVariables())
      }] : [];
    }

    // ...if there is no integration-local fixture for request(), create one
    if (!integration.fixtures.request) {
      integration.fixtures.request = generateFixtures ? [{
        // vars: dummy example data for all required request-vars, output: match any string with at least one character
        vars: generateRequiredVars(integration.requestVariables()),
        expected: /.*/,
        generated: true
      }] : [];
    }

    // ...if there is no integration-local fixture for response(), create one
    if (!integration.fixtures.response) {
      integration.fixtures.response = generateFixtures ? [{
        // res: simple dummy JSON response
        expected: /.*/,
        generated: true,
        res: {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
          body: '{}'
        }
      }] : [];
    }

    if (!integration.fixtures.handle) {
      integration.fixtures.handle = [];
    }

    return (integration);
  },

  invokeHandle: (handle, vars, options, callback) => {

    if(!options) return callback(null, { harness_error: 'no nock to catch handle() call' });

    if(!_.isArray(options)) options = [options];
    let nocks = options.map((option) => {
      return nock(option.url)
        .intercept(option.query, option.verb)
        .reply(option.statusCode, option.responseData, option.headers);
    });

    handle(vars, (err, event) => {
      if (!event) event = {};

      let allNocksMet = nocks.every((aNock) => {
        if (!aNock.isDone()) {
          event.nocks_unmet = [];
          event.nocks_unmet.push(Object.keys(aNock.keyedInterceptors)[0]);
        }

        aNock.isDone();
      });

      try {
        nock.cleanAll();
        assert.isTrue(allNocksMet);
      }
      catch (e) {
        event.nocks_total = nocks.length;
      }

      return(callback(err, event));
    });
  }
};
