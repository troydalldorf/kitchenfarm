// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

var uuid = require('uuid');
var Protocol = require('azure-iot-device-http').Http;
var Client = require('azure-iot-device').Client;
var Message = require('azure-iot-device').Message;
var connectionString = 'HostName=kitchenfarm.azure-devices.net;DeviceId=kfhome1;SharedAccessKey=rbv5TNwFxveIXeoTUYLLiDzP9rVVdIh2xfwgU1mgoVk='; //process.env.DEVICE_CONNECTION_STRING;
var client = Client.fromConnectionString(connectionString, Protocol);

// init Azure IoT Hub client
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

// temp init
var dht22sensor = require("node-dht-sensor");

// iot send
function send(measurement) {
    var message = new Message(JSON.stringify(measurement));
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

// fan controller
const Gpio = require('pigpio').Gpio;
const fan = new Gpio(14, {mode:Gpio.OUTPUT});
var lastFanSpeed = 0;

function fanSpeed(speed) {
    fan.pwmWrite(200-speed);
    if (speed !== lastFanSpeed) {
        send({ sensor: 'fan', sensor_type: 'fan', unit:'%', value: speed/200})
        lastFanSpeed = speed;
    }
}

// DHT22
function readDht22(result) {
    // temp and humidity
    dht22sensor.read(22, 4, function(err, temperature, humidity) {
        let message = {
            sensor: 'humidity_temp_sensor',
            sensor_type: 'DHT22'
        };
        if(err) {
            message.error = 'Sensor Read Error';
            message.cause = err.cause;
            result(message);
        }
        else {
            message.value = temperature;
            message.unit = 'C';
            result(message);
            message.value = humidity;
            message.unit = '%';
            result(message);
        }
    });
}

// log status
function logStatus(m) {
    if (m.error != null) {
        console.error('Sensor offline: ' + m.sensor + '=> error: ' + m.error + '=> cause: ' + m.cause);
    }
    else {
        console.error('Sensor online: ' + m.sensor);
    }
}

// boot
logStatus({ sensor: 'kfhome1' });
readDht22(m => {
    logStatus(m);
});

// interval
setInterval(() => {
    readDht22(measurement => {
        send(measurement);
        if (measurement.unit === 'C') {
            if (measurement.value > 24) {
                fanSpeed(200);
            }
            else if (measurement.value > 22) {
                fanSpeed(100);
            }
            else if (measurement.value < 20) {
                fanSpeed(0);
            }
        }
    });
}, 30000);
