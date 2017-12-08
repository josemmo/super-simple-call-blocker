// Show welcome message
const version = require('./package.json').version;
console.log(
  "   _____                          _____ _                 _      \n" +
  "  / ____|                        / ____(_)               | |     \n" +
  " | (___  _   _ _ __   ___ _ __  | (___  _ _ __ ___  _ __ | | ___ \n" +
  "  \\___ \\| | | | '_ \\ / _ \\ '__|  \\___ \\| | '_ ` _ \\| '_ \\| |/ _ \\\n" +
  "  ____) | |_| | |_) |  __/ |     ____) | | | | | | | |_) | |  __/\n" +
  " |_____/ \\__,_| .__/ \\___|_|    |_____/|_|_| |_| |_| .__/|_|\\___|\n" +
  "        _____ | |  _ _   ____  _            _      | |           \n" +
  "       / ____||_| | | | |  _ \\| |          | |     |_|           \n" +
  "      | |     __ _| | | | |_) | | ___   ___| | _____ _ __        \n" +
  "      | |    / _` | | | |  _ <| |/ _ \\ / __| |/ / _ \\ '__|       \n" +
  "      | |___| (_| | | | | |_) | | (_) | (__|   <  __/ |          \n" +
  "       \\_____\\__,_|_|_| |____/|_|\\___/ \\___|_|\\_\\___|_|   " +
  `v${version}\n`);

// Read arguments
let config = null;
let localBlocklistPath = null;
let logPath = null;
process.argv.forEach((val, i) => {
  if (i == 0) return;
  if ((val == '--blocklist') || (val == '-b')) {
    localBlocklistPath = process.argv[i+1];
  } else if ((val == '--config') || (val == '-c')) {
    let data;
    try {
      data = require('fs').readFileSync(process.argv[i+1]);
    } catch (e) {
      data = process.argv[i+1];
    }
    config = JSON.parse(data);
  } else if ((val == '--log') || (val == '-l')) {
    logPath = process.argv[i+1];
  } else if ((val == '--help') || (val == '-h')) {
    console.log(
      '--help or -h: show this screen\n' +
      '--blocklist [filepath] or -b [filepath]: set blocklist local file\n\n' +
      '  NOTE: this file should be in plain text format, containing a\n' +
      '  phone number per line, as shown in this example:\n\n' +
      '  # This is a text blocklist file\n' +
      '  # Lines starting with pound sign are omitted\n' +
      '  123456789\n' +
      '  +34987654321\n\n' +
      '--config [json_string] or -c [json_string]: set configuration object\n' +
      '--config [filepath] or -c [filepath]: set configuration file\n\n' +
      '  NOTE: configuration file should be formatted as JSON and have,\n' +
      '  at least, the following fields as shown in this example:\n\n' +
      '  {\n' +
      '    "server": "10.31.255.134",\n' +
      '    "port": 5070,\n' +
      '    "realm": "telefonica.net",\n' +
      '    "user": "911223344",\n' +
      '    "password": "911223344"\n' +
      '  }\n\n' +
      '--log [filepath] or -l [filepath]: set log file for incoming calls\n\n'
    );
    process.exit(0);
  }
});
if (config === null) {
  console.error('Missing configuration. Run --help for more information.');
  process.exit(0);
}

// Define functions
function log(msg) {
  if (logPath === null) return;
  let date = (new Date()).toJSON();
  require('fs').appendFileSync(logPath, date + '\t' + msg + '\n');
}

// Create blocklists
const ListaSpamBlocklist = require('./Blocklist/ListaSpamBlocklist');
const EsnumberBlocklist = require('./Blocklist/EsnumberBlocklist');
const PoolBlocklist = require('./Blocklist/PoolBlocklist');
let blocklistArray = [new ListaSpamBlocklist(), new EsnumberBlocklist()];
if (localBlocklistPath !== null) {
  const FileBlocklist = require('./Blocklist/FileBlocklist');
  blocklistArray.unshift(new FileBlocklist(localBlocklistPath));
}
let blocklist = new PoolBlocklist(blocklistArray);

// Create new phone
const SuperSimpleSIP = require('./SuperSimpleSIP');
let phone = new SuperSimpleSIP(config);

// Detect errors
phone.on('error', () => {
  console.error('[!] Failed to connect to SIP server. Check configuration file.');
  process.exit(1);
});

// Listen for incoming calls
phone.on('incomingCall', (number) => {
  console.log(`[i] Incoming call from ${number} . . .`);
  blocklist.isSpam(number, function(isSpam) {
    console.log(`[i] Spam analysis result for ${number}: ${isSpam}`);
    log(number + '\t' + (isSpam ? 'SPAM' : 'HAM'));
    if (isSpam) phone.hangUp();
  });
});

// Detect disconnections
let isShuttingDown = false;
phone.on('disconnected', () => {
  if (!isShuttingDown && phone.isDebug()) {
    console.log('[i] Session expired. Trying to reconnect . . .');
  }
});

// Connect to SIP server
let isFirstConnection = true;
phone.on('connected', () => {
  if (isFirstConnection) {
    isFirstConnection = false;
    console.log('[i] Phone connected! Press "q" whenever you want to quit.');
  } else if (phone.isDebug()) {
    console.log('[i] Session renewed');
  }
});
console.log('[i] Now connecting . . .');
phone.connect();

// Listen to STDIN keypress
const stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');
stdin.on('data', (key) => {
  if ((key === '\u0003') || (key === 'q') || (key === 'Q')) {
    console.log('[i] Now disconnecting . . .');
    isShuttingDown = true;
    phone.disconnect();
    process.exit(0);
  }
});
