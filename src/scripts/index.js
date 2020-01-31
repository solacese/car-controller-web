import '../styles/index.scss';
import nipplejs from 'nipplejs';
import solace from 'solclientjs';

console.log('esp8266 car controller');

const carDriveGlobalTopic = "car/drive";
const carLightGlobalTopic = "car/light";

const cars = [{
    id: "",
    name: "All"
}, {
    id: "6993791",
    name: "Cap"
}, {
    id: "14073209",
    name: "Hulk"
}, {
    id: "6960881",
    name: "Destroyer"
}, {
    id: "5903783",
    name: "Wolverine"
}, {
    id: "2824070",
    name: "Ian"
}, {
    id: "6248841",
    name: "Greg"
}, {
    id: "699662",
    name: "Andrei"
}, {
    id : "2824802",
    name: "Hamza"
}, {
    id : "11993696",
    name: "A Car"
}, {
    id : "2820848",
    name: "Lesla"
}];

var s = function (sel) {
    return document.querySelector(sel);
};

var sId = function (sel) {
    return document.getElementById(sel);
};

// Get debug elements and map them
var elDebug = sId('debug');
var elDump = elDebug.querySelector('.dump');


function Joystick(controller) {
    var joysticks = {
        static: {
            zone: s('.zone.static'),
            mode: 'static',
            position: {
                left: '50%',
                top: '50%'
            },
            color: '#00C895'
        }
    };


    var timeoutCreate;

    function createThrottle(controller) {
        clearTimeout(timeoutCreate);
        timeoutCreate = setTimeout(() => {
            createNipple(controller);
        }, 100);
    }

    var joystick;

    function bindNipple(controller) {
        console.log("Controller bind", controller);
        joystick.on('start end', function (evt, data) {
            //dump(evt.type);
            //debug(data);
            if (evt.type === "start") {
                controller.start();
            }
            if (evt.type === "end") {
                controller.stop();
            }

        }).on('move', function (evt, data) {
            //debug(data);
            controller.move(data);
        }).on('dir:up plain:up dir:left plain:left dir:down ' +
            'plain:down dir:right plain:right',
            function (evt, data) {
                //dump(evt.type);
            }
        ).on('pressure', function (evt, data) {
            // debug({
            //     pressure: data
            // });
        });
    }

    function createNipple(controller) {
        console.log("Controller create", controller);
        var type = 'static';
        if (joystick) {
            joystick.destroy();
        }

        s('.zone.' + type).className += ' active';
        joystick = nipplejs.create(joysticks[type]);
        bindNipple(controller);
    }

    createNipple(controller);
}

var nbEvents = 0;

// Dump data
function dump(evt) {
    setTimeout(function () {
        if (elDump.children.length > 4) {
            elDump.removeChild(elDump.firstChild);
        }
        var newEvent = document.createElement('div');
        newEvent.innerHTML = '<span class="data">' + nbEvents + ":" + evt + '</span>';
        elDump.appendChild(newEvent);
        nbEvents += 1;
    }, 0);
}

function publish(session, topic, messageBody) {
    let messageText = JSON.stringify(messageBody);

    if (session !== null) {
        let message = solace.SolclientFactory.createMessage();
        message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
        message.setBinaryAttachment(messageText);
        message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
        console.log('Publishing message "' + messageText + '" to topic "' + topic + '"...');
        try {
            session.send(message);
            console.log('Message published.');
        } catch (error) {
            console.log(error.toString());
        }
    } else {
        console.log('Cannot publish because not connected to Solace message router.');
    }
}

const subscribeDebugTopicPrefix = "car/debug/info/";
const subscribeDriverTopicPrefix = "driver/";

function Messaging() {
    var debugCar = ">";
    var factoryProps = new solace.SolclientFactoryProperties();
    factoryProps.profile = solace.SolclientFactoryProfiles.version10;
    solace.SolclientFactory.init(factoryProps);

    try {
        var session = solace.SolclientFactory.createSession({
            // solace.SessionProperties
            url: "wss://mr1u6o37qn55r9.messaging.solace.cloud:8443",
            vpnName: "hackathon-car-demo",
            userName: "solace-cloud-client",
            password: ""
        });
    } catch (error) {
        console.error(error);
    }

    session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
        console.log('Connected');
        dump('Connected to solace cloud');
        subscribeToCar(debugCar);
    });

    session.on(solace.SessionEventCode.MESSAGE, function (message) {
        let topic = message.getDestination().getName();

        if (topic.startsWith(subscribeDebugTopicPrefix)) {
            let contents = message.getBinaryAttachment();
            console.log("Got a message", contents);
            dump("Message: " + contents);
        }
    });

    function subscribe(topic) {
        session.subscribe(
            solace.SolclientFactory.createTopicDestination(topic),
            true, // generate confirmation when subscription is added successfully
            topic, // use topic name as correlation key
            10000 // 10 seconds timeout for this operation
        );
    }

    function unsubscribe(topic) {
        session.unsubscribe(
            solace.SolclientFactory.createTopicDestination(topic),
            true, // generate confirmation when subscription is added successfully
            topic, // use topic name as correlation key
            10000 // 10 seconds timeout for this operation
        );
    }

    function subscribeToCar(carId) {
        subscribe(subscribeDebugTopicPrefix + carId);
        subscribe(subscribeDriverTopicPrefix + carId);
    }

    function unsubscribeFromCar(carId) {
        unsubscribe(subscribeDebugTopicPrefix + carId);
        unsubscribe(subscribeDriverTopicPrefix + carId);
    }

    function updateTopic(carId) {
        if (carId === "") {
            carId = ">";
        }
        console.log("Change car topic", subscribeDebugTopicPrefix + carId);
        // unsubscribe the old car
        unsubscribeFromCar(debugCar);

        // subscribe the new car
        debugCar = carId;
        subscribeToCar(debugCar);
    }

    try {
        session.connect();
    } catch (error) {
        console.error(error.toString());
    }

    return {
        session: session,
        updateTopic: updateTopic
    };
}

function Controller(messagingContext){
    var controllerTimer;
    var left = 0;
    var right = 0;
    var drivePublishTopic = "car/drive";
    var modePublishTopic = "car/mode";
    var lightPublishTopic = "car/light";
    var currentEffect = "";
    var wheelBrokenEffectLeft = false;
    var light = false;

    function start() {
        controllerTimer = setInterval(() => {
            moveCar();
        }, 150);
    }

    function move(data) {
        //console.log(data);
        var distance = data.distance;
        var radian = data.angle.radian;
        if (radian >= 0 && radian < 1.5708) {
            // Quadrant 1
            left = distance * 2;
            right = (1 - Math.cos(radian)) * distance * 2;
        } else if (radian >= 1.5708 && radian < 3.14159) {
            // Quadrant 2
            right = distance * 2;
            left = (1 + Math.cos(radian)) * distance * 2;
        } else if (radian >= 3.14159 && radian < 4.71239) {
            // Quadrant 3
            right = - distance * 2;
            left = (-(1 + Math.cos(radian))) * distance * 2;
        } else {
            // Quadrant 4
            left = -distance * 2;
            right = (Math.cos(radian) - 1) * distance * 2;
        }
    }

    function moveCar() {
        console.log(`Current effect ${currentEffect}`);

        if (currentEffect === 'spinout') {
            console.log("Control disabled by effect");
        } else {
            console.log("Moving car l: ", left, "   r: ", right);

            var messageBody = {
                l: Math.ceil(left),
                r: Math.ceil(right),
                d: 700
            };

            switch (currentEffect) {
                case 'slowdown':
                    messageBody.l = messageBody.l / 8;
                    messageBody.r = messageBody.r / 8;
                    break;
                case 'reverse':
                    let temp_l = messageBody.l;
                    messageBody.l = messageBody.r;
                    messageBody.r = temp_l;
                    break;
                case 'wheelbroken':
                    if (wheelBrokenEffectLeft) {
                        messageBody.l = messageBody.l/10;
                    } else {
                        messageBody.r = messageBody.r/10;
                    }
                    break;
            }

            publish(messagingContext.session, drivePublishTopic, messageBody);
        }
    }

    function changeMode(newMode) {
        console.log("Changing mode to", newMode);

        var messageBody = {
            mode: newMode
        };

        publish(messagingContext.session, modePublishTopic, messageBody);
    }

    function setTopic(carId) {
        // Update the receiver's topic
        messagingContext.updateTopic(carId);

        // Update the publisher's topic
        drivePublishTopic = (carDriveGlobalTopic + "/" + carId).replace(/\/$/, "");
        lightPublishTopic = (carLightGlobalTopic + "/" + carId).replace(/\/$/, "");
        console.log("Change car public topic", drivePublishTopic);
    }

    function stop() {
        clearInterval(controllerTimer);
        left = 0;
        right = 0;
        moveCar();
    }

    function hitWithEffect(effect) {
        currentEffect = effect.type;
        console.log(`Set effect to ${currentEffect} for ${effect.duration}`);

        switch (effect.type) {
            case 'spinout':
                let lVal = (Math.floor(Math.random() * 2) === 0) ? -100 : 100;
                let rVal = (lVal > 0) ? -100 : 100;

                let messageBody = {
                    l: lVal,
                    r: rVal,
                    d: effect.duration
                };
                publish(messagingContext.session, drivePublishTopic, messageBody);
                break;
            case 'wheelbroken':
                wheelBrokenEffectLeft = Math.floor(Math.random() * 2) === 0;
                break;
        }

        setTimeout(() => {
            console.log("Resetting effect");
            currentEffect = '';
            }, effect.duration);
    }

    messagingContext.session.on(solace.SessionEventCode.MESSAGE, function (message) {
        let topic = message.getDestination().getName();

        if (topic.startsWith(subscribeDriverTopicPrefix)) {
            let contents = message.getBinaryAttachment();
            console.log("Got a message in controller", contents);
            hitWithEffect(JSON.parse(contents));
        }
    });

    function toggleLight() {
       light = !light;
       var messageBody = {};
       if (light) {
          messageBody = {"mode": "on"};
       } else {
        messageBody = {"mode": "off"};
       }
       publish(messagingContext.session, lightPublishTopic, messageBody);

    }

    return {
        start: start,
        move: move,
        stop: stop,
        setTopic: setTopic,
        changeMode: changeMode,
        toggleLight: toggleLight
    };
}

function Selector(controller) {
    function selectCar(evt) {
        var carId = sId('selector').value;
        controller.setTopic(carId);
    }

    function changeMode(evt) {
        var newMode = sId('mode').value;
        controller.changeMode(newMode);
    }

    function bindLightButtonHandler() {
        var lightButton = sId('lightbutton');
        lightButton.onclick = function(){
            controller.toggleLight();
        };
    }

    function initSelect() {
        var selector = sId('selector');
        selector.onchange = selectCar;
        cars.map(car => {
            console.log(car);
            var option = document.createElement("option");
            option.text = car.name;
            option.value = car.id;
            selector.add(option);
        });
    }

    function initMode() {
       var selector = sId('mode');
       selector.onchange = changeMode;
       ["manual", "collisionAvoidence", "autonomous"].map(myMode => {
        var option = document.createElement("option");
        option.text = myMode;
        option.value = myMode;
        selector.add(option);
       });
    }

    initSelect();
    initMode();
    bindLightButtonHandler();
}

function init() {
    var messagingContext = Messaging();
    var controller = Controller(messagingContext);
    Joystick(controller);
    Selector(controller);
}

window.onload = init;
