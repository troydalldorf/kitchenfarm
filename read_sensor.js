var sensorLib = require('node-dht-sensor');
var iotHub = require('send_telemetry');
var sensorType = 22; //dht22
var sensorPin = 4;
if (!sensorLib.initialize(sensorType, sensorPin)) {
    console.warn('Failed to initialize sensor');
    process.exit(1);
}

setInterval(function() {
    var readout = sensorLib.read();
    console.log('Temperature:', readout.temperature.toFixed(1) + 'C');
    console.log('Humidity:   ', readout.humidity.toFixed(1)    + '%');
}, 2000);
