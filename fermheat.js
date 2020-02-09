var Wemo = require('wemo-client');
var wemo = new Wemo();
var util = require('util');
const fetch = require('node-fetch');
var https = require('https');
var http = require('http');
var HttpDispatcher = require('httpdispatcher');
var dispatcher = new HttpDispatcher();
var url = require('url');
var fs = require('fs');
var readFileAsync = util.promisify(fs.readFile);
var moment = require('moment');


var options = {
    devicehistoryFile: {
      tags: ["-dhf","--device_history_file"],
      value: "deviceHistory.json",
      type: "string",
      description: "Filename to save the device status history."
    },
    temphistoryFile: {
      tags: ["-thf","--temperature_history_file"],
      value: "temperatureHistory.json",
      type: "string",
      description: "Filename to save the temperature history."
    },
    server_port: {
      tags: ["-p","--server_port"],
      value: 8080,
      type: "integer",
      description: "Port to use for the web interface."
    },
    key: {
      tags: ["-k","--ssl_key"],
      value: undefined,
      type: "string",
      description: "Key to use for SSL for the Web interface."
    },
    cert: {
      tags: ["-cert","--ssl_cert"],
      value: undefined,
      type: "string",
      description: "Certificate to use for SSL for the Web interface."
    },
    targetDevice: {
      tags: ["-d","--target_device"],
      value: "fermheat",
      type: "string",
      description: "Wemo device name used to control the heat."
    },
    lowTemp: {
      tags: ["-l","--low_temp"],
      value: 75,
      type: "integer",
      description: "Low temperature value in fahrenheit used to trigger heat on."
    },
    highTemp: {
      tags: ["-h","--high_temp"],
      value: "80",
      type: "integer",
      description: "High temperature value in fahrenheit, used to trigger heat off."
    },
    interval: {
      tags: ["-i","--interval"],
      value: 60,
      type: "integer",
      description: "Interval in seconds to check the current temperature"
    },
    bControl: {
      tags: ["-c","--control_heat"],
      value: false,
      type: "bool",
      description: "Boolean value, if true will use wemo device to control heat, if false will monitor heat without activation."
    },
    tempUrl: {
      tags: ["-turl","--temperature_url"],
      value: "http://10.0.0.101:8888",
      type: "string",
      description: "URL of webservice to use to get the current temperature."
    }
};

var tempHistory = [];
var deviceHistory = []
var client;
var monitorLoop;

main();


function main() {

   processCommandline(process.argv,options);

   console.log("targetDevice= " + options.targetDevice.value);
   console.log("lowTemp= " + options.lowTemp.value);
   console.log("highTemp= " + options.highTemp.value);
   console.log("interval= " + options.interval.value);

   readHistoryFiles().then(function(result) {
      console.log("[main] " + result);
      wemo.discover(function(err, deviceInfo) {
         console.log('Wemo Device Found: ' + deviceInfo.friendlyName + " IP: " + deviceInfo.host + " Port: " + deviceInfo.port);

         if (deviceInfo.friendlyName == options.targetDevice.value) {
            console.log("*** Device Match: "  + deviceInfo.friendlyName);
            // Get the client for the found device
            client = wemo.client(deviceInfo);

            // You definitely want to listen to error events (e.g. device went offline),
            // Node will throw them as an exception if they are left unhandled
            client.on('error', function(err) {
                console.log('Error: %s', err.code);
            });

            // Handle BinaryState events
            client.on('binaryState', function(value) {
               console.log('Binary State changed to: %s', value);
               var deviceState = new Object();
               deviceState.state = parseInt(value);
               deviceState.time = formatTime(new Date());
               deviceHistory.push(deviceState);
               fs.appendFile(options.devicehistoryFile.value,JSON.stringify(deviceState)+'\n', function(err) {
                   if (err) {
                     console.log("[" + formatTime(d) + "] Error: " + err);
                   }
               });
            });
            monitorLoop = startMonitorControlLoop();
            configServer();
            startServer();
         }
     });
   })
   .catch(function(err) {
      console.log("[main] " + err);
   });
}


String.prototype.padFunction = function(padStr, len) {
   var str = this;
   while (str.length < len)
      str = padStr + str;
   return str;
}

function formatTime(d) {
  var tz = d.getTimezoneOffset() / -60;  /* getTimezoneOffset returns the offset in minutes and IMO has the positive negative reversed */
  return ( d.getFullYear()
                      + "-" + (d.getMonth()+1).toString(10).padFunction("0",2)
                      + "-" + d.getDate().toString(10).padFunction("0",2)
                      + "T" + d.getHours().toString(10).padFunction("0",2)
                      + ":" + d.getMinutes().toString(10).padFunction("0",2)
                      + ":" + d.getSeconds().toString(10).padFunction("0",2)
                      + (tz >= 0 ? "+" : "-")
                      + Math.abs(tz).toString(10).padFunction("0",2));
}

function startMonitorControlLoop() {

         /***************************************
           Let's not make this too complicated

           while (1) {
              sleep for interval - does node have a sleep?
              get temperature localhost:8888
              parse temp
              if temp < low point
                 wemo turn on fermheat
              if temp >= high point
                 wemo turn off fermheat
           }
           ***************************************/

          console.log("***** Starting heat loop (interval= " + options.interval.value + ")**********");
          console.log(formatTime(new Date()));

         return setInterval(function() {
            fetch(options.tempUrl.value).then(function(response) {
               return (response.json());
            }).then(function(temp) {
               var d = new Date();
               var currentTemp = new Object();

               console.log("[" + formatTime(d) + "] Temperature: " + temp.fahrenheit);
               currentTemp.temperature = temp.fahrenheit;
               currentTemp.time = formatTime(d);
               tempHistory.push(currentTemp);

               fs.appendFile(options.temphistoryFile.value,JSON.stringify(currentTemp)+'\n', function(err) {
                   if (err) {
                     console.log("[" + formatTime(d) + "] Error: " + err);
                   }
               });

               client.getBinaryState(function(err, strState) {
                   var state = parseInt(strState);
                   var deviceState = new Object();
                   var d = new Date();
                   console.log("[" + formatTime(d) + "] Device Status: " + (state ? "ON" : "OFF"));

                   deviceState.state = state;
                   deviceState.time = formatTime(d);
                   deviceHistory.push(deviceState);
                   fs.appendFile(options.devicehistoryFile.value,JSON.stringify(deviceState)+'\n', function(err) {
                       if (err) {
                         console.log("[" + formatTime(d) + "] Error: " + err);
                       }
                   });

                   if (options.bControl.value) {
                      if ( (currentTemp.temperature < options.lowTemp.value) && !deviceState.state) {
                        /* turn on */
                        console.log("[" + formatTime(d) + "] Temperature temperature too low turning on heat");
                        client.setBinaryState(1);
                      }

                      if ( (currentTemp.temperature > options.highTemp.value) && deviceState.state) {
                        /* turn off */
                        console.log("[" + formatTime(d) + "] Temperature temperature too high turning off heat");
                        client.setBinaryState(0);
                      }
                  }
               });
            })
            .catch(function(err) {
               console.log("[" + formatTime(d) + "] Error: " + err);
            });
        }, options.interval.value * 1000);
}


function startServer() {
      if ((options.key.value != undefined) &&
          (options.cert.value != undefined)) {
          /* HTTPS */
          const servopts = {
             key: options.key.value,
             cert: options.cert.value
          };
          console.log("[startServer]: SSL key and cert found, using HTTPS");
          server = https.createServer(servopts, handleRequest);
      }
      else    /* HTTP */
      {
          console.log("[startServer]: No SSL key and cert found, using HTTP");
          server = http.createServer(handleRequest);
      }

      server.listen(options.server_port.value, '::', function() {
         var d = new Date();
         console.log("[" + formatTime(d) + " startServer]: Server listening on port " + options.server_port.value);
      });
 }

 function handleRequest(request, response)
 {
   try {
       // Log request with date & time
       var d = new Date();
       console.log("[" + formatTime(d) + " handleRequest]: " + request.url);
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

function configServer() {

   dispatcher.setStatic('/resources');
   dispatcher.setStaticDirname('static');

   dispatcher.onGet("/temperature",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     res.writeHead(200, {'Content-Type': 'application/json'});

     if (tempHistory.length > 0) {
        res.end(JSON.stringify(tempHistory[tempHistory.length-1]));
     }
     else {
        res.end(JSON.stringify({temperature: "undefined", time: "undefined"}));
     }
   });

   dispatcher.onGet("/device",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     res.writeHead(200, {'Content-Type': 'application/json'});

     if (deviceHistory.length > 0) {
        res.end(JSON.stringify(deviceHistory[deviceHistory.length-1]));
     }
     else {
        res.end(JSON.stringify({state: "undefined", time: "undefined"}));
     }
   });

   dispatcher.onGet("/device/on",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');

     var d = new Date();
     if (client) {
        console.log("[" + formatTime(d) + "] Turning on heat from API request");
        client.setBinaryState(1);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({time: formatTime(d), state: 1}));
     }
     else {
       console.log("[" + formatTime(d) + "] API request to turn on heat failed, client undefined");
       res.writeHead(400, {'Content-Type': 'application/json'});
       res.end(JSON.stringify(deviceHistory[deviceHistory.length-1]));
     }
   });

   dispatcher.onGet("/device/off",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     var d = new Date();
     if (client) {
        console.log("[" + formatTime(d) + "] Turning off heat from API request");
        client.setBinaryState(0);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({time: formatTime(d), state: 0}))
     }
     else {
       console.log("[" + formatTime(d) + "] API request to turn off heat failed, client undefined");
       res.writeHead(400, {'Content-Type': 'application/json'});
       res.end(JSON.stringify(deviceHistory[deviceHistory.length-1]));
     }
   });

   dispatcher.onGet("/temperature/history",function(req,res) {
     var parsedUrl = url.parse(req.url,true);

     /* query string parameters can be used to limit the history data returned
        all options are optional:
          - duration is in hours
          - if no parameters, return all data
          - if start and end are provided, duration is ignored
          - if only start, return from start to current end
          - if only duration, return from end-duration to current end
          - if only end, return all history up to end
     */
     returnFilteredList(tempHistory,
                        parsedUrl.query.duration,
                        parsedUrl.query.start,
                        parsedUrl.query.end,
                        res);
   });

   dispatcher.onGet("/device/history",function(req,res) {

     var parsedUrl = url.parse(req.url,true);
     /* query string parameters can be used to limit the history data returned
       all options are optional:
          - duration is in hours
          - if no parameters, return all data
          - if start and end are provided, duration is ignored
          - if only start, return from start to current end
          - if only duration, return from end-duration to current end
          - if only end, return all history up to end
     */
     returnFilteredList(deviceHistory,
                        parsedUrl.query.duration,
                        parsedUrl.query.start,
                        parsedUrl.query.end,
                        res);


   });

   dispatcher.onGet("/options",function(req,res) {
     res.setHeader('Cache-Control','max-age=0');
     res.writeHead(200, {'Content-Type': 'application/json'});

     res.end(JSON.stringify({highTemp: options.highTemp.value, lowTemp: options.lowTemp.value, interval: options.interval.value, targetDevice: options.targetDevice.value}));
   });

   dispatcher.onPost("/options/set",function(req,res) {
     var err;
     var d = new Date();

     /* what about a try / catch block?? */
     if (req.body) {
        var new_options = JSON.parse(req.body);
        if (new_options) {
           for (key in new_options) {
               if (options[key]) {
                 console.log("[" + formatTime(d) + "] Setting option, key= " + key + " value= " + new_options[key]);
                 switch (options[key].type) {
                     case 'string':
                        options[key].value = new_options[key];
                     break;

                     case 'bool':
                        options[key].value = (new_options[key] == "true" || new_options[key] == "1" ? true : false);
                     break;

                     case 'integer':
                        options[key].value = parseInt(new_options[key]);
                     break;

                     case 'float':
                        options[key].value = parseFloat(new_options[key]);
                     break;
                }
                if (key == 'interval') {
                   console.log("[" + formatTime(d) + "] Restarting heat loop");
                   clearInterval(monitorLoop);
                   monitorLoop = startMonitorControlLoop();
                }
              }
              else {
                 err = "Bad Key";
              }
           }
        }
        else {
           err = "JSON parsing error"
        }
     }

     if (err == undefined) {
        res.setHeader('Cache-Control','max-age=0');
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({highTemp: options.highTemp.value, lowTemp: options.lowTemp.value, interval: options.interval.value, targetDevice: options.targetDevice.value}));
     }
     else {
        res.setHeader('Cache-Control','max-age=0');
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({Error: err}));
     }
   });
}

function returnFilteredList(list, duration, start, end, res) {
   if (duration) {
      if (!start) {
         if (!end) {
             /* if only duration, return from end minus duration to end */
             end = list[list.length-1].time;
         }
         /* duration and end, no start */
         start = moment(end).clone().subtract(parseInt(duration,10),'hours').format();
      }
      else if (!end) {
         /* duration and start, no end */
         end = moment(start).clone().add(parseInt(duration,10),'hours').format();
      }
   }
   else {
     if (!start) {
        if (end) {
            /* end but no duration, no start return all history to end */
            start = list[0].time;
        }
        /* if !end - no parameters, return all history */
     }
     else if (!end) {
        /* start but no duration, no end return history from start to current end */
        end = deviceHistory[deviceHistory.length-1].time;
     }
   }
   res.setHeader('Cache-Control','max-age=0');
   res.writeHead(200, {'Content-Type': 'application/json'});

   if (!start || !end) {
     res.end(JSON.stringify(list));
   }
   else {
     var stDate = moment(start);
     var endDate = moment(end);
     
     res.end(JSON.stringify(list.slice(findDate(list,0,list.length-1,stDate)).filter(function(item) {
         var t = moment(item.time);
         if (t >= stDate && t <= endDate ) return true;
         return false;
     })));
   }
}

function findDate(list,start,end,date) {
    /* binary search to find entry in the array list that "matches" date
         - I don't need an exact match, just closest Date
         - could I pass in a function of the test??
    */
    var index = start + Math.floor((end - start) / 2);
    //console.log("findDate: " + index + "," + start + "," + end + "," + date.format());

    if (index < 0 || index > end) {
       return 0;
    }

    var indexTime = moment(list[index].time);
    if (index > 0) {
       var prevTime = moment(list[index-1].time);
    }

    if ( (date == indexTime) ||
         (index == 0 && date < indexTime) ||
         (date > prevTime && date < indexTime) )
    {
       return index;
    }
    else if (date > indexTime) {
       return findDate(list,index+1,end,date);
    }
    else if (date < indexTime) {
       return findDate(list,start,index-1,date);
    }
}

function processCommandline(argv, options) {
   if (argv && options) {
       var i = 0;
       while (i < argv.length) {
          if ( (key = findOption(options, argv[i])) != undefined )
             switch (options[key].type) {
                 case 'string':
                    options[key].value = argv[++i];
                 break;

                 case 'bool':
                    options[key].value = true;
                 break;

                 case 'integer':
                    options[key].value = parseInt(argv[++i]);
                 break;

                 case 'float':
                    options[key].value = parseFloat(argv[++i]);
                 break;
            }
            i++;
        }
   }
}

function findOption(options, tag) {
    for (var key in options) {
        if (options[key].tags.includes(tag)) {
           return key;
        }
    }
    return undefined;
}

function readHistoryFiles() {
   return new Promise(function(resolve, reject) {
		   readJsonFile(options.temphistoryFile.value).then(function(tdata) {
          tempHistory = tdata;
          return readJsonFile(options.devicehistoryFile.value);
		   })
       .then(function(ddata) {
          deviceHistory = ddata;
          resolve("History data read");
       })
		   .catch(function(err) {
		      console.log("[readHistoryFiles]: Error reading file " + err);

          /* Still calling resolve, not need to reject if there is not History
             that is ok */
          resolve("Error reading history data");
		   });
   });
}

function readJsonFile(path) {
   if (path) {
      return readFileAsync(path,'utf8').then(function(data) {
         /* Split data by line breaks */
          var datalines = data.split(/\n|\r\n/);
          console.log("[readJsonFile] Path: " + path + " Number of lines: " + datalines.length);
          var results = [];
          for (var rindex = 0; rindex < datalines.length; rindex++) {
             if (datalines[rindex] != "") {
                results[rindex] = JSON.parse(datalines[rindex]);
             }
          }
          return (results);
      })
      .catch(function(err) {
         console.log("[readJsonFile]: Error reading " + path + " " + err);
         throw err
      });
   }
}
