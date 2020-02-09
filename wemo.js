var Wemo = require('wemo-client');
var wemo = new Wemo();

var targetDevice = process.argv[2];
var command = process.argv[3];

wemo.discover(function(err, deviceInfo) {
  console.log('Wemo Device Found: ' + deviceInfo.friendlyName + " IP: " + deviceInfo.host + " Port: " + deviceInfo.port);

  if (deviceInfo.friendlyName == targetDevice) {
     // Get the client for the found device
     var client = wemo.client(deviceInfo);

     // You definitely want to listen to error events (e.g. device went offline),
     // Node will throw them as an exception if they are left unhandled
     client.on('error', function(err) {
         console.log('Error: %s', err.code);
     });

     // Handle BinaryState events
     client.on('binaryState', function(value) {
        console.log('Binary State changed to: %s', value);
     });

     switch (command) {
         case "status":
         case "state":
            client.getBinaryState(function(err, state) {
               console.log("Device Status: " + state);
            });
         break;

         case "on":
            client.setBinaryState(1);
         break;

         case "off":
            client.setBinaryState(0);
         break;
     }
     //process.exit(0);
  }
});
