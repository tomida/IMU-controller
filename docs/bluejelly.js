/*
============================================================
BlueJelly.js
============================================================
Web Bluetooth API Wrapper Library

Copyright 2017 JellyWare Inc.
http://jellyware.jp/

GitHub
https://github.com/electricbaka/bluejelly
This software is released under the MIT License.

Web Bluetooth API
https://webbluetoothcg.github.io/web-bluetooth/
*/
/* modified by Yu Tomida 2019　*/

//--------------------------------------------------
//BlueJelly constructor
//--------------------------------------------------
class BlueJelly  {
  constructor (){
    this.bluetoothDevice = null;
    this.dataCharacteristic = null;
    this.hashUUID ={};
    this.hashUUID_lastConnected;
  }
  //callBack
  onScan (deviceName){console.log("onScan");};
  onGetUUID (uuid){console.log("onGetUUID");};
  onConnectGATT (uuid){console.log("onConnectGATT");};
  onRead (data, uuid){console.log("onRead");};
  onWrite (uuid){console.log("onWrite");};
  onStartNotify (uuid){console.log("onStartNotify");};
  onStopNotify (uuid){console.log("onStopNotify");};
  onDisconnect (){console.log("onDisconnect");};
  onClear (){console.log("onClear");};
  onReset (){console.log("onReset");};
  onError (error){console.log("onError");};

  //--------------------------------------------------
  //getUUID
  //--------------------------------------------------
  getUUID (service) {
    console.log('Execute: getUUID');
    const optionalServices = service
    .split(/, ?/).map(s => s.startsWith('0x') ? parseInt(s) : s)
    .filter(s => s && BluetoothUUID.getService);

    console.log('Requesting any Bluetooth Device...');
    navigator.bluetooth.requestDevice({
     // filters: [...] <- Prefer filters to save energy & show relevant devices.
        acceptAllDevices: true,
        optionalServices: optionalServices})
    .then(device => {
      this.bluetoothDevice = device;
      console.log('Connecting to GATT Server...');
      return device.gatt.connect();
    })
    .then(server => {
      this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
      this.onScan(this.bluetoothDevice.name);
      // Note that we could also get all services that match a specific UUID by
      // passing it to getPrimaryServices().
      console.log('Getting Services...');
      return server.getPrimaryServices();
    })
    .then(services => {
      console.log('Getting Characteristics...');
      let queue = Promise.resolve();
      services.forEach(service => {
        queue = queue.then(_ => service.getCharacteristics().then(characteristics => {
          console.log(`> Service: ${service.uuid}`);
          characteristics.forEach(characteristic => {
            let supportedProperties = getSupportedProperties(characteristic);
            console.log(`>> Characteristic: ${characteristic.uuid} ${supportedProperties}`);
            this.hashUUID[supportedProperties] = {'serviceUUID':service.uuid, 'characteristicUUID':characteristic.uuid};
            this.onGetUUID(supportedProperties);
          });
        }));
      });
      return queue;
    }).catch(error => {
      console.log(`Error: ${error}`);
    });
  }
  //--------------------------------------------------
  //setUUID
  //--------------------------------------------------
  setUUID (name, serviceUUID, characteristicUUID){
    console.log('Execute: setUUID');
    console.log(this.hashUUID);
    this.hashUUID[name] = {'serviceUUID':serviceUUID, 'characteristicUUID':characteristicUUID};
  }
  //--------------------------------------------------
  //scan
  //--------------------------------------------------
  scan (uuid){
    return (this.bluetoothDevice ? Promise.resolve() : this.requestDevice(uuid))
    .catch(error => {
      console.log(`Error: ${error}`);
      this.onError(error);
    });
  }
  //--------------------------------------------------
  //requestDevice
  //--------------------------------------------------
  requestDevice (uuid) {
    console.log('Execute : requestDevice');
    return navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.hashUUID[uuid].serviceUUID]})
    .then(device => {
      this.bluetoothDevice = device;
      this.bluetoothDevice.addEventListener('gattserverdisconnected', this.onDisconnect);
      this.onScan(this.bluetoothDevice.name);
    });
  }
  //--------------------------------------------------
  //connectGATT
  //--------------------------------------------------
  connectGATT (uuid) {
    if(!this.bluetoothDevice)
    {
      const error = "No Bluetooth Device";
      console.log('Error: ' + error);
      this.onError(error);
      return;
    }
    if (this.bluetoothDevice.gatt.connected && this.dataCharacteristic) {
      if(this.hashUUID_lastConnected == uuid)
        return Promise.resolve();
    }
    this.hashUUID_lastConnected = uuid;

    console.log('Execute: connect');
    return this.bluetoothDevice.gatt.connect()
    .then(server => {
      console.log('Execute: getPrimaryService');
      return server.getPrimaryService(this.hashUUID[uuid].serviceUUID);
    })
    .then(service => {
      console.log('Execute: getCharacteristic');
      return service.getCharacteristic(this.hashUUID[uuid].characteristicUUID);
    })
    .then(characteristic => {
      this.dataCharacteristic = characteristic;
      this.dataCharacteristic.addEventListener('characteristicvaluechanged',this.dataChanged(this, uuid));
      this.onConnectGATT(uuid);
    })
    .catch(error => {
        console.log(`Error: ${error}`);
        this.onError(error);
      });
  }
  //--------------------------------------------------
  //dataChanged
  //--------------------------------------------------
  dataChanged (self, uuid) {
    return function(event) {
      self.onRead(event.target.value, uuid);
    }
  }

  //--------------------------------------------------
  //read
  //--------------------------------------------------
  read (uuid) {
    return (this.scan(uuid))
    .then( () => {
      return this.connectGATT(uuid);
    })
    .then( () => {
      console.log('Execute: readValue');
      return this.dataCharacteristic.readValue();
    })
    .catch(error => {
      console.log(`Error: ${error}`);
      this.onError(error);
    });
  }


  //--------------------------------------------------
  //write
  //--------------------------------------------------
  write (uuid, array_value) {
    return (this.scan(uuid))
    .then( () => {
      return this.connectGATT(uuid);
    })
    .then( () => {
      console.log('Execute: writeValue');
      const data = Uint8Array.from(array_value);
      return this.dataCharacteristic.writeValue(data);
    })
    .then( () => {
      this.onWrite(uuid);
    })
    .catch(error => {
      console.log(`Error: ${error}`);
      this.onError(error);
    });
  }
  //--------------------------------------------------
  //startNotify
  //--------------------------------------------------
  startNotify (uuid) {
    return (this.scan(uuid))
    .then( () => {
      return this.connectGATT(uuid);
    })
    .then( () => {
      console.log('Execute: startNotifications');
      this.dataCharacteristic.startNotifications()
    })
    .then( () => {
      this.onStartNotify(uuid);
    })
    .catch(error => {
      console.log(`Error: ${error}`);
      this.onError(error);
    });
  }
  //--------------------------------------------------
  //stopNotify
  //--------------------------------------------------
  stopNotify (uuid){
    return (this.scan(uuid))
    .then( () => {
      return this.connectGATT(uuid);
    })
    .then( () => {
    console.log('Execute: stopNotifications');
    this.dataCharacteristic.stopNotifications()
  })
    .then( () => {
      this.onStopNotify(uuid);
    })
    .catch(error => {
      console.log(`Error: ${error}`);
      this.onError(error);
    });
  }
  //--------------------------------------------------
  //disconnect
  //--------------------------------------------------
  disconnect () {
    if (!this.bluetoothDevice) {
      const error = "No Bluetooth Device";
      console.log(`Error: ${error}`);
      this.onError(error);
      return;
    }
    if (this.bluetoothDevice.gatt.connected) {
      console.log('Execute: disconnect');
      this.bluetoothDevice.gatt.disconnect();
    } else {
     const error = "Bluetooth Device is already disconnected";
     console.log(`Error: ${error}`);
     this.onError(error);
     return;
    }
  }


  //--------------------------------------------------
  //clear
  //--------------------------------------------------
  clear () {
     console.log('Excute : Clear Device and Characteristic');
     this.bluetoothDevice = null;
     this.dataCharacteristic = null;
     this.onClear();
  }
  //--------------------------------------------------
  //reset(disconnect & clear)
  //--------------------------------------------------
  reset () {
    console.log('Excute: reset');
    this.disconnect(); //disconnect() is not Promise Object
    this.clear();
    this.onReset();
  }
}

/* Utils */

const getSupportedProperties = (characteristic) => {
  let supportedProperties = [];
  for (const p in characteristic.properties) {
    if (characteristic.properties[p] === true) {
      supportedProperties.push(p.toUpperCase());
    }
  }
  return '[' + supportedProperties.join(', ') + ']';
}
