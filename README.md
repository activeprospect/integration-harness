
# leadconduit-harness
LeadConduit integration run/test utility

## Installation

Until published on npm, install like this:

 1. clone this repo
 2. run `grunt` (you may need to install the grunt command-line interface first, e.g.: `sudo npm install -g grunt-cli`)
 3. run `npm link`

After that, you should be able to run the utility `harness` in another directory (e.g., an integration repo directory).

- _todo: document how harness.json overrides work_

## Command-line

Once installed, you can execute a baseline set of sanity-check tests by running `harness` in the directory where your integration is checked out. This suite of basic tests should all be green & passing out of the box. It also can (and should) be customized with integration-specific checks via YAML fixtures, described below.

## Web UI

Tests can also be run interactively, via a web UI. From the directory where the integration is checked out, run `harness --server` to start up the server, and visit [http://localhost:3000](http://localhost:3000). You will be presented with links to access the various aspects of the integration module.

## Fixtures

Test fixtures can be written for your integration, which are used by both the command-line runner and the web UI. This utility looks for and executes all of the YAML file fixture definitions it finds in the `harness` subdirectory of the given integration.


### Format of a YAML fixture file

The first level keys match the core functions of a standard "request/response" integration: `validate()`, `request()`, and `response()`. They are arrays, each element representing one test case, separated by a line with just a dash (`-`). Within each, test inputs and expected outputs are defined, which the harness will use to test each function.

As in the integration code itself, the inputs for `validate()` and `request()` are called `vars`, while for `response()` the input - representing a server response, not the `vars` snowball - is instead called `res`. For all three, the expected return data is called `expected`. (If the expectation is that nothing should be returned, as with a call to `validate()` that passes all validation checks, then `expected` should not be defined.)

If extra data is needed for `request()` that isn't available on `vars`, such as API keys or timestamps, those can be set as `extra_vars`.

Example:

```yaml
validate:
-
  vars:
    list_names: cranberries
    value: delores@cranberries.com
-
  vars:
    list_names: cranberries
  expected: values must not be blank

request:
-
  vars:
    list_names: my_list
    value: foo@bar.com
  expected:
    headers:
      Accept: application/json
      Authorization: Basic WDpmb28=
    method: GET
    url: https://app.suppressionlist.com/exists/my_list/foo%40bar.com

response:
-
  # found
  res:
    headers:
      Content-Type: application/json
    status: 200
    body: >
      {
        "specified_lists": ["list_1", "list_2", "list_3"],
        "key": "taylor@activeprospect.com",
        "found": true,
        "exists_in_lists": ["list_2", "list_3"],
        "entries": [
          {
            "list_id" : "558dbd69021823dc0b000001",
            "list_url_name" : "list_2",
            "added_at" : "2015-08-27T16:18:16Z"
          },
          {
            "list_id" : "558dbd69021823dc0b000002",
            "list_url_name" : "list_3",
            "added_at" : "2015-08-28T16:18:16Z"
          }
        ]
      }
  expected:
    query_item:
      specified_lists:
        - list_1
        - list_2
        - list_3
      key: taylor@activeprospect.com
      found: true
      outcome: success
      reason: null
      found_in:
        - list_2
        - list_3
      added_at: '2015-08-28T16:18:16Z'

extra_vars:
  activeprospect:
    api_key: foo
```

- _future:_ option to run only baseline tests even when fixtures are present

### YAML Syntax Tips

- body strings (e.g., JSON):

```
body: >
  {
    email: 'test@activeprospect.com',
    state: 'TX'
  }
```

- an alternate string syntax, that will "chomp" newlines (e.g., if a test's comparision is failing because of a trailing `\n`):

```
body: |-
  {"email":"test@activeprospect.com","state":"TX"}
```

## Gotchas

- The harness loads code from `lib`, so if you're working with an old CoffeeScript integration, don't forget to re-run `cake build` whenever you change the code, and before running `harness`.
