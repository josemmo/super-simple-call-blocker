function ListaSpamBlocklist() {

  this.isSpam = function(number, callback) {
    number = require('./NumberUtils').toLocal(number);
    const requestURL = 'https://www.listaspam.com/busca.php?Telefono=' +
      encodeURIComponent(number);
    const https = require('https');
    https.get(requestURL, (request) => {
      const { headers, method, url } = request;
      let body = [];
      request.on('error', (err) => {
        callback(false);
      }).on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        callback(body.indexOf('web-message phone_owner_detected">') > -1);
      });
    }).on('error', (e) => {
      callback(false);
    });
  };

}

module.exports = ListaSpamBlocklist;
