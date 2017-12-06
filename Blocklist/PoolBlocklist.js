function PoolBlocklist(blocklists) {

  this.isSpam = function(number, callback) {
    let index = 0;
    function checkItem() {
      if (index < blocklists.length) {
        blocklists[index].isSpam(number, function(res) {
          if (res) {
            callback(true);
          } else {
            index++;
            checkItem();
          }
        });
      } else {
        callback(false);
      }
    };
    checkItem();
  };

}

module.exports = PoolBlocklist;
