import { configureStore } from '@reduxjs/toolkit';
import connectionReducer from './slices/connectionSlice';
import cameraReducer from './slices/cameraSlice';
import practiceReducer from './slices/practiceSlice';
import authReducer from './slices/authSlice';
import coachReducer from './slices/coachSlice';

export const store = configureStore({
  reducer: {
    connection: connectionReducer,
    camera: cameraReducer,
    practice: practiceReducer,
    auth: authReducer,
    coach: coachReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;