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
}

const initialState: LocalLibraryState = {
    visible: false,
    database: null,
    status: null,
    artists: [],
    albums: [],
    scanStatus: null,
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
    },
});

export const { actions, reducer } = slice;
export default enableBatching(reducer);
