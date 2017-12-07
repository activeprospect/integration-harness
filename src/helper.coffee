path = require('path')
fs   = require('fs');
yaml = require('js-yaml');
_ = require('lodash')
types = require('leadconduit-types')


loadFixtures = (integrationName) ->
  fixtures = []
  try
    # todo: add support for multiple harness files per integration
    fixtures = yaml.safeLoad(fs.readFileSync(path.join(process.cwd(), "harness/#{integrationName}.yaml"), "utf8"))
#    fixtures = require(path.join(process.cwd(), "harness/#{integrationName}.json"))
  catch e
    if(e.name is 'YAMLException')
      throw e

  fixtures


# returns a 'vars' object populated by type-correct values for all the input request variables that are required
generateRequiredVars = (requestVars) ->
  requiredVars = requestVars.filter (value) -> value.required

  exampleData = {}
  if requiredVars.length
    for theVar in requiredVars
      type = types[theVar.type]
      example = type?.parse(type.examples[0].normal || type.examples[0])
      _.set exampleData, theVar.name, example

  exampleData


module.exports =

  loadModule: () ->
    try
      thisModule = require(process.cwd())
    catch
      console.error "uh-oh, no module found in '#{process.cwd()}'"

    thisModule


  getIntegrations: (theModule) ->
    integrations = {}
    if (theModule.outbound)
      looksOk = true

      for integration in theModule.outbound
        # look for either 'request' or 'handle'
        looksOk = false unless !integration.request and !integration.handle


      if looksOk
        integrations = theModule.outbound
      else
        # like BR :-(
        integrations = theModule;
        console.log("Module outbound key looks malformed");

    else
      warnings.push "no outbound integrations found!"
      console.log 'error: no outbound integrations found!'

    return integrations



  getIntegration: (integrations, name, generateFixtures = true) ->
    integration = integrations[name];
    integration.name = name;

    integration.requestVariables = integration.request?.variables unless integration.requestVariables
    integration.responseVariables = integration.response?.variables unless integration.responseVariables

    # load integration-local fixture to use in tests
    integration.fixtures = loadFixtures(name)

    requestVarsFunction = integration.request?.variables or integration.requestVariables

    # ...if there is no integration-local fixture for validate(), create one
    unless integration.fixtures.validate
      integration.fixtures.validate = unless generateFixtures then [] else [
        # vars: dummy example data for all required request-vars, message: undefined (i.e., no validate message)
        vars: generateRequiredVars(requestVarsFunction())
      ]

    # ...if there is no integration-local fixture for request(), create one
    unless integration.fixtures.request
      integration.fixtures.request = unless generateFixtures then [] else [
        # vars: dummy example data for all required request-vars, output: match any string with at least one character
        vars: generateRequiredVars(requestVarsFunction())
        expected: /.*/
        generated: true
      ]

    # ...if there is no integration-local fixture for response(), create one
    unless integration.fixtures.response
      integration.fixtures.response = unless generateFixtures then [] else [
        # res: simple dummy JSON response
        res:
          headers:
            'Content-Type': 'application/json',
          status: 200
          body: '{}'
        expected: /.*/
        generated: true
      ]

    unless integration.fixtures.handle
      integration.fixtures.handle = []


    return integration
