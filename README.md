# ESP8266 Car Controller

A simple web based controller app for the ESP8266 Car Fleet


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
