// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var uuid = require('uuid');
var Protocol = require('azure-iot-device-mqtt').Mqtt;
// Uncomment one of these transports and then change it in fromConnectionString to test other transports
// var Protocol = require('azure-iot-device-amqp').AmqpWs;
var Protocol = require('azure-iot-device-http').Http;
// var Protocol = require('azure-iot-device-amqp').Amqp;
// var Protocol = require('azure-iot-device-mqtt').MqttWs;
var Client = require('azure-iot-device').Client;
var Message = require('azure-iot-device').Message;

// String containing Hostname, Device Id & Device Key in the following formats:
//  "HostName=<iothub_host_name>;DeviceId=<device_id>;SharedAccessKey=<device_key>"
var connectionString = 'HostName=kitchenfarm.azure-devices.net;DeviceId=kfhome1;SharedAccessKey=rbv5TNwFxveIXeoTUYLLiDzP9rVVdIh2xfwgU1mgoVk='; //process.env.DEVICE_CONNECTION_STRING;
if (!connectionString) {
  console.log('Please set the DEVICE_CONNECTION_STRING environment variable.');
  process.exit(-1);
}

// fromConnectionString must specify a transport constructor, coming from any transport package.
var client = Client.fromConnectionString(connectionString, Protocol);

client.open(function (err) {
  if (err) {
    console.error('Could not connect: ' + err.message);
  } else {
    console.log('Client connected');

    client.on('error', function (err) {
      console.error(err.message);
      process.exit(-1);
    });
  }
});

var dht22sensor = require("node-dht-sensor");

function send(measurement) {
    var message = new Message(JSON.stringify(measurement));
    // message.properties.add('propertyName', 'propertyValue');

    message.messageId = uuid.v4();

    console.log('Sending message: ' + message.getData());
    client.sendEvent(message, function (err) {
      if (err) {
        console.error('Could not send: ' + err.toString());
      } else {
        console.log('Message sent: ' + message.messageId);
      }
    });
}

/*
const Tsl2561 = require("ada-tsl2561");
let tsl2561sensor = new Tsl2561();

async function initTsl2561()
{
    await tsl2561sensor.init(1);
    let enabled = await tsl2561sensor.isEnabled();
    if(!enabled)
        await tsl2561sensor.enable();
}

(async() => initTsl2561())();

//let broadband = tsl2561sensor.getBroadband();
//let infrared = tsl2561sensor.getInfrared();
//let lux = tsl2561sensor.getLux();
*/

const Gpio = require('pigpio').Gpio;

const fan = new Gpio(14, {mode:Gpio.OUTPUT});
fan.pwmWrite(10);

setInterval(function() {
    // temp and humidity
    dht22sensor.read(22, 4, function(err, temperature, humidity) {
        var message = {
            sensor: 'humidity_temp_sensor',
            sensor_type: 'DHT22'
        };
        if(err) {
            message.error = 'Sensor Read Error';
            message.cause = err.cause;
            send(message);
        }
        else {
            message.value = temperature;
            message.unit = 'C';
            send(message);
            message.value = humidity;
            message.unit = '%';
            send(message);
        }
    });
/*    // light
    TSL2561.fetch(function(err, data) {
        var readout = sensorLib.read();
        if(err) {
            message.errors.push({
                sensor = 'temp, humidity',
                sensor_type = 'DHT22',
                error = 'Error reading sensor',
                cause = err.cause
            });
        }
        else {
          message.temperature = {
            value: readout.temperature.toFixed(1),
            unit: "Celcius"
          };
          message.humidity = {
            value: readout.humidity.toFixed(1),
            unit: "%"
            sensor_name: 'temp, humidity',
            sensor_type: 'DHT22',
          };
        }
    });*/
}, 30000);
