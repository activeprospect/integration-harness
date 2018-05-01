
# leadconduit-harness

A LeadConduit integration run/test utility

This integration harness can be used in several ways:

1. Run the command-line version that performs a stock suite of basic module format tests out of the box
2. Run a simple web UI to interact with an integration's functions (`validate()`, `request()`, `response()`, and `handle()`) and "rich UI"
3. Extend the basic tests by writing harness fixtures specific to an integration. These are plain data files, written in YAML, which are available to both the command-line and the web UI.

## Installation

Run `npm -g install leadconduit-harness`.

Now, for it to be of any use, you'll need a LeadConduit integration module. Depending on your use case, you can either clone a repo from Github, or install the module from NPM. In the former case, you'll need to be sure to run `npm install` after you clone or update the repo.

### Github example

1. `git clone git@github.com:activeprospect/leadconduit-integration-trustedform.git`
2. `cd leadconduit-integration-trustedform/`
3. `npm install`
4. `harness` (or, `harness --server`, see below)


### NPM example

1. `npm install leadconduit-trustedform`
2. `cd node_modules/leadconduit-trustedform/`
3. `harness` (or, `harness --server`, see below)


## Command-line

Once installed, you can execute a baseline set of sanity-check tests by running `harness` in the directory where your integration is checked out. This suite of basic tests should all be green & passing out of the box. It also can be customized with integration-specific checks via YAML fixtures, described below.

### baseline test suite

When no fixture definitions are found (see below), the harness will apply a suite of baseline tests with the bare minimum mock data structures.

When these tests fail, it may be due to a problem or a violation of standards. Or, it may mean that the skeletal data structure used for testing isn't close enough to what the integration expects.

For example, the data used to test a basic `response()` function (in a request/response-style integration) is:

```json
{
  "headers": {
    "Content-Type": "application/json"
  },
  "status": 200,
  "body": "{}"
}
```

If the integration being tested assumes it will always get a JSON _array_ with a 200 response, for example, this will result in a failed test or two. To address this, you can either code the `response()` function more defensively, or add integration-specific fixtures with more correct data (or both).

## Web UI

Tests can also be run interactively, via a web UI. From the directory where the integration is checked out, run `harness --server` to start up the server, then visit [http://localhost:3000](http://localhost:3000). You'll be presented with links to access the various aspects of the integration module: run methods like `validate()`, `request()`, and `response()`, or launch the module's UI, if applicable.

If the integration's rich UI isn't styled as it would be in the app, a quick-and-dirty hack is to add this line to the `<head>` tag of the integration's `/lib/ui/public/index.html`. Just remember to remove it before committing or publishing!

```html
  <link href="/lc-client.css" rel="stylesheet">
```

## Fixtures

Test fixtures can be written for your integration, which are used by both the command-line runner and the web UI. This utility looks for and executes all of the YAML file fixture definitions it finds in the `harness` subdirectory of the given integration.


### Format of a YAML fixture file

The first level keys match the core functions of a standard "request/response" integration: `validate()`, `request()`, and `response()`. They are arrays, each element representing one test case, separated by a line with just a dash (`-`). Within each, test inputs and expected outputs are defined, which the harness will use to test each function.

A value for `should` can optionally be included with each case. This is helpful for self-documenting, describing the cases in the UI view, and providing feedback in the command-line output.

As in the integration code itself, the inputs for `validate()` and `request()` are called `vars`, while for `response()` the input - representing a server response, not the `vars` snowball - is instead called `res`. For all three, the expected return data is called `expected`. (If the expectation is that nothing should be returned, as with a call to `validate()` that passes all validation checks, then `expected` should not be defined.)

If extra data is needed for `request()` that isn't available on `vars`, such as API keys or timestamps, those can be set as `extra_vars`.

Example:

```yaml
validate:
-
  vars:
    list_names: cranberries
    value: delores@cranberries.com
  envVariables:
    - AN_EXTERNAL_API_KEY
-
  vars:
    list_names: cranberries
  envVariables:
    - AN_EXTERNAL_API_KEY
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
  # found [comments, if needed]
  should: parse JSON body
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

- multiline body strings (e.g., JSON) can be written in a nice, readable way like this:

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

## Tips

- The harness loads code from `lib`, so if you're working with an old CoffeeScript integration, don't forget to re-run `cake build` whenever you change the code, and before running `harness`.
- If you're working on a UI, enable automatic [webpack](https://webpack.js.org/) re-compilation by deleting `lib/ui/public/dist/index.js` (either manually or via `npm run-script postpublish`).
