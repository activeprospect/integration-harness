path = require('path')
_ = require('lodash')
flat = require('flat')
express = require('express')
bodyParser = require('body-parser')
lcTypesParser = require('leadconduit-integration').test.types.parser
helper = require('./helper')
assert = require('assert')


matchedExpected = (method, actual, expected) ->
  matched = true
  try
    assert.deepEqual(actual, expected)
  catch e
    matched = false

  matched


deleteBlanks = (obj) ->
  for k, v of obj
    delete obj[k] if v is ''

  obj


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


    app.get '/handle/:endpoint', (req, res) ->
      res.status(404).send('Handle support not yet implemented :-(')


    app.get [/^\/(validate|request|response)\/(.*)\/(\d+)/, /^\/(validate|request|response)\/([^/]*)/], (req, res) ->
      method = req.params[0]
      endpoint = req.params[1]
      fixtureId = req.params[2] or null

      integration = helper.getIntegration(moduleInfo.integrations, endpoint, false)

      if fixtureId and integration.fixtures?[method]?[fixtureId]?
        values = flat.flatten(integration.fixtures[method][fixtureId].vars) or integration.fixtures[method][fixtureId].res
        values.extraVars = flat.flatten(integration.fixtures[method][fixtureId].extra_vars) if integration.fixtures[method][fixtureId].extra_vars
      else if method == 'response'
        values = {}
      else
        values = req

      res.render('method', {endpoint: integration, method: method, values: values, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: false})


    app.post [/^\/(validate|request|response)\/(.*)\/(\d+)/, /^\/(validate|request|response)\/([^/]*)/], (req, res) ->
      method = req.params[0]
      endpoint = req.params[1]
      fixtureId = req.params[2] or null

      integration = helper.getIntegration(moduleInfo.integrations, endpoint, false)

      if method is 'response'
        body = JSON.parse(req.body.response)
        try
          actual = integration[method]({}, {}, body)
        catch err
          actual = err.message
      else
        body = req.body
        bodyObj = flat.unflatten(deleteBlanks(body))
        bodyObj.lead = {} unless bodyObj.lead? # every vars at least has `.lead`

        parser = lcTypesParser(integration.requestVariables())
        actual = integration[method](parser bodyObj)

      if fixtureId and integration.fixtures?[method]?[fixtureId]?
        fixture = integration.fixtures?[method][fixtureId]
        expected = fixture.expected
        body.extraVars = flat.flatten(fixture.extra_vars) if fixture.extra_vars

      result =
        actual: actual
        expected: expected if fixtureId
        matchedExpected: matchedExpected(method, actual, expected) if fixtureId

      res.render('method', {endpoint: integration, method: method, values: body, fixtures: integration.fixtures?[method], fixtureId: fixtureId, result: result })


    app.listen 3000, () ->
      console.log "Harness for '#{moduleInfo.name}' started on http://localhost:3000"

