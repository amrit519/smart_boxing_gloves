import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ConnectionState {
  isConnected: boolean;
  deviceName: string | null;
  deviceId: string | null;
  batteryLevel: number;
  connectedSince: string | null;
  firmwareVersion: string | null;
  hardwareId: string | null; // IMEI or hardware ID fetched from ESP32
}


const initialState: ConnectionState = {
  isConnected: false,
  deviceName: null,
  deviceId: null,
  batteryLevel: 0,
  connectedSince: null,
  firmwareVersion: "N/A",
  hardwareId: null,
};


const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (action.payload) {
        state.connectedSince = new Date().toISOString();
      } else {
        state.connectedSince = null;
        state.deviceName = null;
        state.deviceId = null;
        state.batteryLevel = 0;
        state.firmwareVersion = "N/A";
      }
    },

    setDeviceInfo: (state, action: PayloadAction<{ name: string; deviceId: string; batteryLevel: number; firmwareVersion: string }>) => {
      state.deviceName = action.payload.name;
      state.deviceId = action.payload.deviceId;
      state.batteryLevel = action.payload.batteryLevel;
      state.firmwareVersion = action.payload.firmwareVersion;
    },

    setHardwareId: (state, action: PayloadAction<string>) => {
      state.hardwareId = action.payload;
    },

  },
});

export const { setConnectionStatus, setDeviceInfo, setHardwareId } = connectionSlice.actions;
export default connectionSlice.reducer;