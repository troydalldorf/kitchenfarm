// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

const uuid = require('uuid');
const Protocol = require('azure-iot-device-http').Http;
const Client = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;
const connectionString = 'HostName=kitchenfarm.azure-devices.net;DeviceId=kfhome1;SharedAccessKey=rbv5TNwFxveIXeoTUYLLiDzP9rVVdIh2xfwgU1mgoVk='; //process.env.DEVICE_CONNECTION_STRING;
const client = Client.fromConnectionString(connectionString, Protocol);
let currentStatus = {
    location: 'kfarm-home1',
    rack: 'top',
    status: '',
    timestamp: null,
    temp: null,
    humidity: null,
    light: null,
    infrared: null,
    broadband: null,
    fanSpeed: null,
    errors: [ ]
};

function error(status, err)
{
    status.errors[status.errors.length] = err;
}

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

// iot send
function send(status) {
    const message = new Message(JSON.stringify(status));
    message.messageId = uuid.v4();
    console.log('Sending message: ' + message.getData());
    client.sendEvent(message, function (err) {
        if (err) {
            console.error('Could not send: ' + err.toString());
        }
    });
}

// tsl 2561
const Tsl2561 = require("ada-tsl2561");
let tsl2561sensor = new Tsl2561();

async function initTsl2561() {
    await tsl2561sensor.init(1);
    let enabled = await tsl2561sensor.isEnabled();
    if (!enabled)
        await tsl2561sensor.enable();
}

async function readTsl2561(status) {
    status.broadband = await tsl2561sensor.getBroadband();
    status.infrared = await tsl2561sensor.getInfrared();
    status.lux = await tsl2561sensor.getLux();
}

// fan controller
const Gpio = require('pigpio').Gpio;
const fan = new Gpio(14, {mode: Gpio.OUTPUT});

function fanSpeed(speed, status) {
    fan.pwmWrite(200 - speed);
    if (speed !== status.fanSpeed) {
        status.fanSpeed = speed / 200;
    }
}

// DHT22
const dht22sensor = require('node-dht-sensor');

function readDht22(status) {
    dht22sensor.read(22, 4, function (err, temperature, humidity) {
        if (err) {
            console.error(err);
            error(status, {sensor:'dht22', error: 'Sensor Read Error', cause: err.cause});
        } else {
            status.temp = temperature * 9 / 5 + 32; //Celcius to Fahrenheit
            status.humidity = humidity;
        }
    });
}

// boot
currentStatus.status = 'Boot'
readDht22(currentStatus);
initTsl2561()
    .then(async () => {
        await readTsl2561(currentStatus);
    })
    .catch(err => {
        error(currentStatus, { sensor: 'tsl2561', error: 'Sensor Read Error', cause: err})
    });
send(currentStatus);
currentStatus.status = 'update';

// interval
setInterval(() => {
    // reset any errors
    // currentStatus.errors = [];
    // take temp and humidity reading
    readDht22(currentStatus);
    // take light readings
    initTsl2561()
        .then(() => {
            readTsl2561(currentStatus);
        })
        .catch(err => {
            error(status, { sensor: 'tsl2561',  error: 'Sensor Read Error', cause: err });
        });
        // fan logic
        if (currentStatus.temp > 80) {
            fanSpeed(200, currentStatus);
        } else if (currentStatus.temp > 71) {
            fanSpeed(100, currentStatus);
        } else {
            fanSpeed(25, currentStatus);
        }
        // report to IoT hub
        send(currentStatus);
        currentStatus.errors = [];
    },
    3000
);
