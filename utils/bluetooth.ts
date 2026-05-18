import { BleManager, Device } from 'react-native-ble-plx';
import { store } from '@/store';
import { setConnectionStatus, setDeviceInfo } from '@/store/slices/connectionSlice';

export interface BluetoothDevice {
  id: string;
  name: string;
}

class BluetoothService {
  private static instance: BluetoothService;
  private manager: BleManager;
  private connectedDevice: Device | null = null;

  private constructor() {
    try {
      this.manager = new BleManager();
    } catch (error) {
      console.warn("BLE native module not found (likely running in Expo Go). Using mock manager.");
      this.manager = new Proxy({}, {
        get: () => {
          console.warn("BLE operation ignored because native module is missing.");
          return Promise.resolve();
        }
      }) as any;
    }
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new BluetoothService();
    }
    return this.instance;
  }

  // Helper: Ensure the device is connected and discover its services/characteristics.

  // private async getConnectedDevice(deviceId: string): Promise<Device> {
  //   if (this.connectedDevice && this.connectedDevice.id === deviceId) {
  //     return this.connectedDevice;
  //   }
  //   const device = await this.manager.connectToDevice(deviceId);
  //   this.connectedDevice = device;
  //   await device.discoverAllServicesAndCharacteristics();
  //   await new Promise(resolve => setTimeout(resolve, 1500));

  //   return device;
  // }


  private async getConnectedDevice(deviceId: string): Promise<Device> {
  if (this.connectedDevice && this.connectedDevice.id === deviceId) {
    // Verify the connection is actually alive
    const isConnected = await this.connectedDevice.isConnected();
    if (isConnected) {
      return this.connectedDevice;
    }
    // Connection dropped — clear cache and reconnect
    console.warn('Cached device was disconnected, reconnecting...');
    this.connectedDevice = null;
  }
  
  const device = await this.manager.connectToDevice(deviceId);
  this.connectedDevice = device;
  await device.discoverAllServicesAndCharacteristics();
  await new Promise(resolve => setTimeout(resolve, 1500));
  return device;
}

  // Connect to a BLE device using its id.
  async connectToDevice(device: BluetoothDevice): Promise<boolean> {
    try {
      this.connectedDevice = await this.manager.connectToDevice(device.id);
      await this.connectedDevice.requestMTU(512);
      await this.connectedDevice.discoverAllServicesAndCharacteristics();

      // Optionally, you can read actual device info characteristics here

      await new Promise(resolve => setTimeout(resolve, 1500));

      store.dispatch(setConnectionStatus(true));
      store.dispatch(
        setDeviceInfo({
          name: device.name,
          deviceId: device.id,
          batteryLevel: 90,
          firmwareVersion: "1.0.0",
        })
      );
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      return false;
    }
  }

  // Disconnect from the currently connected BLE device.
  async disconnect(): Promise<boolean> {
    try {
      if (this.connectedDevice) {
        await this.connectedDevice.cancelConnection();
        this.connectedDevice = null;
        store.dispatch(setConnectionStatus(false));
      }
      return true;
    } catch (error) {
      console.error('Disconnection failed:', error);
      return false;
    }
  }

  // Function 1: Scan for BLE devices for a specified timeout (default 5 seconds).
  async scanForDevices(timeout: number = 5000): Promise<BluetoothDevice[]> {
    return new Promise((resolve, reject) => {
      const devices: Map<string, BluetoothDevice> = new Map();
      const subscription = this.manager.startDeviceScan(
        null,
        null,
        (error, scannedDevice) => {
          if (error) {
            reject(error);
            return;
          }
          if (scannedDevice && scannedDevice.id) {
            // console.log('scannedDevice', scannedDevice);
            devices.set(scannedDevice.id, {
              id: scannedDevice.id,
              name: scannedDevice.name || 'Unknown',
            });
          }
        }
      );
      setTimeout(() => {
        this.manager.stopDeviceScan();
        console.log('devices', devices);
        resolve(Array.from(devices.values()));
      }, timeout);
    });
  }

  // Function 2: Stop scanning for devices (if currently scanning).
  stopScan() {
    this.manager.stopDeviceScan();
  }

  // Function 3: Read a characteristic's value given the device, service, and characteristic UUIDs.
  async readCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<string | null> {
    try {
      const device = await this.getConnectedDevice(deviceId);
      const characteristic = await device.readCharacteristicForService(
        serviceUUID,
        characteristicUUID
      );
      return characteristic.value;
    } catch (error) {
      console.error('Read characteristic failed:', error);
      return null;
    }
  }

  // Function 4: Write a value to a characteristic with response.
  async writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<boolean> {
    try {
      const device = await this.getConnectedDevice(deviceId);

      await device.writeCharacteristicWithResponseForService(
        serviceUUID,
        characteristicUUID,
        btoa(value)
      );
      return true;
    } catch (error) {
      console.error('Write characteristic failed:', error);
      return false;
    }
  }

  // Function 5: Monitor a characteristic for updates.
  // Returns the Subscription object — caller MUST call .remove() to stop listening.
  monitorCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: any, characteristic: any) => void
  ) {
    if (!this.connectedDevice || this.connectedDevice.id !== deviceId) {
      console.warn('monitorCharacteristic: device not connected yet');
      return null;
    }
    // monitorCharacteristicForService is synchronous — it sets up the listener
    // and returns a Subscription immediately (no await needed).
    const subscription = this.connectedDevice.monitorCharacteristicForService(
        serviceUUID,
        characteristicUUID,
        listener
      );
    return subscription;
  }

  // Function 6: Retrieve a device's services and their characteristics.
  async getDeviceServices(
    deviceId: string
  ): Promise<
    Array<{
      serviceUUID: string;
      characteristics: Array<{
        uuid: string;
        isReadable: boolean;
        isWritableWithResponse: boolean;
        isWritableWithoutResponse: boolean;
      }>;
    }>
  > {
    try {
      const device = await this.getConnectedDevice(deviceId);
      const services = await device.services();
      console.log("Raw services discovered:", services.map(s => s.uuid));  // Log raw UUIDs

      const result = await Promise.all(
        services.map(async (service) => {
          const characteristics = await service.characteristics();
          return {
            serviceUUID: service.uuid,
            characteristics: characteristics.map((characteristic) => ({
              uuid: characteristic.uuid,
              isReadable: characteristic.isReadable,
              isWritableWithResponse: characteristic.isWritableWithResponse,
              isWritableWithoutResponse:
                characteristic.isWritableWithoutResponse,
            })),
          };
        })
      );
      return result;
    } catch (error) {
      console.error('Get device services failed:', error);
      return [];
    }
  }
}

export const bluetoothService = BluetoothService.getInstance();
