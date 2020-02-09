var fs = require('fs'); 
var util = require('util');
var readFileAsync = util.promisify(fs.readFile);
var moment = require('moment');

readLogFile(process.argv[2], { temp: process.argv[3], device: process.argv[4] },process.argv[5]);

function readLogFile(path,output,targetDate) {
   if (path) {
      return readFileAsync(path,'utf8').then(function(data) {
          /* console.log(data); */
         /* Split data by line breaks */
          var datalines = data.split(/\n|\r\n/);
          console.log("Path: " + path + " Number of lines: " + datalines.length);
          var results;
          var linenum = 0;
          for (var rindex = 0; rindex < datalines.length; rindex++) {
             if (datalines[rindex] != "" && datalines[rindex].charAt(0) == '[') {
                results = parseLine(datalines[rindex],targetDate);
                if (results) {
                   try {
                      fs.appendFileSync(output[results.type],JSON.stringify(results.data)+'\n') 
                   }
                   catch(err) {
                      if (err) {
                         console.log("Error: " + err);
                      }
                   }
                   linenum++;
                }
             }
          }
          console.log("Number of output lines: " + linenum);
          return (results);
      })
      .catch(function(err) {
         console.log("Error reading " + path + " " + err);
         throw err
      });
   }
}

function parseLine(line,targetDate) {
   var result;
   var targetd;

   if (targetDate) {
      targetd = moment(targetDate);
   }

   if (line.charAt(0) == '[') {
       /* find end bracket */
      var endb = line.indexOf(']');
      if (endb > 0) {
         var time = moment(line.slice(1,endb));
         if (targetd && time < targetd) {
           /*
             console.log("isValid: " + time.isValid());
             console.log("format: " + time.format());
           */

           /* Now process either the temperature or device status */
           var colon = line.indexOf(':', endb+1);
           if (colon > 0) {
              if (line.slice(endb+1,colon).trim() == "Temperature") {
                result = {
                   type : "temp",
                   data : { 
                     temperature: line.slice(colon+1).trim(),
                     time : time.format()
                   }
                }
              }
              else if (line.slice(endb+1,colon).trim() == "Device Status") {
                result = {
                   type : "device",
                   data : { 
                     state : (line.slice(colon+1).trim() == "ON" ? 1 : 0),
                     time : time.format()
                   }
                }
              }
           }
        }
      }
      return (result);
   }
}


