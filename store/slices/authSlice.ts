import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Profile } from '@/types/database';

interface AuthState {
    user: { id: string; email?: string; phone?: string } | null;
    profile: Profile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const initialState: AuthState = {
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<{ id: string; email?: string; phone?: string } | null>) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
            state.isLoading = false;
        },
        setProfile: (state, action: PayloadAction<Profile | null>) => {
            state.profile = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        logout: (state) => {
            state.user = null;
            state.profile = null;
            state.isAuthenticated = false;
            state.isLoading = false;
        },
    },
});

export const { setUser, setProfile, setLoading, logout } = authSlice.actions;
export default authSlice.reducer;
