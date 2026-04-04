import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { enableBatching } from 'redux-batched-actions';
import { AdaptiveFile } from '../utils';

export interface Playlist {
    id: string;
    name: string;
    tracks: AdaptiveFile[];
    createdAt: number;
    artwork?: string;
}

export interface PlaylistState {
    playlists: Playlist[];
    currentPlaylistId: string | null;
}

const initialState: PlaylistState = {
    playlists: [],
    currentPlaylistId: null,
};

const slice = createSlice({
    name: 'playlist',
    initialState,
    reducers: {
        loadPlaylists: (state: PlaylistState, action: PayloadAction<Playlist[]>) => {
            state.playlists = action.payload;
        },
        createPlaylist: (state: PlaylistState, action: PayloadAction<{ name: string; id?: string }>) => {
            const id = action.payload.id ?? `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newPlaylist: Playlist = {
                id,
                name: action.payload.name,
                tracks: [],
                createdAt: Date.now(),
            };
            state.playlists.push(newPlaylist);
            state.currentPlaylistId = id;
        },
        deletePlaylist: (state: PlaylistState, action: PayloadAction<string>) => {
            state.playlists = state.playlists.filter(p => p.id !== action.payload);
            if (state.currentPlaylistId === action.payload) {
                state.currentPlaylistId = state.playlists.length > 0 ? state.playlists[0].id : null;
            }
        },
        addTrackToPlaylist: (state: PlaylistState, action: PayloadAction<{ playlistId: string; track: AdaptiveFile }>) => {
            const playlist = state.playlists.find(p => p.id === action.payload.playlistId);
            if (playlist) {
                // Avoid duplicates
                const exists = playlist.tracks.some(t => t.name === action.payload.track.name && t.artist === action.payload.track.artist);
                if (!exists) {
                    playlist.tracks.push(action.payload.track);
                    // Update artwork from first track
                    if (!playlist.artwork && action.payload.track.artwork) {
                        playlist.artwork = action.payload.track.artwork;
                    }
                }
            }
        },
        removeTrackFromPlaylist: (state: PlaylistState, action: PayloadAction<{ playlistId: string; trackIndex: number }>) => {
            const playlist = state.playlists.find(p => p.id === action.payload.playlistId);
            if (playlist) {
                playlist.tracks.splice(action.payload.trackIndex, 1);
            }
        },
        reorderPlaylistTrack: (state: PlaylistState, action: PayloadAction<{ playlistId: string; from: number; to: number }>) => {
            const playlist = state.playlists.find(p => p.id === action.payload.playlistId);
            if (playlist) {
                const [removed] = playlist.tracks.splice(action.payload.from, 1);
                playlist.tracks.splice(action.payload.to, 0, removed);
            }
        },
        clearPlaylist: (state: PlaylistState, action: PayloadAction<string>) => {
            const playlist = state.playlists.find(p => p.id === action.payload);
            if (playlist) {
                playlist.tracks = [];
            }
        },
        setCurrentPlaylist: (state: PlaylistState, action: PayloadAction<string | null>) => {
            state.currentPlaylistId = action.payload;
        },
        renamePlaylist: (state: PlaylistState, action: PayloadAction<{ playlistId: string; name: string }>) => {
            const playlist = state.playlists.find(p => p.id === action.payload.playlistId);
            if (playlist) {
                playlist.name = action.payload.name;
            }
        },
    },
});

export const { actions } = slice;
export const reducer = enableBatching(slice.reducer) as unknown as typeof slice.reducer;
export default reducer;
