path = require('path')
_ = require('lodash')
flat = require('flat')
express = require('express')
bodyParser = require('body-parser')
lcTypesParser = require('leadconduit-integration').test.types.parser
helper = require('./helper')
nock = require('nock')
assert = require('chai').assert

try
  ui = require(path.join(process.cwd(), './lib/ui'))
catch e
  console.log("no rich UI found");


matchedExpected = (method, actual, expected) ->
  matched = true
  try
    assert.deepEqual(actual, expected)
  catch e
    matched = false

  matched


parseVars = (parser, body) ->

  deleteBlanks = (obj) ->
    for k, v of obj
      delete obj[k] if v is ''

    obj

  vars = flat.unflatten(deleteBlanks(body))
  vars.lead = {} unless vars.lead? # every vars at least has `.lead`

  parser(vars)


getFixture = (fixtures, method, fixtureId) ->
  return unless fixtures? and method? and fixtureId?
  fixtures[method]?[fixtureId]

getExtraVars = (integration) ->
  flat.flatten(integration.fixtures.extra_vars) if integration.fixtures.extra_vars


setupEnv = (body) ->
  envVars = flat.unflatten(body).env
  body.env ?= {}
  for k, v of envVars
    if v.length
      process.env[k] = v
      body.env[k] = v
    else
      delete process.env[k]

module.exports =

  run: () ->
    loaded = helper.loadModule()

    moduleInfo =
      name: loaded.name or path.basename(process.cwd())
      hasUI: ui?

    app = express()

    # use __dirname paths to access harness' own files
    app.use(express.static(path.resolve(__dirname, 'public')))
    app.set('views', path.resolve(__dirname, 'views'))
    app.set('view engine', 'ejs')

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use('/ui', ui) if ui

    moduleInfo.integrations = helper.getIntegrations(loaded)


    app.get "/", (request, response) ->
      response.render('index', {moduleInfo: moduleInfo})


    # render the user's page with all options
    app.get [/^\/(validate|request|response|handle)\/(.*)\/(\d+)/, /^\/(validate|request|response|handle)\/([^/]*)/], (req, res) ->
      method = req.params[0]   # validate, request, etc.
      endpoint = req.params[1] # query_item, add_item, etc.
      fixtureId = req.params[2] or null # 0, 1, etc.

      integration = helper.getIntegration(moduleInfo.integrations, endpoint, false)
      fixture = getFixture(integration.fixtures, method, fixtureId)
      extraVars = getExtraVars(integration)

      if fixture?
        values = fixture.res or flat.flatten(fixture.vars)
        values.extraVars = extraVars
        values.nockOptions = fixture.nockOptions
        values.env ?= {}
        fixture.envVariables.forEach (varName) ->
          values.env[varName] = 'dummy.value'

      else if method == 'response'
        # basic JSON template
        values =
          status: 200
          headers:
            "Content-Type": "application/json"
          body: "{  \"sample\": true }"

      else
        values = req
        values.env ?= {}

      res.render('method', {moduleInfo: moduleInfo, endpoint: integration, method: method, values: values, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: false})


    # todo: can this pattern be cleaned up here for just `handle`?
    app.post [/^\/(handle)\/(.*)\/(\d+)/, /^\/(handle)\/([^/]*)/], (req, res) ->
      method = req.params[0]
      endpoint = req.params[1]
      fixtureId = req.params[2] or null

      integration = helper.getIntegration(moduleInfo.integrations, endpoint, false)
      fixture = getFixture(integration.fixtures, method, fixtureId)
      extraVars = getExtraVars(integration)

      body = req.body
      vars = parseVars(lcTypesParser(integration.requestVariables()), body)
      vars = _.merge(vars, extraVars)

      nockOptions = _.merge(fixture?.nockOptions, vars.nockoptions)
      if fixture?
        body.nockOptions = fixture.nockOptions
        expected = fixture.expected

      body.extraVars = extraVars

      helper.invokeHandle integration[method], vars, nockOptions, (err, actual) ->
        result =
          actual: actual
          expected: expected or null
          matchedExpected: matchedExpected(method, actual, expected) if fixture?

        res.render('method', {moduleInfo: moduleInfo, endpoint: integration, method: method, values: body, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: result })


    app.post [/^\/(validate|request|response)\/(.*)\/(\d+)/, /^\/(validate|request|response)\/([^/]*)/], (req, res) ->
      method = req.params[0]
      endpoint = req.params[1]
      fixtureId = req.params[2] or null

      integration = helper.getIntegration(moduleInfo.integrations, endpoint, false)
      fixture = getFixture(integration.fixtures, method, fixtureId)
      extraVars = getExtraVars(integration)

      if method is 'response'
        response =
          status: req.body.status
          headers: req.body.header
          body: req.body.body

        try
          actual = integration[method]({}, {}, response)
        catch err
          actual = err.message

      else # method is 'validate' or 'request'
        response = req.body
        setupEnv(response)
        vars = parseVars(lcTypesParser(integration.requestVariables()), response)
        try
          actual = integration[method](vars)
        catch err
          actual = err.message

      expected = fixture.expected if fixture?

      response.extraVars = extraVars

      result =
        actual: actual
        expected: expected if fixture?
        matchedExpected: matchedExpected(method, actual, expected) if fixture?

      res.render('method', {moduleInfo: moduleInfo, endpoint: integration, method: method, values: response, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: result })


    app.listen 3000, () ->
      console.log "Harness for '#{moduleInfo.name}' started on http://localhost:3000"

