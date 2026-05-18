import { useState, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { bluetoothService, BluetoothDevice } from '@/utils/bluetooth';
import { decode as atob } from 'base-64';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

export const useBluetooth = () => {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [readValue, setReadValue] = useState<string | null>(null);
  
  // Use Redux for connected device state and deviceId
  const dispatch = useAppDispatch();
  const { isConnected, deviceName, deviceId } = useAppSelector(state => state.connection);

  // Request location permission for Android API 23+ before scanning
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (!hasPermission) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  const requestBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      const hasBluetoothScanPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
      const hasBluetoothConnectPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      
      if (!hasBluetoothScanPermission || !hasBluetoothConnectPermission) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
               granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  // Scan for BLE devices with a timeout (default: 5000ms)
  const scanDevices = async (timeout: number = 5000): Promise<void> => {
    const permissionGranted = await requestLocationPermission();
    const bluetoothPermissionGranted = await requestBluetoothPermissions();
    if (!permissionGranted || !bluetoothPermissionGranted) {
      console.warn('Location or Bluetooth permission not granted. Aborting scan.');
      return;
    }

    try {
      const foundDevices = await bluetoothService.scanForDevices(timeout);
      const uniqueDevices = Array.from(new Map(foundDevices.map(d => [d.id, d])).values());
      setDevices(uniqueDevices);
    } catch (error) {
      console.error('Scan error:', error);
    }
  };

  const connect = async (device: BluetoothDevice): Promise<boolean> => {
    try {
      const success = await bluetoothService.connectToDevice(device);
      if (success) {
        console.log('Connected to device:', device);
        // Redux will handle the connected state
      }
      return success;
    } catch (error) {
      console.error('Connect error:', error);
      return false;
    }
  };

  const disconnect = async (): Promise<boolean> => {
    try {
      const success = await bluetoothService.disconnect();
      // Redux will handle the disconnected state
      return success;
    } catch (error) {
      console.error('Disconnect error:', error);
      return false;
    }
  };

  const readCharacteristic = async (
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<string | null> => {
    if (!isConnected || !deviceId) return null;
    try {
      const value = await bluetoothService.readCharacteristic(
        deviceId,
        serviceUUID,
        characteristicUUID
      );
      setReadValue(value);
      return value;
    } catch (error) {
      console.error('Read characteristic error:', error);
      return null;
    }
  };

  const writeCharacteristic = async (
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<boolean> => {
    if (!isConnected || !deviceId) return false;
    try {
      return await bluetoothService.writeCharacteristic(
        deviceId,
        serviceUUID,
        characteristicUUID,
        value
      );
    } catch (error) {
      console.error('Write characteristic error:', error);
      return false;
    }
  };

  const monitorCharacteristic = async (
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: any, characteristic: any) => void
  ): Promise<void> => {
    if (!isConnected || !deviceId) return;
    try {
      await bluetoothService.monitorCharacteristic(
        deviceId,
        serviceUUID,
        characteristicUUID,
        listener
      );
    } catch (error) {
      console.error('Monitor characteristic error:', error);
    }
  };

  const getDeviceServices = async () => {
    if (!isConnected || !deviceId) return [];
    try {
      return await bluetoothService.getDeviceServices(deviceId);
    } catch (error) {
      console.error('Get device services error:', error);
      return [];
    }
  };

  const handleGetDeviceServices = async () => {
    if (!isConnected || !deviceId) {
      console.log('Device is not connected');
      return;
    }
  
    const services = await bluetoothService.getDeviceServices(deviceId);
    console.log('Device Services:', services);
  
    services.forEach(service => {
      console.log(`Service UUID: ${service.serviceUUID}`);
      service.characteristics.forEach(characteristic => {
        console.log(`  Characteristic UUID: ${characteristic.uuid}`);
      });
    });

    // const data = await readCharacteristic("12345678-1234-5678-1234-56789abcdef0", "abcdef01-1234-5678-1234-56789abcdef0");
    // const decodedData = data ? atob(data) : null;
    // console.log(decodedData);
    // console.log('Data:', data);
    // const base64String = data;
    // const buffer = Buffer.from(base64String, 'base64');
    // const text = buffer.toString('utf-8');

    // console.log('Decoded text:', text);
    };

  useEffect(() => {
    if (isConnected && deviceId) {
      handleGetDeviceServices();
    }
  }, [isConnected, deviceId]);

  return {
    devices,
    isConnected,
    deviceName,
    deviceId,
    readValue,
    scanDevices,
    connect,
    disconnect,
    readCharacteristic,
    writeCharacteristic,
    monitorCharacteristic,
    getDeviceServices,
  };
};
