function SuperSimpleSIP(CONFIG) {

  const STATUS = {"REGISTERING": 0, "IDLE": 1, "RINGING": 2, "HANGING_UP": 3};
  const ALLOW_METHODS = "PRACK, INVITE, ACK, BYE, CANCEL, UPDATE, INFO, " +
    "SUBSCRIBE, NOTIFY, REFER, MESSAGE, OPTIONS";
  const DEFAULTS = {
    expiration: 300, // Duration of SIP session in seconds. May be replaced by server.
    expirationAdjust: -10, // Effective expiration timeout
    maxForwards: 70, // Maximum jumps between routers (see SIP protocol)
    debug: false,
    userAgent: "SuperSimpleSIP/" + require('./package.json').version,
  };

  let socket = null, aliveTimeout = null, ts = this, lastSeqNum = 0;
  let caller = null, phoneStatus = STATUS.REGISTERING;
  let listeners = {
    connected: function() {},
    disconnected: function() {},
    error: function() {},
    incomingCall: function() {},
    callCanceled: function() {}
  };

  // Validate config
  for (let i in DEFAULTS) {
    if (typeof CONFIG[i] == 'undefined') CONFIG[i] = DEFAULTS[i];
  }


  /**
   * Get random string
   * @param  {int}    length Length
   * @param  {string} dict   Dictionary
   * @return {string}        String
   */
  function getRandomString(length, dict) {
    let res = "";
    for (let i=0; i<length; i++) {
      res += dict.charAt(Math.floor(Math.random() * dict.length));
    }
    return res;
  }


  /**
   * Get random branch
   * @return {string} Branch
   */
  function getRandomBranch() {
    return "z9hG4bK" + getRandomString(34, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789");
  }


  /**
   * Get random tag
   * @return {string} Tag
   */
  function getRandomTag() {
    return getRandomString(32, "0123456789abcdef");
  }


  /**
   * Log
   * @param  {string} message Message
   */
  function log(message) {
    if (CONFIG.debug) console.log(message);
  }


  /**
   * Send welcome message
   */
  function sendWelcomeMsg() {
    let addr = socket.address();
    let welcomeMsg = new Buffer(
      `REGISTER sip:${CONFIG.server}:${CONFIG.port} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${addr.address}:${addr.port};rport;branch=${getRandomBranch()}\r\n` +
      `Max-Forwards: ${CONFIG.maxForwards}\r\n` +
      `From: "${CONFIG.user}" <sip:${CONFIG.user}@${CONFIG.realm}>;tag=${getRandomTag()}\r\n` +
      `To: "${CONFIG.user}" <sip:${CONFIG.user}@${CONFIG.realm}>\r\n` +
      `Call-ID: ${getRandomTag()}\r\n` +
      `CSeq: ${lastSeqNum} REGISTER\r\n` +
      `User-Agent: ${CONFIG.userAgent}\r\n` +
      `Contact: "${CONFIG.user}" <sip:${CONFIG.user}@${addr.address}:${addr.port};ob>\r\n` +
      `Expires: ${CONFIG.expiration}\r\n` +
      `Allow: ${ALLOW_METHODS}\r\n` +
      'Content-Length: 0\r\n\r\n'
    );
    socket.send(welcomeMsg, CONFIG.port, CONFIG.server);
  }


  /**
   * Attach alive timeout
   */
  function attachAliveTimeout() {
    if (aliveTimeout !== null) clearTimeout(aliveTimeout);
    aliveTimeout = setTimeout(function() {
      restartConnection();
    }, (CONFIG.expiration+CONFIG.expirationAdjust)*1000);
  }


  /**
   * Restart connection
   */
  function restartConnection() {
    // Set variables to default
    if (phoneStatus != STATUS.REGISTERING) listeners.disconnected();
    caller = null;
    phoneStatus = STATUS.REGISTERING;
    lastSeqNum++;

    // Attach alive timeout
    attachAliveTimeout();


    // Wait for server to accept the connection
    let acceptInterval = setInterval(() => {
      if (phoneStatus == STATUS.REGISTERING) {
        sendWelcomeMsg();
      } else {
        clearInterval(acceptInterval);
      }
    }, 1500);

    // Send welcome message
    sendWelcomeMsg();
  }


  /**
   * Acknowledge invite
   */
  function ackInvite() {
    if (phoneStatus == STATUS.IDLE) {
      log('New caller: ' + JSON.stringify(caller));
      phoneStatus = STATUS.RINGING;
      let tryingMsg = new Buffer(
        'SIP/2.0 100 Trying\r\n' +
        `Via: ${caller.via}\r\n` +
        `Call-ID: ${caller.callID}\r\n` +
        `From: ${caller.from}\r\n` +
        `To: ${caller.to}\r\n` +
        `CSeq: ${caller.cSeq}\r\n` +
        'Content-Length: 0\r\n\r\n'
      );
      socket.send(tryingMsg, CONFIG.port, CONFIG.server, () => {
        ackInvite();
        listeners.incomingCall(caller.number);
      });
    } else if (phoneStatus == STATUS.RINGING) {
      let addr = socket.address();
      let ringingMsg = new Buffer(
        'SIP/2.0 180 Ringing\r\n' +
        `Via: ${caller.via}\r\n` +
        `Call-ID: ${caller.callID}\r\n` +
        `From: ${caller.from}\r\n` +
        `To: ${caller.to};tag=${caller.tag}\r\n` +
        `CSeq: ${caller.cSeq}\r\n` +
        `Contact: "${CONFIG.user}" <sip:${CONFIG.user}@${addr.address}:${addr.port};ob>\r\n` +
        `Allow: ${ALLOW_METHODS}\r\n` +
        'Content-Length: 0\r\n\r\n'
      );
      socket.send(ringingMsg, CONFIG.port, CONFIG.server);
    } else if (phoneStatus == STATUS.HANGING_UP) {
      ts.hangUp();
    }
  }


  /**
   * Connect
   */
  this.connect = function() {
    if (socket !== null) throw new Error('Phone already connected');
    lastSeqNum = Math.floor(Math.random() * 99999999);

    // Create UDP socket
    const dgram = require('dgram');
    socket = dgram.createSocket('udp4');

    // Be ready to listen for messages
    socket.on('message', (buffer, rinfo) => {
      let headers = buffer.toString().split('\r\n\r\n')[0];
      if (headers.indexOf('INVITE') === 0) {
        // Extract data from headers
        let via = headers.split('Via: ')[1].split('\r\n')[0];
        via = via.replace(CONFIG.port + ';', CONFIG.port + ';received=' +
          CONFIG.server + ';');
        let callID = headers.split('Call-ID: ')[1].split('\r\n')[0];
        let from = headers.split('From: ')[1].split('\r\n')[0];
        let to = headers.split('To: ')[1].split('\r\n')[0];
        let cSeq = headers.split('CSeq: ')[1].split('\r\n')[0];
        let number = headers.split('P-Asserted-Identity: <sip:')[1].split('@')[0];

        // Update caller information
        if ((caller === null) || (caller.number !== number)) {
          log('Caller number has changed');
          phoneStatus = STATUS.IDLE; // As it is a new caller
          caller = {number: number, tag: getRandomTag()};
        }
        caller.via = via;
        caller.callID = callID;
        caller.from = from;
        caller.to = to;
        caller.cSeq = cSeq;

        // Answer SIP server
        ackInvite();
      } else if (headers.indexOf('ACK') === 0) {
        log('Server answered with an acknowledgement');
        restartConnection();
      } else if (headers.indexOf('200 OK') > -1) {
        phoneStatus = STATUS.IDLE;
        let expiresArray = headers.match(/;expires=([0-9]+)/g);
        let lastExpiration = CONFIG.expiration;
        for (let i in expiresArray) {
          let timeout = Number(expiresArray[i].split('=')[1]);
          if (timeout < CONFIG.expiration) CONFIG.expiration = timeout;
        }
        if (lastExpiration != CONFIG.expiration) {
          log(`Changed session expiration from ${lastExpiration} to ` +
            `${CONFIG.expiration} seconds`);
        }
        attachAliveTimeout();
        listeners.connected();
      } else if (headers.indexOf('CANCEL') === 0) {
        if (caller !== null) {
          caller = null;
          listeners.callCanceled();
          log('Called canceled the call');
        }
        phoneStatus = STATUS.IDLE;
        let okSeq = headers.split('CSeq: ')[1].split('\r\n')[0];
        let okVia = headers.split('Via: ')[1].split('\r\n')[0];
        let okFrom = headers.split('From: ')[1].split('\r\n')[0];
        let okTo = headers.split('To: ')[1].split('\r\n')[0];
        let okCallID = headers.split('Call-ID: ')[1].split('\r\n')[0];
        let addr = socket.address();
        let okMsg = new Buffer(
          'SIP/2.0 200 OK\r\n' +
          `Via: ${okVia}\r\n` +
          `From: ${okFrom}\r\n` +
          `To: ${okTo}\r\n` +
          `Call-ID: ${okCallID}\r\n` +
          `CSeq: ${okSeq}\r\n` +
          'Content-Length: 0\r\n\r\n'
        );
        socket.send(okMsg, CONFIG.port, CONFIG.server);
      }
    });

    // Listen for errors
    socket.on('error', (err) => {
      listeners.error(err);
    });

    // Send welcome message
    socket.on('listening', () => {
      restartConnection();
    });

    // Open socket
    socket.bind();
  };


  /**
   * Hang up
   */
  this.hangUp = function() {
    if (caller === null) return;
    phoneStatus = STATUS.HANGING_UP;
    let addr = socket.address();
    let declineMsg = new Buffer(
      'SIP/2.0 603 Decline\r\n' +
      `Via: ${caller.via}\r\n` +
      `Call-ID: ${caller.callID}\r\n` +
      `From: ${caller.from}\r\n` +
      `To: ${caller.to};tag=${caller.tag}\r\n` +
      `CSeq: ${caller.cSeq}\r\n` +
      `Allow: ${ALLOW_METHODS}\r\n` +
      'Content-Length: 0\r\n\r\n'
    );
    socket.send(declineMsg, CONFIG.port, CONFIG.server);
  }


  /**
   * Disconnect
   */
  this.disconnect = function() {
    if (aliveTimeout !== null) {
      clearTimeout(aliveTimeout);
      aliveTimeout = null;
    }
    if (socket !== null) socket.close();
    caller = null;
    phoneStatus = STATUS.IDLE;
    listeners.disconnected();
  };


  /**
   * On
   * @param  {string}   evnt     Event
   * @param  {Function} callback Callback
   */
  this.on = function(evnt, callback) {
    if (typeof listeners[evnt] == 'undefined') throw new Error('Invalid event');
    if (typeof callback !== 'function') throw new Error('Not a function');
    listeners[evnt] = callback;
  };


  /**
   * Is debug
   * @return {boolean} Debug
   */
  this.isDebug = function() {
    return CONFIG.debug;
  }

}

module.exports = SuperSimpleSIP;
