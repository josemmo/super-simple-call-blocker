# Super Simple Call Blocker

## What is this?
Super Simple Call Blocker is a small executable written in JavaScript that aims to block all spam or unwanted calls directed to your landline phone.

It works by connecting to your ISP servers using the [SIP protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol) and emulating a VOIP phone.

## How do I use it?
1. First, [download the latest release](https://github.com/josemmo/super-simple-call-blocker/releases/latest) from GitHub (Windows, Linux or Mac)
2. Create a valid configuration file (see next section for more info)
3. Run `sscb --config path-to-your-config-file.json` from a terminal

## How do I make it work?
A valid configuration file written in JSON is needed for the executable to be ran. Here is a basic example with all required fields needed to connect to a SIP server:

```javascript
{
  "server": "10.31.255.134",
  "port": 5070,
  "realm": "telefonica.net",
  "user": "911223344",
  "password": "911223344"
}
```

The rest optional fields with their respective default values are the following:

```javascript
{
  "expiration": 300,  // Duration of SIP session in seconds
  "pingInterval": 10, // Seconds between ping to server
  "debug": false,     // Show or hide debug messages
  "userAgent": "SuperSimpleSIP/[version]"
}
```

## What numbers does it block?
At the moment, Super Simple Call Blocker connects to the following websites to check whether the phone is known to be a spam caller:

- [ListaSpam.com](https://www.listaspam.com)
- [esnumber.com](http://www.esnumber.com/)

It is also possible to specify a local blocklist of numbers by creating a text file:

```
# This is a text blocklist file
# Lines starting with pound sign are omitted
123456789
+34987654321
```

Note that the path to the blocklist needs to be set with `--blocklist path-to-the-blocklist.txt`.

## How do I compile it myself?
1. Download the source code using `npm install https://github.com/josemmo/super-simple-call-blocker.git`
2. Run `npm run build`
