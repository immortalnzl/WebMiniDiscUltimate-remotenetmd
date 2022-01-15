import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import { CustomParameters } from '../services/service-manager';

export interface OtherDeviceDialogState {
    visible: boolean;
    selectedServiceIndex: number;
    customParameters: CustomParameters;
}

const initialState: OtherDeviceDialogState = {
    visible: false,
    selectedServiceIndex: 0,
    customParameters: {},
};

export const slice = createSlice({
    name: 'otherDeviceDialog',
    initialState,
    reducers: {
        setVisible: (state: OtherDeviceDialogState, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setSelectedServiceIndex: (state: OtherDeviceDialogState, action: PayloadAction<number>) => {
            state.selectedServiceIndex = action.payload;
        },
        setCustomParameters: (state: OtherDeviceDialogState, action: PayloadAction<CustomParameters>) => {
            state.customParameters = action.payload;
        },
    },
});

export const { reducer, actions } = slice;
export default enableBatching(reducer);
