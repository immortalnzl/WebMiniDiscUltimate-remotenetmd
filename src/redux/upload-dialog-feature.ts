import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import type { RootState } from './store';

export interface LoadingDialogState {
    visible: boolean;
    cancelled: boolean;

    writtenProgress: number;
    encryptedProgress: number;
    totalProgress: number;

    trackTotal: number;
    trackConverting: number;
    trackCurrent: number;

    titleCurrent: string;
    titleConverting: string;

    trackEncodeProgress: number;
    trackEncodeProgressOutOf: number;

    progressStartedAt: number | null;
    progressUpdatedAt: number | null;
}

const initialState: LoadingDialogState = {
    visible: false,
    cancelled: false,

    // Current Track Upload
    writtenProgress: 0,
    encryptedProgress: 0,
    totalProgress: 1,

    // Tracks done
    trackTotal: 1,
    trackConverting: 0,
    trackCurrent: 0,
    titleCurrent: '',
    titleConverting: '',

    trackEncodeProgress: 0,
    trackEncodeProgressOutOf: 0,

    progressStartedAt: null,
    progressUpdatedAt: null,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const slice = createSlice({
    name: 'uploadDialog',
    initialState,
    reducers: {
        setVisible: (state, action: PayloadAction<boolean>) => {
            state.visible = action.payload;
        },
        setWriteProgress: (state, action: PayloadAction<{ written: number; encrypted: number; total: number; timestamp?: number }>) => {
            state.encryptedProgress = action.payload.encrypted;
            state.writtenProgress = action.payload.written;
            state.totalProgress = action.payload.total;
            state.progressUpdatedAt = action.payload.timestamp ?? state.progressUpdatedAt;
        },
        setCancelUpload: (state, action: PayloadAction<boolean>) => {
            state.cancelled = action.payload;
        },
        setTrackProgress: (
            state,
            action: PayloadAction<{
                total: number;
                current: number;
                converting: number;
                titleCurrent: string;
                titleConverting: string;
                timestamp?: number;
            }>
        ) => {
            state.trackTotal = action.payload.total;
            state.trackCurrent = action.payload.current;
            state.trackConverting = action.payload.converting;
            state.titleCurrent = action.payload.titleCurrent;
            state.titleConverting = action.payload.titleConverting;
            state.progressUpdatedAt = action.payload.timestamp ?? state.progressUpdatedAt;
        },
        setTrackEncodingProgress: (state, action: PayloadAction<{ state: number; total: number; timestamp?: number }>) => {
            state.trackEncodeProgress = action.payload.state;
            state.trackEncodeProgressOutOf = action.payload.total;
            state.progressUpdatedAt = action.payload.timestamp ?? state.progressUpdatedAt;
        },
        setProgressStartedAt: (state, action: PayloadAction<number | null>) => {
            state.progressStartedAt = action.payload;
            state.progressUpdatedAt = action.payload;
        },
    },
});

export const selectAggregateUploadProgress = (state: RootState) => {
    const uploadDialog = state.uploadDialog;
    const trackTotal = Math.max(0, uploadDialog.trackTotal);
    const totalUnits = trackTotal * 2;
    const startedAt = uploadDialog.progressStartedAt;
    const updatedAt = uploadDialog.progressUpdatedAt;

    const convertedTracks = clamp(uploadDialog.trackConverting, 0, trackTotal);
    const currentEncodeProgress =
        uploadDialog.trackEncodeProgressOutOf > 0 && convertedTracks < trackTotal
            ? clamp(uploadDialog.trackEncodeProgress / uploadDialog.trackEncodeProgressOutOf, 0, 1)
            : 0;
    const conversionUnits = clamp(convertedTracks + currentEncodeProgress, 0, trackTotal);

    const transferredTracks = clamp(uploadDialog.trackCurrent > 0 ? uploadDialog.trackCurrent - 1 : 0, 0, trackTotal);
    const currentTransferProgress =
        uploadDialog.totalProgress > 0 && uploadDialog.trackCurrent > 0 && transferredTracks < trackTotal
            ? clamp(uploadDialog.writtenProgress / uploadDialog.totalProgress, 0, 1)
            : 0;
    const transferUnits = clamp(transferredTracks + currentTransferProgress, 0, trackTotal);

    const completedUnits = clamp(conversionUnits + transferUnits, 0, totalUnits);
    const progressPercent = totalUnits === 0 ? 0 : Math.floor((completedUnits / totalUnits) * 100);
    const completedTracks = Math.floor(transferUnits);
    const elapsedMs = startedAt !== null && updatedAt !== null ? Math.max(0, updatedAt - startedAt) : 0;
    const estimatedRemainingMs =
        completedUnits > 0 && elapsedMs > 0 ? Math.ceil((elapsedMs * (totalUnits - completedUnits)) / completedUnits) : null;

    return {
        completedTracks,
        totalTracks: trackTotal,
        progressPercent,
        elapsedMs,
        estimatedRemainingMs,
    };
};

export const { reducer, actions } = slice;
export default enableBatching(reducer);
