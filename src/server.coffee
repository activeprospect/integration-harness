path = require('path')
_ = require('lodash')
flat = require('flat')
express = require('express')
bodyParser = require('body-parser')
lcTypesParser = require('leadconduit-integration').test.types.parser
helper = require('./helper')
nock = require('nock')
assert = require('chai').assert


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


invokeHandle = (handle, vars, options, callback) ->

  return callback(null, { harness_error: 'no nock to catch handle() call' }) unless options?

  options = [options] unless _.isArray(options)
  nocks = options.map (option) ->
    nock(option.url)
      .intercept(option.query, option.verb)
      .reply(option.statusCode, option.responseData, option.headers)

  handle vars, (err, event) ->
    event ?= {}

    allNocksMet = nocks.every (aNock) ->
      if !aNock.isDone()
        event.nocks_unmet = []
        event.nocks_unmet.push(Object.keys(aNock.keyedInterceptors)[0])

      aNock.isDone()

    try
      nock.cleanAll()
      assert.isTrue allNocksMet
    catch e
      event.nocks_total = nocks.length

    callback(err, event)


module.exports =

  run: () ->
    moduleInfo =
      name: path.basename(process.cwd())

    loaded = helper.loadModule()

    app = express()

    # use __dirname paths to access harness' own files
    app.use(express.static(path.resolve(__dirname, 'public')))
    app.set('views', path.resolve(__dirname, 'views'))
    app.set('view engine', 'ejs')

    app.use(bodyParser.urlencoded({ extended: true }))

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
      else if method == 'response'
        values = {}
      else
        values = req

      res.render('method', {endpoint: integration, method: method, values: values, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: false})


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

      invokeHandle integration[method], vars, nockOptions, (err, actual) ->
        result =
          actual: actual
          expected: expected or null
          matchedExpected: matchedExpected(method, actual, expected) if fixture?

        res.render('method', {endpoint: integration, method: method, values: body, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: result })


    app.post [/^\/(validate|request|response)\/(.*)\/(\d+)/, /^\/(validate|request|response)\/([^/]*)/], (req, res) ->
      method = req.params[0]
      endpoint = req.params[1]
      fixtureId = req.params[2] or null

      integration = helper.getIntegration(moduleInfo.integrations, endpoint, false)
      fixture = getFixture(integration.fixtures, method, fixtureId)
      extraVars = getExtraVars(integration)

      if method is 'response'
        body = JSON.parse(req.body.response)
        try
          actual = integration[method]({}, {}, body)
        catch err
          actual = err.message

      else # method is 'validate' or 'request'
        body = req.body
        vars = parseVars(lcTypesParser(integration.requestVariables()), body)
        actual = integration[method](vars)

      expected = fixture.expected if fixture?

      body.extraVars = extraVars

      result =
        actual: actual
        expected: expected if fixture?
        matchedExpected: matchedExpected(method, actual, expected) if fixture?

      res.render('method', {endpoint: integration, method: method, values: body, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: result })


    app.listen 3000, () ->
      console.log "Harness for '#{moduleInfo.name}' started on http://localhost:3000"

