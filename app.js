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

const Tsl2561 = require("ada-tsl2561");
let tsl2561sensor = new Tsl2561();

async function initTsl2561()
{
    await tsl2561sensor.init(1);
    let enabled = await tsl2561sensor.isEnabled();
    if(!enabled)
        await tsl2561sensor.enable();
}

initTsl2561()
    .then(()=> {
        let broadband = tsl2561sensor.getBroadband();
        let infrared = tsl2561sensor.getInfrared();
        let lux = tsl2561sensor.getLux();
    })
    .catch(err => {
        console.error(err);
    });

// fan controller
const Gpio = require('pigpio').Gpio;
const fan = new Gpio(14, {mode:Gpio.OUTPUT});
var lastFanSpeed = -1;

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
            message.sensor = 'temp';
            message.value = temperature*9/5 + 32; //Celcius to Fahrenheit
            message.unit = 'F';
            result(message);
            message.sensor = 'humidity';
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
logStatus({ sensor: 'kfarm-pi' });
readDht22(m => {
    logStatus(m);
});

send({ sensor: 'kfarm-os', sensor_type: 'raspberryi-pi-3b' });

// interval
setInterval(() => {
    readDht22(measurement => {
        send(measurement);
        if (measurement.unit === 'F') {
            if (measurement.value > 80) {
                fanSpeed(200);
            }
            else if (measurement.value > 71) {
                fanSpeed(100);
            }
            else {
                fanSpeed(25);
            }
        }
    });
}, 30000);
*/
