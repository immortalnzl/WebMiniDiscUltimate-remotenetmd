import React, { useState, useCallback, useEffect } from 'react';
import { useDispatch, useShallowEqualSelector } from '../frontend-utils';
import { actions as playlistActions } from '../redux/playlist-feature';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    IconButton,
    Box,
    Typography,
    Card,
    CardContent,
    CardMedia,
    Chip,
    Stack,
    Alert,
    Divider,
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    FolderOpen as FolderOpenIcon,
    MusicNote as MusicNoteIcon,
    Album as AlbumIcon,
    Add as AddIcon,
    Close as CloseIcon,
    LocalFireDepartment as BurnIcon,
} from '@mui/icons-material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
    container: {
        display: 'flex',
        gap: theme.spacing(2),
        height: '100%',
    },
    playlistList: {
        width: 300,
        maxWidth: '100%',
        borderRight: `1px solid ${theme.palette.divider}`,
        overflow: 'auto',
    },
    playlistContent: {
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        color: theme.palette.text.secondary,
    },
    trackCard: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: theme.spacing(1),
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
    },
    trackMedia: {
        width: 60,
        height: 60,
        marginRight: theme.spacing(1),
        borderRadius: theme.shape.borderRadius,
        backgroundColor: theme.palette.action.hover,
    },
    dialogPaper: {
        minHeight: '70vh',
        minWidth: '70vw',
    },
}));

interface PlaylistDialogProps {
    open: boolean;
    onClose: () => void;
}

export const PlaylistDialog: React.FC<PlaylistDialogProps> = ({ open, onClose }) => {
    const { classes } = useStyles();
    const dispatch = useDispatch();
    const playlists = useShallowEqualSelector((state: any) => state.playlist.playlists);
    const currentPlaylistId = useShallowEqualSelector((state: any) => state.playlist.currentPlaylistId);

    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    // Persist playlists to localStorage
    useEffect(() => {
        if (playlists.length > 0) {
            localStorage.setItem('playlists', JSON.stringify(playlists));
        }
    }, [playlists]);

    // Load playlists from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('playlists');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                dispatch(playlistActions.loadPlaylists(parsed));
            } catch (e) {
                console.error('Failed to load playlists', e);
            }
        }
    }, []);

    const currentPlaylist = playlists.find((p: any) => p.id === currentPlaylistId);

    const handleCreatePlaylist = useCallback(() => {
        if (newPlaylistName.trim()) {
            dispatch(playlistActions.createPlaylist({ name: newPlaylistName }));
            setNewPlaylistName('');
        }
    }, [newPlaylistName, dispatch]);

    const handleDeletePlaylist = useCallback((id: string) => {
        if (window.confirm('Delete this playlist?')) {
            dispatch(playlistActions.deletePlaylist(id));
        }
    }, [dispatch]);

    const handleStartEdit = useCallback((id: string, name: string) => {
        setEditingId(id);
        setEditingName(name);
    }, []);

    const handleSaveEdit = useCallback(() => {
        if (editingId && editingName.trim()) {
            dispatch(playlistActions.renamePlaylist({ playlistId: editingId, name: editingName }));
            setEditingId(null);
        }
    }, [editingId, editingName, dispatch]);

    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
    }, []);

    const handleSelectPlaylist = useCallback((id: string) => {
        dispatch(playlistActions.setCurrentPlaylist(id));
    }, [dispatch]);

    const handleRemoveTrack = useCallback((trackIndex: number) => {
        if (currentPlaylistId) {
            dispatch(playlistActions.removeTrackFromPlaylist({ playlistId: currentPlaylistId, trackIndex }));
        }
    }, [currentPlaylistId, dispatch]);

    const handleBurnPlaylist = useCallback(() => {
        if (currentPlaylist && currentPlaylist.tracks.length > 0) {
            dispatch(convertDialogActions.setFiles(currentPlaylist.tracks));
            dispatch(convertDialogActions.setVisible(true));
            onClose();
        }
    }, [currentPlaylist, dispatch, onClose]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"
            PaperProps={{ className: classes.dialogPaper }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>My Playlists</span>
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers className={classes.container}>
                <Box className={classes.playlistList}>
                    <Box sx={{ p: 2 }}>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder="Playlist name"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                            sx={{ mb: 1 }}
                        />
                        <Button
                            variant="contained"
                            fullWidth
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleCreatePlaylist}
                        >
                            New Playlist
                        </Button>
                    </Box>

                    <Divider />

                    <List sx={{ py: 0 }}>
                        {playlists.map((playlist: any) => (
                            <ListItem key={playlist.id} disablePadding secondaryAction={
                                <IconButton
                                    edge="end"
                                    size="small"
                                    onClick={() => handleDeletePlaylist(playlist.id)}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            }>
                                <ListItemButton
                                    selected={currentPlaylistId === playlist.id}
                                    onClick={() => handleSelectPlaylist(playlist.id)}
                                >
                                    <ListItemIcon>
                                        <FolderOpenIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={playlist.name}
                                        secondary={`${playlist.tracks.length} tracks`}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>

                    {playlists.length === 0 && (
                        <Box sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                                No playlists yet
                            </Typography>
                        </Box>
                    )}
                </Box>

                <Box className={classes.playlistContent}>
                    {!currentPlaylist ? (
                        <Box className={classes.emptyState}>
                            <MusicNoteIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                            <Typography variant="body2">
                                Create or select a playlist to get started
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, borderBottom: `1px solid`, borderColor: 'divider' }}>
                                {currentPlaylist.artwork && (
                                    <img src={currentPlaylist.artwork} alt={currentPlaylist.name} style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                                )}
                                <Box sx={{ flexGrow: 1 }}>
                                    {editingId === currentPlaylist.id ? (
                                        <Stack direction="row" gap={1}>
                                            <TextField
                                                size="small"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit();
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
                                                autoFocus
                                            />
                                            <Button size="small" onClick={handleSaveEdit}>Save</Button>
                                            <Button size="small" onClick={handleCancelEdit}>Cancel</Button>
                                        </Stack>
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {currentPlaylist.name}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleStartEdit(currentPlaylist.id, currentPlaylist.name)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        {currentPlaylist.tracks.length} tracks
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                                {currentPlaylist.tracks.length === 0 ? (
                                    <Box className={classes.emptyState}>
                                        <MusicNoteIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                                        <Typography variant="body2">
                                            No tracks in this playlist
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Stack spacing={1}>
                                        {currentPlaylist.tracks.map((track: any, idx: number) => (
                                            <Card key={idx} className={classes.trackCard}>
                                                <CardMedia
                                                    component="img"
                                                    className={classes.trackMedia}
                                                    image={track.artwork || ''}
                                                    alt={track.title}
                                                    onError={(e) => {
                                                        (e.target as any).style.display = 'none';
                                                    }}
                                                />
                                                <CardContent sx={{ flex: 1, p: 1, '&:last-child': { pb: 1 } }}>
                                                    <Typography variant="subtitle2" noWrap>
                                                        {track.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                                        {track.artist}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                                        {track.album}
                                                    </Typography>
                                                </CardContent>
                                                <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                                                    <Chip label={Math.floor(track.duration / 60) + ':' + String(Math.floor(track.duration % 60)).padStart(2, '0')} size="small" />
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleRemoveTrack(idx)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </Card>
                                        ))}
                                    </Stack>
                                )}
                            </Box>
                        </>
                    )}
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
                {currentPlaylist && currentPlaylist.tracks.length > 0 && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<BurnIcon />}
                        onClick={handleBurnPlaylist}
                    >
                        Burn to MD
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};
