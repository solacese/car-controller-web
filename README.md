# ESP8266 Car Controller

A simple web based controller app for the ESP8266 Car Fleet.

### Quick Start

Update the broker details in src/scripts/index.js for your broker:

```
            url: "wss://mr1u6o37qn55r9.messaging.solace.cloud:8443",
            vpnName: "hackathon-car-demo",
            userName: "solace-cloud-client",
            password: "cm6uqak4r3lubmarfh10mfh357"
```

Build the docker container:

```
dockerBuild.sh
```

Run the docker container:

```
dockerRun.sh
```

Navigate to http://localhost:8080

### Installation

```
npm install
```

### Start Dev Server

```
npm start
```

### Build Prod Version

```
npm run build
```

### Features:

Allows you to choose the car you want to control, or "All" to send to all cars.

Send messages to `driver/${carId}` in the format:
```json
{
  "type": "[spinout|reverse|slowdown|wheelbroken]",
  "duration": 1000
}
```
Where type is one of the listed effects and duration is in milliseconds.
