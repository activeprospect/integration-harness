const assert = require('chai').assert,
      _ = require('lodash'),
      types = require('leadconduit-types'),
      lcTypesParser = require('leadconduit-integration').test.types.parser,
      helper = require('./helper');

// some integrations declare request or response variables as these types even though they're not in leadconduit-types
types.names.push('array');
types.names.push('wildcard');

const addEnvVars = function (varNames = []) {
  varNames.forEach(function (varName) {
    process.env[varName] = 'dummy.value';
  });
};

const removeEnvVars = function (varNames = []) {
  varNames.forEach(function (varName) {
    delete process.env[varName]
  });
};

let thisModule = helper.loadModule();
let integrations = helper.getIntegrations(thisModule);

describe('Harness initialization', function() {
  it('should be able to load', function() {
    assert.isDefined(thisModule);
  });

  it('should have module metadata', function () {
    assert.isDefined(thisModule.metadata, "missing module metadata ('docs/index.md')");
    assert.isDefined(thisModule.metadata.provider, "missing module provider");
    assert.isDefined(thisModule.metadata.name, "missing module name");
    assert.isDefined(thisModule.metadata.link, "missing module link");
    assert.isDefined(thisModule.metadata.description, "missing module description");
    assert.isDefined(thisModule.metadata.icon, "missing module icon");
  });
});

for(i of Object.keys(integrations)) {

  let integration = helper.getIntegration(integrations, i);

  describe(integration.name, function () {

    describe('Module basics', function () {

      it('should have a validate function', function () {
        assert.isDefined(integration.validate);
        assert.equal(typeof integration.validate, 'function');
      });

      it('should have request()/response() or handle()', function () {
        assert.isDefined(integration.handle || (integration.request && integration.response));
        if (integration.handle) {
          assert.equal(typeof integration.handle, 'function');
        }
        else {
          assert.equal(typeof integration.request, 'function');
          assert.equal(typeof integration.response, 'function');
        }
      });

      it('should have integration metadata', function () {
        assert.isDefined(integration.metadata, `missing integration metadata ('docs/outbound.${integration.name}.md')`);
        assert.isDefined(integration.metadata.name, "missing integration name");
        assert.isDefined(integration.metadata.tag, "missing integration tag");
        assert.isDefined(integration.metadata.integration_type, "missing integration_type");
        assert.isDefined(integration.metadata.description, "missing integration description");
      });
    });

    describe('Validate function', function () {
      it('should throw if it has undefined envVariables', function () {
        if (integration.envVariables.length > 0) {
          let invoke = () => {
            integration.validate({lead: {}})
          };
          assert.throws(invoke, ('Missing credentials, contact ActiveProspect Support'));
        }
      });


      it('should return a string', function () {
        // make dummy envVariables, if needed
        addEnvVars(integration.envVariables);

        msg = integration.validate({lead: {}});
        assert.equal(typeof msg, 'string');
        assert.isTrue(msg.length > 0);

        removeEnvVars(integration.envVariables);
      });


      it('should correctly handle test fixtures', function () {
        let fixtures = integration.fixtures['validate'];
        let parser = lcTypesParser(integration.requestVariables());
        for (const fixture of fixtures) {
          addEnvVars(integration.envVariables);
          let vars = fixture.vars;
          if (!vars.lead) {
            // there's always a `lead` on `vars`
            vars.lead = {};
          }

          let message = fixture.should ? `should ${fixture.should}` : '';
          assert.equal(integration.validate(parser(fixture.vars)), fixture.expected, message);
          removeEnvVars(integration.envVariables);
        }
      });
    });

    describe('Request variables', function () {

      before(() => {
        this.variables = _.isUndefined(integration.request) ? integration.requestVariables : integration.request.variables;
      });

      it('should be declared', () => {
        assert.isDefined(this.variables);
        assert.equal(typeof this.variables, 'function');
        assert.isTrue(Array.isArray(this.variables()));
        assert.isTrue(this.variables().length > 0);
      });


      it('should include all attributes', () => {
        this.variables().forEach(function (variable) {
          assert.isDefined(variable.name);
          assert.isDefined(variable.type, `'type' is not defined on '${variable.name}'`);
          assert.isDefined(variable.required, `'required' is not defined on '${variable.name}'`);
        });
      });

      it('should have valid values for name', () => {
        this.variables().forEach(function (variable) {
          assert.isDefined(variable.name);
          assert.isTrue(variable.name.length > 0, "name has non-zero length");
          assert.equal(variable.name, variable.name.toLowerCase(), `name '${variable.name}' has no uppercase letters`);
        });
      });

      it('should have valid values for description', () => {
        this.variables().forEach(function (variable) {
          if (variable.type !== 'wildcard') {
            assert.isDefined(variable.description, `description is defined on '${variable.name}'`);
            assert.isTrue(variable.description.length > 0, `description for '${variable.name}' has non-zero length`);
          }
        });
      });

      it('should have valid values for required', () => {
        this.variables().forEach(function (variable) {
          assert.equal(Boolean(variable.required), variable.required, `required attribute for '${variable.name}' is valid boolean`);
        });
      });

      it('should have valid values for type', () => {
        this.variables().forEach(function (variable) {
          valid = types.names.indexOf(variable.type) >= 0;
          assert.isTrue(valid, `type attribute for '${variable.name}' is valid LeadConduit type`);
        });
      });
    });


    describe('Response variables', function () {

      before(() => {
        this.variables = _.isUndefined(integration.response) ? integration.responseVariables : integration.response.variables;
      });

      it('should be declared', () => {
        assert.isDefined(this.variables);
        assert.equal(typeof this.variables, 'function');
        assert.isTrue(Array.isArray(this.variables()));
        assert.isTrue(this.variables().length > 0);
      });

      it('should include all attributes', () => {
        this.variables().forEach(function (variable) {
          assert.isDefined(variable.name);
          assert.isDefined(variable.type, `type is defined on '${variable.name}'`);
        });
      });


      it('should have valid values for name', () => {
        this.variables().forEach(function (variable) {
          assert.isDefined(variable.name);
          assert.isTrue(variable.name.length > 0, "name has non-zero length");
          assert.equal(variable.name, variable.name.toLowerCase(), `name '${variable.name}' has no uppercase letters`);
        });
      });


      it('should have valid values for description', () => {
        this.variables().forEach(function (variable) {
          if (variable.type !== 'wildcard') {
            assert.isDefined(variable.description, `description is defined on '${variable.name}'`);
            assert.isTrue(variable.description.length > 0, `description for '${variable.name}' has non-zero length`);
          }
        });
      });

      it('should have valid values for type', () => {
        this.variables().forEach(function (variable) {
          valid = types.names.indexOf(variable.type) >= 0;
          assert.isTrue(valid, `type attribute for '${variable.name}' is valid LeadConduit type`);
        });
      });
    });

    describe('Request function', function () {
      it('should correctly handle request fixtures', () => {
        if (integration.request) {
          let parser = lcTypesParser(integration.requestVariables());
          let fixtures = integration.fixtures['request'];
          for (let fixture of fixtures) {
            let vars = _.merge(fixture.vars, integration.fixtures.extra_vars);
            assertFixtureMatch(integration.request(parser(vars)), fixture.expected, fixture.should);
          }
        }
      });
    });

    describe('Response function', () => {
      it('should correctly handle response fixtures', () => {
        if(!_.isUndefined(integration.response)) {
          let fixtures = integration.fixtures['response'];
          for(let fixture of fixtures) {
            assertFixtureMatch(integration.response({}, {}, fixture.res), fixture.expected, fixture.should);
          }
        }
      });
    });

    describe('Handle function', function () {

      if (integration.handle) {
        integration.fixtures['handle'].forEach(function (fixture) {

          it(`should ${fixture.should}`, function (done) {
            let vars = _.merge(fixture.vars, integration.fixtures.extra_vars);
            helper.invokeHandle(integration.handle, vars, fixture.nockOptions, function (err, event) {
              if (err) {
                console.error(err);
              }
              assert.isNull(err);
              assert.deepEqual(event, fixture.expected);
              done();
            });
          });
        });
      }
    });
  });
}

const assertFixtureMatch = function(actual, expected, message = '') {
  if(message) { message = `should ${message}`; }

  if(_.isRegExp(expected)) {
    assert.match(actual, expected, message);
  }
  else if(_.isObject(expected)) {
    assert.deepEqual(actual, expected, message);
  }
  else if(_.isString(expected)) {
    assert.equal(actual, expected, message);
  }
  else {
    assert.fail(null, null, `"expected" in fixture should be a RegExp, Object, or String (it was ${typeof expected})`);
  }
};

