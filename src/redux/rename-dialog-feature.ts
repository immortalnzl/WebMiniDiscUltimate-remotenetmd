import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';

export interface RenameDialogState {
    visible: boolean;
    title: string;
    fullWidthTitle: string;
    index: number;
    groupIndex: number | null;
    ofConvert: boolean;
}

const initialState: RenameDialogState = {
    visible: false,
    title: '',
    fullWidthTitle: '',
    index: -1,
    groupIndex: null,
    ofConvert: false,
};

export const slice = createSlice({
    name: 'renameDialog',
    initialState,
    reducers: {
        setVisible: (state: RenameDialogState, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setCurrentName: (state: RenameDialogState, action: PayloadAction<string>) => {
            state.title = action.payload;
        },
        setCurrentFullWidthName: (state: RenameDialogState, action: PayloadAction<string>) => {
            state.fullWidthTitle = action.payload;
        },
        setIndex: (state: RenameDialogState, action: PayloadAction<number>) => {
            state.index = action.payload;
        },
        setGroupIndex: (state: RenameDialogState, action: PayloadAction<number | null>) => {
            state.groupIndex = action.payload;
        },
        setOfConvert: (state: RenameDialogState, action: PayloadAction<boolean>) => {
            state.ofConvert = action.payload;
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
