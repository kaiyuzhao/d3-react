/* node built-ins */
import assert from 'assert';

/* npm modules */
import 'whatwg-fetch';

'use strict';

const service_url = 'http://github-search-prod-1991323166.us-west-2.elb.amazonaws.com';
const api_key = '7e3fc01c-a3e9-46d9-bc8e-4aa6794bb97b';

function query(endpoint, data, cb) {
  fetch(`${service_url}/query/${endpoint}`,
    {
      method: 'POST',
      body: JSON.stringify({
        'api_key': api_key,
        'data': data
      })
    }
  )
  .then(res => res.json())
  .then(cb);
}

export default {
  getNeighbors: (name, cb) => {
    assert(name);
    if (name.indexOf('/') === -1) {
      // user query
      query('user_neigh', {user_name: name}, data => cb(data.response));
    } else {
      // repo query
      query('neigh_search', {query_repo: name}, data => cb(data.response));
    }
  }
};
