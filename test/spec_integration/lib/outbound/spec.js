
const request = (vars) => {
  return {
    headers: {
      "Accept": "application/json",
      "Authorization": `key: ${process.env.SPEC_ENV_VAR}`
    },
    url: `https://activeprospect.com/leadconduit/`,
    method: 'POST',
    body: `Telefonnummer=${vars.lead.phone_1}`
  };
};


request.variables = () => [
  { name: 'lead.phone_1', type: 'phone', required: true, description: `Phone number, defaults to the lead's "Phone 1" field` }
];

const response = (vars, req, res) => {
  // default
  let responseData = {
    spec: {
      outcome: "success",
      billable: 1
    }
  };

  if(res.status == 500) {
    responseData.spec.outcome = "error";
    responseData.spec.billable = 0;
    responseData.spec.reason = "KABLOOEY";
  }
  else if(res.body.includes("bad")) {
    responseData.spec.outcome = "failure";
    responseData.spec.reason = "something bad happened";
  }

  return responseData;
};

response.variables = () => [
  { name: 'spec.outcome', type: 'string', description: 'The outcome of the post' },
  { name: 'spec.reason', type: 'string', description: 'If the outcome was not success, this is the reason' },
  { name: 'spec.billable', type: 'number', description: `The billable count. 1 if the event resulted in a valid outcome, or 0 if an error occured` },
  { name: 'spec.phone_status', type: 'string', description: 'Status of the phone number (Good, Bad, or Ugly)' }
];

const validate = (vars) => {
  if (!process.env.SPEC_ENV_VAR) throw new Error('Missing credentials, contact ActiveProspect Support');
  if (!vars.lead.phone_1 || !vars.lead.phone_1.valid) return 'A valid phone number is required';
};

module.exports = {
  request,
  response,
  validate,
  envVariables: ['SPEC_ENV_VAR']
};
