let SerialPort = require("serialport");
let Buffer = require("buffer").Buffer;
let argumentsHelper = require("./helpers/arguments.js");
let responseFormat = require("./helpers/responseFormat.js");
let types = require("./types.js");

let devicePath = "/dev/ttyUSB0";
let deviceBaudRate = 57600;

//  _       _ _   _       _ _
// (_)_ __ (_) |_(_) __ _| (_)_______
// | | '_ \| | __| |/ _` | | |_  / _ \
// | | | | | | |_| | (_| | | |/ /  __/
// |_|_| |_|_|\__|_|\__,_|_|_/___\___|
//

// get user arguments (--command=..., --data=...)
var userArgs = argumentsHelper.userArgs();

var port = new SerialPort(devicePath, {
  baudRate: deviceBaudRate,
  lock: false
});

//                                 _
//  _ __ ___  __ _ _   _  ___  ___| |_
// | '__/ _ \/ _` | | | |/ _ \/ __| __|
// | | |  __/ (_| | |_| |  __/\__ \ |_
// |_|  \___|\__, |\__,_|\___||___/\__|
//              |_|
//

// start command
var send = makeCommand(userArgs.command, userArgs.data);

// write command to port
port.write(send, function(err) {
  if (err) {
    console.log("Error on write: ", err.message);
    process.exit();
  }

  // if no response is received after a while, exit the programm
  setTimeout(() => {
    process.exit();
  }, 100);
});

//  _ __ ___  ___ _ __   ___  _ __  ___  ___
// | '__/ _ \/ __| '_ \ / _ \| '_ \/ __|/ _ \
// | | |  __/\__ \ |_) | (_) | | | \__ \  __/
// |_|  \___||___/ .__/ \___/|_| |_|___/\___|
//               |_|
//
const parser = port.pipe(
  new SerialPort.parsers.ByteLength({
    // ensure "data" event is not fired until the full response is received
    length: userArgs.command.replyLength
  })
);

parser.on("data", response => {
  port.close();
  data = response.toJSON().data;

  responseState = {
    command: userArgs,
    isChecksumValid: false,
    isRequestAcknowledged: false
  };

  if (getChecksum(data.slice(0, -1)) === data[data.length - 1]) {
    responseState.isChecksumValid = true;
  }

  if (isRequestAcknowledged(data)) {
    responseState.isRequestAcknowledged = true;
  }

  // get only data
  data.splice(0, userArgs.command.skipFirstXBytes);
  data.splice(-1, 1);

  if (userArgs.commandName == "readValue") {
    // get type
    var typeByte = data.shift();
    var type = Object.keys(types)[Object.values(types).indexOf(typeByte)];
  }

  let myresponse = responseFormat[userArgs.commandName](responseState, data, type);
  process.stdout.write(JSON.stringify(myresponse));

  process.exit();
});

function makeCommand(command, params) {
  // we might need to fill with zeroes
  // we need to susbract one because requestLength does include the checksum
  if (command.requestLength - 1 > params.length) {
    let spacesLeft = command.requestLength - 1 - params.length;
    while (spacesLeft > 0) {
      params.push(0);
      spacesLeft--;
    }
  }

  // set length of the package
  params.unshift(params.length + 1);

  // calculate checksum
  params.push(getChecksum(params));

  let buffer = new Int16Array(params);

  return Buffer.from(buffer);
}

function getChecksum(data) {
  return (
    ~parseInt(
      data.reduce((a, b) => {
        return a + b;
      }, 0)
    ) + 1
  );
}

function isRequestAcknowledged(data) {
  if (data[1] === userArgs.command.code) {
    return true;
  } else if (data[1] === ~userArgs.command.code) {
    return false;
  }

  return false;
}
