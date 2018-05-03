const path = require('path');
const fs   = require('fs');
const yaml = require('js-yaml');
const _ = require('lodash');
const types = require('leadconduit-types');
const nock = require('nock');

const frontmatter = require('front-matter');
const markdownIt = require('markdown-it');


const loadFixtures = function(integrationName) {
  let fixtures = [];
  try {
    fixtures = yaml.safeLoad(fs.readFileSync(path.join(process.cwd(), `harness/${integrationName}.yaml`), "utf8"));
  }
  catch (e) {
    if (e.name === 'YAMLException') {
      throw(e);
    }
  }
  return(fixtures);
};

// todo: make this common somewhere in the LC codebase (lc-integration?)
const loadMetadata = function(filebase) {
  markdown = new markdownIt();
  let metadata = {};
  try {
    let docs = frontmatter(fs.readFileSync(path.join('docs', `${filebase}.md`), 'utf8'));
    metadata = docs.attributes;
    metadata.description = markdown.render(docs.body);
  }
  catch(e) {
    // missing docs/index.md is no problem; only log and set error data...
    if(e.code !== 'ENOENT') {
      console.error(e);
      metadata = {
        name: `Error loading name for ${filebase}`,
        description: `Error loading description for ${filebase}`
      };
    }
  }

  return(metadata);
};

const loadIcon = function() {
  if (fs.existsSync(path.join('lib', 'ui', 'public', 'images', 'icon.png'))) {
    return('images/icon.png');
  }
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
      thisModule.metadata = loadMetadata('index');
      thisModule.metadata.icon = loadIcon();
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
        integrations = theModule;
        console.error("error: module's outbound key is malformed");
      }
    }
    else {
      console.error("error: no outbound integrations found");
    }
    return (integrations);
  },

  getIntegration: (integrations, name, generateFixtures = true) => {
    let integration = integrations[name];
    integration.name = name;

    if (!integration.requestVariables && integration.request) integration.requestVariables = integration.request.variables;
    if (!integration.responseVariables && integration.response) integration.responseVariables = integration.response.variables;
    if (!integration.envVariables) integration.envVariables = [];

    integration.metadata = loadMetadata(`outbound.${name}`);

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
