import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import { LocalDatabase } from '../services/library/library';

export interface LocalLibraryState {
    visible: boolean;
    database: LocalDatabase | null;
    status: string | null;
    artists: string[];
    albums: any[];
    scanStatus: any;
    stagedTracks: any[];
}

const initialState: LocalLibraryState = {
    visible: false,
    database: null,
    status: null,
    artists: [],
    albums: [],
    scanStatus: null,
    stagedTracks: [],
};

const slice = createSlice({
    name: 'localLibraryState',
    initialState,
    reducers: {
        setVisible: (state: LocalLibraryState, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setDatabase: (state: LocalLibraryState, action: PayloadAction<LocalDatabase | null>) => {
            state.database = action.payload;
        },
        setStatus: (state: LocalLibraryState, action: PayloadAction<string | null>) => {
            state.status = action.payload;
        },
        setArtists: (state: LocalLibraryState, action: PayloadAction<string[]>) => {
            state.artists = action.payload;
        },
        setAlbums: (state: LocalLibraryState, action: PayloadAction<any[]>) => {
            state.albums = action.payload;
        },
        setScanStatus: (state: LocalLibraryState, action: PayloadAction<any>) => {
            state.scanStatus = action.payload;
        },
        addToStage: (state: LocalLibraryState, action: PayloadAction<any>) => {
            state.stagedTracks.push(action.payload);
        },
        removeFromStage: (state: LocalLibraryState, action: PayloadAction<number>) => {
            state.stagedTracks.splice(action.payload, 1);
        },
        clearStage: (state: LocalLibraryState) => {
            state.stagedTracks = [];
        },
        reorderStage: (state: LocalLibraryState, action: PayloadAction<{ from: number, to: number }>) => {
            const [removed] = state.stagedTracks.splice(action.payload.from, 1);
            state.stagedTracks.splice(action.payload.to, 0, removed);
        }
    },
});

export const { actions } = slice;
export const reducer = enableBatching(slice.reducer) as unknown as typeof slice.reducer;
export default reducer;
