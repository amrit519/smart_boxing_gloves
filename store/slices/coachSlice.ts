import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LiveStudentData } from '@/types/database';

interface CoachState {
    students: LiveStudentData[];
    selectedClub: string | null;
    liveStudentIds: string[];
}

const initialState: CoachState = {
    students: [],
    selectedClub: null,
    liveStudentIds: []
};

const coachSlice = createSlice({
    name: 'coach',
    initialState,
    reducers: {
        setStudents: (state, action: PayloadAction<LiveStudentData[]>) => {
            state.students = action.payload;
            state.liveStudentIds = action.payload
                .filter(s => s.is_live)
                .map(s => s.user_id);
        },
        updateStudentLiveData: (state, action: PayloadAction<LiveStudentData>) => {
            const idx = state.students.findIndex(s => s.user_id === action.payload.user_id);
            if (idx >= 0) {
                state.students[idx] = action.payload;
            } else {
                state.students.push(action.payload);
            }
            state.liveStudentIds = state.students
                .filter(s => s.is_live)
                .map(s => s.user_id);
        },
        setSelectedClub: (state, action: PayloadAction<string | null>) => {
            state.selectedClub = action.payload;
        },
    },
});

export const { setStudents, updateStudentLiveData, setSelectedClub } = coachSlice.actions;
export default coachSlice.reducer;
