# Readme

## installation

- until published on npm, install like this:

 1. clone this repo
 2. run `grunt` (you may need to install the grunt command-line interface first, e.g.: `sudo npm uninstall -g grunt-cli`)
 3. run `npm link`

After that, you should be able to run the utility `harness` in another directory (e.g., an integration repo directory).

- remember to `cake build` your integration module after each code change and before running `harness` (it loads code-under-test from `lib`)

- _todo: document how harness.json overrides work_

## command-line usage

Run the utility `harness` to run a suite of simple, sanity-check level tests. These can (and should) be customized with integration-specific checks in `harness.json`, described below.

## webserver usage

Use the command-line option `--server` to have the harness skip automatic tests and instead run an interactive server on [localhost](http://localhost:3000).

## format of `harness.json`

Each integration repo can have its own `harness.json`, located in the existing test directory `spec`. An example, from `leadconduit-suppressionlist`, is below.

The first level keys match the core functions of a standard "request/response" integration: `validate()`, `request()`, and `response()`. They are arrays, each element representing one test case. Within each, test inputs and expected outputs are defined, which the harness will use to test each function.

As in the integration code itself, the inputs for `validate()` and `request()` are called `vars`, while for `response()` the input - representing a server response, not the `vars` snowball - is instead called `res`. For all three, the expected return data is called `expected`. (If the expectation is that nothing should be returned, as with a call to `validate()` that passes all validation checks, then `expected` should not be defined.)

If extra data is needed for `request()` that isn't available on `vars`, such as API keys or timestamps, those can be set as `extra_vars`.

```json
{
  "validate": [
    {
      "vars": {
        "list_names": "cranberries",
        "values": "delores@cranberries.com"
      }
    },
    {
      "vars": {"list_names": "cranberries"},
      "expected": "values must not be blank"
    },
    {
      "vars": {"values": "delores@cranberries.com"},
      "expected": "a list name is required"
    }
  ],
  "request": [
    {
      "vars": {
        "list_names": "my_list",
        "values": "foo@bar.com"
      },
      "extra_vars": {"activeprospect": {"api_key": "foo"}},
      "expected": {
        "headers": {
          "Accept": "application/json",
          "Authorization": "Basic WDpmb28="
        },
        "method": "GET",
        "url": "https://app.suppressionlist.com/exists/my_list/foo@bar.com"
      }
    }
  ],
  "response": [
    {
      "res": {
        "headers": {"Content-Type": "application/json"},
        "status": 200,
        "body": "{}"
      },
      "expected": {
        "query_item": {
          "outcome": "success",
          "reason": null
        }
      }
    }
  ]
}
```