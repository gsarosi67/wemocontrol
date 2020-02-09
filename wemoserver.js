var Wemo = require('wemo-client');
var util = require('util');
var https = require('https');
var http = require('http');
var HttpDispatcher = require('httpdispatcher');
var dispatcher = new HttpDispatcher();
var url = require('url');

var wemo = new Wemo();
var discoveredDevices = [];

/*
var targetDevice = process.argv[2];
var command = process.argv[3];
*/
findDevices();
configServer();
startServer();

function findDevices() {
  wemo.discover(function(err, deviceInfo) {
    console.log('Wemo Device Found: ' + deviceInfo.friendlyName + " IP: " + deviceInfo.host + " Port: " + deviceInfo.port);

    //if (deviceInfo.friendlyName == targetDevice) {

       var device = new Object();

       device.info = deviceInfo;

       // Get the client for the found device
       device.client = wemo.client(deviceInfo);

       // You definitely want to listen to error events (e.g. device went offline),
       // Node will throw them as an exception if they are left unhandled
       device.client.on('error', function(err) {
           console.log('Device: %s Error: %s', device.client.friendlyName, err.code);
       });

       // Handle BinaryState events
       device.client.on('binaryState', function(value) {
          console.log('Device: %s Binary State changed to: %s', device.client.friendlyName, value);
       });

       discoveredDevices.push(device);
    //}
  });
}

function startServer() {
      /* Get the port from an environment variable */
      if (process.env.WEMO_CONTROL_PORT != undefined) {
         PORT = process.env.WEMO_CONTROL_PORT;
      }
      else {
         console.error("[startServer]: Error: WEMO_CONTROL_PORT must be set");
      }

      if ((process.env.WEMO_CONTROL_KEY != undefined) &&
          (process.env.WEMO_CONTROL_CERT != undefined)) {
          /* HTTPS */
          const options = {
             key: process.env.WEMO_CONTROL_KEY,
             cert: process.env.WEMO_CONTROL_CERT
          };
          console.log("[startServer]: SSL key and cert found, using HTTPS");
          server = https.createServer(options, handleRequest);
      }
      else    /* HTTP */
      {
          console.log("[startServer]: No SSL key and cert found, using HTTP");
          server = http.createServer(handleRequest);
      }

      server.listen(PORT, '::', function() {
         console.log("[startServer]: Server listening on port " + PORT);
      });
 }

 function handleRequest(request, response)
 {
   try {
       // Log request with date & time
       var d = new Date();
       console.log("[handleRequest " + d.toLocaleString() + " ]: " + request.url);
       // Set CORS headers
       response.setHeader('Access-Control-Allow-Origin', '*');
       response.setHeader('Access-Control-Request-Method', '*');
       response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
       response.setHeader('Access-Control-Allow-Headers', '*');
       if ( request.method === 'OPTIONS' ) {
          response.writeHead(200);
          response.end();
          return;
       }

       dispatcher.dispatch(request, response);
   } catch(err) {
       console.log("[handleRequest]: " + err);
   }
}

function configServer()
{
   /* Commands:
    *
    * /devices - list of found device names
    * /device/{devicename} - deviceinfo for {devicename}
    * /device/{devicename}/status - status (on/off) for {devicename}
    * /device/{devicename}/on
    * /device/{devicename}/off
    *
    * How does onGet work with a Rest style interface? Should be simple
    */

   dispatcher.onGet("/devices",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     res.writeHead(200, {'Content-Type': 'application/json'});

     /* Create simple list of devices */
     var deviceList = discoveredDevices.map(function(device) {
         //console.log(device);
         return (
           {
              friendlyName: device.info.friendlyName,
              host: device.info.host,
              port: device.info.port,
              modelName: device.info.modelName,
              modelDescription: device.info.modelDescription
           });
     });
     //console.log(deviceList);
     res.end(JSON.stringify(deviceList));
   });

   dispatcher.beforeFilter(/\//, function(req, res, chain) { //any url
        console.log("Before filter");
        console.log("url: " + req.url)
        chain.next(req, res, chain);
   });

   dispatcher.beforeFilter(/\/device/, function(req, res, chain) { 
        console.log("Before device filter");
        console.log("url: " + req.url)
        chain.next(req, res, chain);
   });

   dispatcher.afterFilter(/\//, function(req, res, chain) { //any url
        console.log("After filter");
        console.log("url: " + req.url)
        chain.next(req, res, chain);
   });

   dispatcher.onGet("/device",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     res.writeHead(200, {'Content-Type': 'application/json'});

     console.log("url: " + req.url);

     res.end(JSON.stringify({api: "device"}));
   });

   dispatcher.onGet("/test",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     res.writeHead(200, {'Content-Type': 'application/json'});

     console.log("url: " + req.url);

     res.end(JSON.stringify({api: "device"}));
   });

   dispatcher.onGet("test",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     res.writeHead(200, {'Content-Type': 'application/json'});

     console.log("url: " + req.url);

     res.end(JSON.stringify({api: "device"}));
   });
}
