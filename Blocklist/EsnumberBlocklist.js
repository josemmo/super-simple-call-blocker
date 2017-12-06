function EsnumberBlocklist() {

  this.isSpam = function(number, callback) {
    number = require('./NumberUtils').toLocal(number);
    const requestURL = 'http://www.esnumber.com/telefono/' + encodeURIComponent(number);
    const http = require('http');
    http.get(requestURL, (request) => {
      const { headers, method, url } = request;
      let body = [];
      request.on('error', (err) => {
        callback(false);
      }).on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        callback(body.indexOf('<td><img src="/img/red.jpg"') > -1);
      });
    }).on('error', (e) => {
      callback(false);
    });
  };

}

module.exports = EsnumberBlocklist;
