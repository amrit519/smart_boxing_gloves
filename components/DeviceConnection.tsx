import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { IconSymbol } from './ui/IconSymbol';
import { THEME_COLOR } from '@/constants/Colors';
import { useAppSelector } from '@/store/hooks';
import { useBluetooth } from '@/hooks/useBluetooth';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Device {
  id: string;
  name: string;
  signal: 'Strong' | 'Medium' | 'Weak';
  type: 'robot' | 'car' | 'drone' | 'controller' | 'smartrc';
}

export function EmptyState({ type }: { type: 'nearby' | 'recent' }) {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;

  return (
    <View style={[styles.emptyStateContainer, { backgroundColor: theme.surface }]}>
      <View style={[styles.emptyStateIconContainer, { backgroundColor: `${theme.primary}15` }]}>
        <IconSymbol 
          name={type === 'nearby' ? 'search' : 'clock'} 
          size={24} 
          color={theme.primary} 
        />
      </View>
      <ThemedText style={styles.emptyStateTitle}>
        {type === 'nearby' ? 'No Device Found' : 'No Recent Devices'}
      </ThemedText>
      <ThemedText style={[styles.emptyStateSubtitle, { color: theme.secondary }]}>
        {type === 'nearby' 
          ? 'No devices found for pairing' 
          : 'Previously connected devices will appear here'
        }
      </ThemedText>
    </View>
  );
}

export function DeviceConnection() {

  const TargetDeviceName = 'ESP32_RIGHT'; // Change this to your target device name
  const { isConnected, deviceName } = useAppSelector(state => state.connection);
  const [isScanning, setIsScanning] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);

  // Load recent devices from storage on component mount
  useEffect(() => {
    const loadRecentDevices = async () => {
      try {
        const storedDevices = await AsyncStorage.getItem('recentDevices');
        if (storedDevices) {
          setRecentDevices(JSON.parse(storedDevices));
        }
      } catch (error) {
        console.error('Error loading recent devices:', error);
      }
    };
    loadRecentDevices();
  }, []);

  // Save recent devices to storage whenever they change
  useEffect(() => {
    const saveRecentDevices = async () => {
      try {
        await AsyncStorage.setItem('recentDevices', JSON.stringify(recentDevices));
      } catch (error) {
        console.error('Error saving recent devices:', error);
      }
    };
    saveRecentDevices();
  }, [recentDevices]);

  // Using the custom Bluetooth hook for scanning, connecting, and disconnecting.
  const { devices: scannedDevices, connect, disconnect, scanDevices } = useBluetooth();

  // Convert scanned devices (from BluetoothDevice) to local Device type with default values.
  const convertedNearbyDevices: Device[] = scannedDevices.map(device => ({
    id: device.id,
    name: device.name,
    signal: 'Strong', // default value
    type: 'robot',    // default value
  }))
  .filter(device => device.name === TargetDeviceName); // Filter to only include devices with the target name

  const handleScan = async () => {
    setIsScanning(true);
    await scanDevices(5000);
    setIsScanning(false);
  };

  const handleConnect = async (device: Device) => { 
    if ( device.name !== TargetDeviceName) {
       console.warn(`Device ${device.name} does not match target device name ${TargetDeviceName}. Skipping connection.`);
       return;
    } // Ensure we only connect to the target device


    if (isConnected || connectingDeviceId) return;
    setConnectingDeviceId(device.id);
    try {
      // The hook's connect function expects a BluetoothDevice object
      await connect({ id: device.id, name: device.name });
      
      // After successful connection, update recent devices
      setRecentDevices(prevDevices => {
        // Remove the device if it already exists in the list
        const filteredDevices = prevDevices.filter(d => d.id !== device.id);
        // Add the device to the beginning of the list
        return [device, ...filteredDevices].slice(0, 5); // Keep only the 5 most recent devices
      });
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!isConnected || isDisconnecting) return;
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'robot':
        return 'android';
      case 'car':
        return 'directions-car';
      case 'drone':
        return 'flight';
      case 'controller':
        return 'gamepad';
      case 'smartrc':
        return 'remote-control';
      default:
        return 'bluetooth';
    }
  };
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;

const allowedRecentDevices = recentDevices.filter(device => device.name === TargetDeviceName);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          <Image 
            source={require('../assets/images/robot-avatar.png')} 
            style={styles.robotImage}
          />
          <ThemedText type="title" style={styles.title}>
            {isConnected ? 'Shh.. Baby Sleeping and Dreaming' : 'Connect Your Device'}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {isConnected 
              ? `Your ${deviceName} is ready`
              : 'Discover and pair with nearby BabyNidra'
            }
          </ThemedText>
          {isConnected ? (
            <TouchableOpacity 
              style={[styles.disconnectButton, isDisconnecting && styles.disconnectButtonActive, { backgroundColor: theme.surface }]} 
              onPress={handleDisconnect}
              disabled={isDisconnecting}
            >
              <IconSymbol name="bluetooth" size={16} color={THEME_COLOR} />
              <ThemedText style={styles.disconnectButtonText}>
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect Device'}
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.scanButton, isScanning && styles.scanButtonActive]} 
              onPress={handleScan}
              disabled={isScanning}
            >
              <IconSymbol name="search" size={16} color="white" />
              <ThemedText style={styles.scanButtonText}>
                {isScanning ? 'Scanning...' : 'Scan for Devices'}
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Nearby Devices */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Nearby Devices
            </ThemedText>
            {convertedNearbyDevices.length > 0 ? (
              convertedNearbyDevices.map((device) => (
                <View key={device.id} style={[styles.deviceItem, { backgroundColor: theme.surface }]}>
                  <View style={styles.deviceInfo}>
                    <View style={[styles.deviceIconContainer, { backgroundColor: '#9BA1A6' }]}>
                      <IconSymbol name={getDeviceIcon(device.type)} size={16} color={theme.background} />
                    </View>
                    <View>
                      <ThemedText type="defaultSemiBold" style={styles.deviceName}>
                        {device.name}
                      </ThemedText>
                      <ThemedText style={styles.signalText}>Signal: {device.signal}</ThemedText>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.connectButton,
                      (isConnected || connectingDeviceId === device.id) && styles.connectButtonDisabled
                    ]}
                    onPress={() => handleConnect(device)}
                    disabled={isConnected || !!connectingDeviceId}
                  >
                    <ThemedText style={styles.connectButtonText}>
                      {connectingDeviceId === device.id ? 'Connecting...' : 'Connect'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <EmptyState type="nearby" />
            )}
          </View>

          {/* Recent Devices */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Recent Devices
            </ThemedText>
            {recentDevices.length > 0 ? (
              <View style={styles.recentDevicesGrid} >
                {recentDevices.map((device) => (
                  <TouchableOpacity 
                    key={device.id} 
                    style={[
                      styles.recentDeviceItem,
                      (isConnected || connectingDeviceId === device.id) && styles.recentDeviceItemDisabled,
                      { backgroundColor: theme.surface }
                    ]}
                    onPress={() => handleConnect(device)}
                    disabled={isConnected || !!connectingDeviceId}
                  >
                    <View style={[styles.recentDeviceIcon, { backgroundColor: '#9BA1A6' }]} >
                      <IconSymbol name={getDeviceIcon(device.type)} size={20} color={theme.background} />
                    </View>
                    <ThemedText style={styles.recentDeviceName}>
                      {device.name}
                    </ThemedText>
                    {connectingDeviceId === device.id && (
                      <ThemedText style={styles.connectingText}>Connecting...</ThemedText>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <EmptyState type="recent" />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME_COLOR,
    marginRight: 6,
  },
  statusDotInactive: {
    backgroundColor: '#687076',
  },
  mainContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  robotImage: {
    width: 200,
    height: 200,
    marginBottom: -10,
  },
  title: {
    fontSize: 24,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    color: '#687076',
  },
  scanButton: {
    backgroundColor: 'rgba(0, 174, 239, 0.9)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    width: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  scanButtonActive: {
    backgroundColor: '#0098CE',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 12,
    marginBottom: 8,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 14,
  },
  signalText: {
    fontSize: 12,
    color: '#687076',
  },
  connectButton: {
    backgroundColor: THEME_COLOR,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  recentDevicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentDeviceItem: {
    width: '30%',
    // aspectRatio: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentDeviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  recentDeviceName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#687076',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: 'rgba(31, 38, 135, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyStateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  recentDeviceItemDisabled: {
    opacity: 0.5,
  },
  connectingText: {
    fontSize: 10,
    color: THEME_COLOR,
    marginTop: 4,
  },
  disconnectButton: {
    // backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    width: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: THEME_COLOR,
  },
  disconnectButtonActive: {
    opacity: 0.7,
  },
  disconnectButtonText: {
    color: THEME_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
});
