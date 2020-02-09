	/*
	   ToDo:
	*/
  var bDebug = false;
  var dbg;

   var watch = {
      clientOptions : _.debounce(function() {
         var self=this
         var opts = new Object()
         for (key in self.clientOptions) {
           if (self.clientOptions[key] != self.serverOptions[key]) {
              opts[key] = self.clientOptions[key]
              self.clientOptionsdirty = true
           }
         }
         if (self.clientOptionsdirty) {
             self.setOptions(opts).then(function () {
                if (self.clientOptions.interval != self.serverOptions.interval) {
                   self.stopDatafetch()
                   self.startDatafetch()
                   console.log("Data fetch restarted")
                }
                self.clientOptionsdirty = false;
             })
         }
      },1000),
      chartDistribution : _.debounce(function() {
         if (this.chart) {
           this.chart.options.scales.xAxes[0].distribution = this.chartDistribution
           this.chart.update()
         }
      },500),
      chartDuration : _.debounce(function() {
         /* get new history data */
         var self=this
         self.getTemperaturehistory().then(function() {
            self.stopDatafetch()
            return self.getDevicehistory()
         })
         .then(function() {
            self.chart.destroy()   /* kind of heavy handed */
            self.createChart()
            self.startDatafetch()
         })
      },1000)
   }

   var fermheatvue = new Vue({
     el: '#fermheatvue',
     data: {
         baseUri: "/",
	      tempHistory: [{time: "2019-11-19T12:00:00-05", temperature: 0}],
         deviceHistory: [{time: "2019-11-19T12:00:00-05", state: 0}],
         clientOptions: {
           highTemp: 80,
           lowTemp: 70,
           interval: 60,
           targetDevice: "heater"
         },
         serverOptions: undefined,
	      fetchcount : 0,
	      currenttime : "00:00:00 am",
         dataFetch : undefined,
         clientOptionsdirty : false,
         chart : undefined,
         chartDistribution : "linear",
         chartDuration : 24    /* ToDo: define a chart window */
      },

   computed: {
      currentTemp: function () {
         return this.tempHistory[this.tempHistory.length - 1].temperature
      },
      currentTemptimestamp: function () {
         return this.tempHistory[this.tempHistory.length - 1].time
      },
      currentState: {
        get: function () {
           return this.deviceHistory[this.deviceHistory.length - 1].state
        },
        set: function (newValue) {
           /* this is a little weird...*/
           if (newValue) {
               this.turnDeviceOn()
           }
           else {
               this.turnDeviceOff()
           }
        }
      }
   },
   created: function () {
        var self=this;
	      this.startClock()
        this.initData().then(function(result) {
           console.log(result)
           self.createChart()
           for (prop in watch) {
		          self.$watch(prop,watch[prop],{deep:true})
		       }
        })
        .catch( function(err) {
           console.log(err)
        })
   },
   methods: {
     getTemperature: function () {
       var self = this
       var uri = encodeURI(this.baseUri + "temperature");
       return fetch(uri).then(function(response) {
           return response.json()
       })
       .then(function(jsdata) {
           self.tempHistory.push(jsdata);
           if (self.chart) {
              self.chart.data.labels.push(moment(jsdata.time).toDate())
              self.chart.data.datasets[0].data.push(jsdata.temperature)
              self.chart.update()
           }
       })
       .catch(function(err) {
           console.log("[getTemperature] Error: " + err);
       })
     },
     getTemperaturehistory: function () {
       var self = this
       var uri = encodeURI(this.baseUri + "temperature/history" + "?duration=" + self.chartDuration);
       return fetch(uri).then(function(response) {
           return response.json()
       })
       .then(function(jsdata) {
           self.tempHistory = jsdata
       })
       .catch(function(err) {
           console.log("[getTemperaturehistory] Error: " + err);
       })
     },
     getDevicestate: function () {
		   var self = this
       var uri = encodeURI(this.baseUri + "device");
       return fetch(uri).then(function(response) {
           return response.json()
       })
       .then(function(jsdata) {
           self.deviceHistory.push(jsdata);
       })
       .catch(function(err) {
           console.log("[getDevicestate] Error: " + err);
       })
     },
     getDevicehistory: function () {
		   var self = this
         var uri = encodeURI(this.baseUri + "device/history" + "?duration=" + self.chartDuration);
         return fetch(uri).then(function(response) {
            return response.json()
         })
         .then(function(jsdata) {
            self.deviceHistory = jsdata;
         })
         .catch(function(err) {
            console.log("[getDevicehistory] Error: " + err);
         })
     },
     turnDeviceOn: function() {
         var self = this
         var uri = encodeURI(this.baseUri + "device/on");
         return fetch(uri).then(function(response) {
            return response.json()
         })
         .then(function(jsdata) {
             console.log("[turnDeviceOn] Success: " + JSON.stringify(jsdata));
         })
         .catch(function(err) {
             console.log("[turnDeviceOn] Error: " + err);
         })
     },
     turnDeviceOff: function() {
       var self = this
       var uri = encodeURI(this.baseUri + "device/off");
       return fetch(uri).then(function(response) {
           return response.json()
       })
       .then(function(jsdata) {
           console.log("[turnDeviceOff] Success: " + JSON.stringify(jsdata));
       })
       .catch(function(err) {
           console.log("[turnDeviceOff] Error: " + err);
       })
     },
	  getOptions: function () {
		 var self = this
       var uri = encodeURI(this.baseUri + "options");
       return fetch(uri).then(function(response) {
           return response.json()
       })
       .then(function(jsdata) {
           self.serverOptions = jsdata
           for (key in self.clientOptions) {
              if (self.clientOptions[key] != self.serverOptions[key]) {
                 self.clientOptions[key] = self.serverOptions[key]
              }
           }
       })
       .catch(function(err) {
           console.log("[getOptions] Error: " + err);
       })
	 },
    setOptions: function (options) {
		   var self = this
       var uri = encodeURI(this.baseUri + "options/set");
       return fetch(uri, {
              method: 'POST',
              cache: 'no-cache',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(options)
       }).then(function(response) {
              return response.json()
       })
       .then(function(jsdata) {
           console.log("[setOptions] Success: " + JSON.stringify(jsdata))
       })
       .catch(function(err) {
           console.log("[setOptions] Error: " + err);
       })
		},
    startClock: function() {
		   var self = this
		   setInterval(function() {
          var now = new Date();
          var clock = self.pad(now.getHours(),2) + ":" +
                   self.pad(now.getMinutes(),2) + ":" +
                   self.pad(now.getSeconds(),2)
          self.currenttime = self.time24to12(clock);
   		 }, 1000)
   	},
    startDatafetch: function() {
		   var self = this
		   this.dataFetch = setInterval(function() {
          self.getTemperature()
          self.getDevicestate()
          if (!self.clientOptionsdirty) {
             self.getOptions()
          }
   		 }, self.clientOptions.interval * 1000)
   	},
    stopDatafetch: function() {
       if (this.dataFetch) {
         clearInterval(this.dataFetch)
       }
    },
    createChart: function() {
        var data = new Object()
        data.labels = []
	     data.datasets = []
        data.datasets[0] = new Object()
        data.datasets[0].data = []
        data.datasets[0].type = "line"
        data.datasets[0].pointRadius = 1
        var options = {
			      responsive: true,
			      maintainAspectRatio: true,
               aspectRatio: 5,
               legend: {
               display: false
            },
            scales: {
      		  yAxes: [{
      			    id: "y-axis-1",
                   scaleLabel: {display: true, labelString: 'fahrenheit'},
      	          ticks: {
     	                beginAtZero: false
     	             }
      		  }],
      		  xAxes: [{
      			    id: "x-axis-time",
      			    type: "time",
                   distribution: this.chartDistribution,
                   time: {
                        displayFormats: {
                           hour: "MMM D : ha"
                        },
                        unit: 'hour',
                        stepSize: 6
      		       },
      		  }]
           }
        }
        this.tempHistory.forEach(function (datapoint, i) {
           data.labels[i] = moment(datapoint.time).toDate()
           data.datasets[0].data[i] = datapoint.temperature
        })
        this.ctx = document.getElementById("temphistory")
        this.chart = new Chart(this.ctx, {
      			type: 'line',
      			data: data,
      			options: options
      	});
    },
    pad: function(number, size) {
		   number = number.toString()
		   while (number.length < size) number = "0" + number
		      return number
    },
    initData: function() {
       var self=this
       return new Promise(function (resolve, reject) {
         self.getOptions().then(function() {
             return self.getTemperaturehistory()
         })
         .then(function() {
             return self.getDevicehistory()
         })
         .then(function() {
             self.startDatafetch()
             resolve("Data fetch started")
         })
         .catch(function(err) {
             console.log("Error: " + err)
             reject(err)
         })
       })
    },
	 time24to12: function(time) {
		   /* convert hours to 12 hour format */
		   if (time) {
			  var cindex1 = time.indexOf(":")

			  var hour = time.slice(0,cindex1)
			  var ampm
			  if (hour > 12) {
				 hour = hour - 12
				 ampm = "pm"
			  }
			  else if (hour == 12) {
				 hour = parseInt(hour)
				 ampm = "pm"
			  }
			  else {
				 hour = parseInt(hour)
				 ampm = "am"
			  }
			  return(hour + ":" + time.slice(cindex1+1) + " " + ampm)
		   }
		},
	 }
  })
