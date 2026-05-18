import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CameraState {
  position: 'front' | 'back';
}

const initialState: CameraState = {
  position: 'front',
};

const cameraSlice = createSlice({
  name: 'camera',
  initialState,
  reducers: {
    setCameraPosition: (state, action: PayloadAction<'front' | 'back'>) => {
      state.position = action.payload;
    },
    toggleCameraPosition: (state) => {
      state.position = state.position === 'front' ? 'back' : 'front';
    },
  },
});

export const { setCameraPosition, toggleCameraPosition } = cameraSlice.actions;
export default cameraSlice.reducer; 