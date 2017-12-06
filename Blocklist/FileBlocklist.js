function FileBlocklist(path) {

  let numbers = null;

  function readFile(callback) {
    const fs = require('fs');
    fs.readFile(path, 'utf8', function (err, data) {
      if (err) throw new Error('Failed to open blocklist file');
      numbers = data.replace(/\r/g, '').replace(/#(.+)\n/g, '').trim().split('\n');
      callback();
    });
  }

  this.isSpam = function(number, callback) {
    if (numbers === null) {
      var ts = this;
      readFile(function() {
        ts.isSpam(number, callback);
      });
    } else {
      const numberParsed = require('./NumberUtils').toLocal(number);
      callback(
        (numbers.indexOf(number) > -1) || (numbers.indexOf(numberParsed) > -1)
      );
    }
  };

}

module.exports = FileBlocklist;
