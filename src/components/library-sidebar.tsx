import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useShallowEqualSelector, useDispatch } from '../frontend-utils';
import { actions as localLibraryActions } from '../redux/local-library-feature';
import { loadLibraryDatabase, loadLibraryStatus, loadArtists, loadAlbums } from '../redux/actions';
import serviceRegistry from '../services/registry';
import { File, FileBrowser } from './file-browser/browser';
import { FileType } from './file-browser/utils';
import { LocalDatabase } from '../services/library/library';
import { makeStyles } from 'tss-react/mui';
import { 
    Typography, Box, InputBase, Paper, IconButton, Tabs, Tab, 
    LinearProgress, Button, Slider, Avatar, Tooltip,
    Grid, Card, CardMedia, CardContent, CardActionArea, Snackbar, Alert
} from '@mui/material';
import { 
    Search, Folder, Description, PlayArrow, Add, GridView, 
    List, Fullscreen, FullscreenExit, Album, MusicNote, 
    Settings, Refresh, Stop, VolumeUp, Pause 
} from '@mui/icons-material';
import { AdaptiveFile, loadPreference, savePreference } from '../utils';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';
import { LibrarySettingsDialog } from './library-settings-dialog';
import { PlaylistDialog } from './playlist-dialog';
import audioPlayerService from '../services/player/audio-player-service';

const useStyles = makeStyles()((theme: any) => ({
    root: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.default,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        '&::-webkit-scrollbar': {
            width: '6px',
        },
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
        },
    },
    rootExpanded: {
        width: '100%',
    },
    header: {
        padding: theme.spacing(1, 2),
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
    },
    statusCard: {
        margin: theme.spacing(1, 2),
        padding: theme.spacing(1.5),
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    search: {
        display: 'flex',
        alignItems: 'center',
        padding: '2px 8px',
        backgroundColor: theme.palette.background.default,
        borderRadius: theme.shape.borderRadius,
        margin: theme.spacing(0, 2, 1, 2),
        border: `1px solid ${theme.palette.divider}`,
    },
    input: {
        marginLeft: theme.spacing(1),
        flex: 1,
        fontSize: '0.9rem',
    },
    browserWrapper: {
        flexGrow: 1,
        overflow: 'auto',
        padding: theme.spacing(1),
    },
    tabPanel: {
        height: '100%',
        overflow: 'auto',
    },
    card: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.shadows[4],
        }
    },
    media: {
        aspectRatio: '1/1',
        backgroundColor: theme.palette.action.hover,
    },
    playerMiniModern: {
        background: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(1.5),
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(2),
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
    },
    minimizedRoot: {
        width: 48,
        alignItems: 'center',
        padding: theme.spacing(1, 0),
        gap: theme.spacing(2),
        backgroundColor: theme.palette.background.paper,
    },
    verticalTitle: {
        writingMode: 'vertical-rl',
        textTransform: 'uppercase',
        letterSpacing: 2,
        opacity: 0.5,
        margin: theme.spacing(2, 0),
        userSelect: 'none',
    }
}));

export const MusicLibrarySidebar = ({ isExpanded, isMinimized, onToggleExpand, onToggleMinimize }: { 
    isExpanded: boolean;
    isMinimized: boolean;
    onToggleExpand: () => void;
    onToggleMinimize: () => void;
}) => {
    const { classes, cx } = useStyles();
    const dispatch = useDispatch();
    
    // Core state from Redux
    const database = useShallowEqualSelector((state: any) => state.localLibrary.database);
    const artists = useShallowEqualSelector((state: any) => state.localLibrary.artists);
    const albums = useShallowEqualSelector((state: any) => state.localLibrary.albums);
    const scanStatus = useShallowEqualSelector((state: any) => state.localLibrary.scanStatus);
    const stagedTracks = useShallowEqualSelector((state: any) => state.localLibrary.stagedTracks);
    const uploadedFiles = useShallowEqualSelector((state: any) => state.convertDialog.files);

    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [tabValue, setTabValue] = useState(2); // Default to Albums
    const [gridColumns, setGridColumns] = useState(loadPreference('library-grid-columns', 6));
    const [filterArtist, setFilterArtist] = useState<string | null>(null);
    const [filterAlbum, setFilterAlbum] = useState<string | null>(null);
    
    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(loadPreference('player-volume', 0.8));
    const [audioError, setAudioError] = useState<React.ReactNode | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [addedSnackbarOpen, setAddedSnackbarOpen] = useState(false);
    const [lastAddedTitle, setLastAddedTitle] = useState('');

    const handleRefresh = useCallback(() => {
        dispatch(loadLibraryDatabase());
        dispatch(loadArtists());
        dispatch(loadAlbums());
    }, [dispatch]);

    // Derived State
    const visualArtists = useMemo(() => {
        return artists.map((name: string) => {
            const firstAlbum = albums.find((a: any) => a.artist === name);
            return { name, artwork: firstAlbum?.artwork || null };
        });
    }, [artists, albums]);

    const handleStartScan = async () => {
        try {
            await fetch('/api/scan', { method: 'POST' });
        } catch (e) {
            console.error("Failed to start scan", e);
        }
    };

    useEffect(() => {
        if (!audioRef.current) return;
        audioRef.current.volume = volume;
    }, [volume]);

    const handlePlayTrack = useCallback(async (file: File) => {
        const { libraryService } = serviceRegistry;
        if (!libraryService) return;
        const filePath = file.props?.['id'];
        if (filePath) {
            const url = libraryService.getAudioUrl(filePath);
            if (url) {
                const trackData = {
                    ...file.props,
                    id: filePath,
                    url
                };
                
                setCurrentTrack(trackData);
                setAudioError(null);
                setIsPlaying(true);

                try {
                    await audioPlayerService.play(url);
                } catch (e) {
                    console.error("Playback error", e);
                    setAudioError("Failed to decode audio. Check if ffmpeg-core.js is available.");
                    setIsPlaying(false);
                }
            }
        }
    }, []);

    const handleTogglePlay = useCallback(() => {
        if (isPlaying) {
            audioPlayerService.pause();
            setIsPlaying(false);
        } else if (currentTrack) {
            audioPlayerService.resume();
            setIsPlaying(true);
        }
    }, [isPlaying, currentTrack]);

    const handleStopPlayback = useCallback(() => {
        audioPlayerService.stop();
        setIsPlaying(false);
    }, []);

    const handleSeek = (_: any, value: number | number[]) => {
        const time = value as number;
        setCurrentTime(time);
        audioPlayerService.seek(time);
    };

    const handleVolumeChange = (_: any, value: number | number[]) => {
        const v = value as number;
        setVolume(v);
        savePreference('player-volume', v);
    };

    const handleGridColumnsChange = (_: any, v: number | number[]) => {
        setGridColumns(v as number);
        savePreference('library-grid-columns', v);
    };

    const handleAddToPlaylist = useCallback((files: File[]) => {
        const { libraryService } = serviceRegistry;
        if (!libraryService) return;

        const newAdaptiveFiles: AdaptiveFile[] = files
            .filter(f => f.type === FileType.File)
            .map((file: File) => ({
                name: file.name,
                title: file.props?.title || file.name,
                duration: file.props?.duration || 0,
                artist: file.props?.artist || 'Unknown Artist',
                album: file.props?.album || 'Unknown Album',
                artwork: file.props?.artwork,
                getForEncoding: async (params: any) => {
                    return libraryService.processLocalLibraryFile(file.props?.['id'], params);
                }
            }));

        if (newAdaptiveFiles.length > 0) {
            dispatch(convertDialogActions.setFiles([...uploadedFiles, ...newAdaptiveFiles]));
            dispatch(convertDialogActions.setVisible(true));

            // Also keep in sidebar stage for internal tracking
            files.forEach(f => {
                if (f.type === FileType.File) {
                    dispatch(localLibraryActions.addToStage({ ...f.props, id: f.props?.['id'] }));
                }
            });

            setLastAddedTitle(newAdaptiveFiles.length === 1 ? (newAdaptiveFiles[0].title) : `${newAdaptiveFiles.length} tracks`);
            setAddedSnackbarOpen(true);
        }
    }, [dispatch, uploadedFiles]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const convertToFileArray = (data: LocalDatabase, path: string[] = []): File[] => {
        let currentData = data;
        const originalPath = [...path];
        const pathCopy = [...path];
        try {
            while(pathCopy.length){
                const part = pathCopy.shift();
                if (part && (currentData as any)[part]) {
                    currentData = (currentData as any)[part];
                }
            }
        } catch (e) {
            return [];
        }
        
        return Object.entries(currentData).map(([key, value]) => {
            const isFolder = !('artist' in value);
            return {
                name: key,
                type: isFolder ? FileType.Directory : FileType.File,
                props: isFolder ? {} : {
                    ...value,
                    id: [...originalPath, key].join('/'),
                },
            };
        });
    };

    const [currentFileTree, setCurrentFileTree] = useState<File[]>([]);

    useEffect(() => {
        if (database) {
            setCurrentFileTree(convertToFileArray(database, currentPath));
        }
    }, [database, currentPath]);

    const allTracks = useMemo(() => {
        if (!database) return [];
        const flatten = (db: LocalDatabase, path: string[] = []): File[] => {
            let res: File[] = [];
            for (const [key, value] of Object.entries(db)) {
                if (value && typeof value === 'object' && 'artist' in value) {
                    res.push({
                        name: key,
                        type: FileType.File,
                        props: { ...(value as any), id: [...path, key].join('/') }
                    });
                } else if (value && typeof value === 'object') {
                    res.push(...flatten(value as LocalDatabase, [...path, key]));
                }
            }
            return res;
        };
        return flatten(database);
    }, [database]);

    const scanFinishedRef = useRef(false);

    useEffect(() => {
        const loadStatus = () => {
            if (isExpanded) {
                dispatch(loadLibraryStatus());
            }
        };
        loadStatus();
        const pollInterval = scanStatus?.scanning ? 2000 : 30000;
        const interval = setInterval(loadStatus, pollInterval);
        return () => clearInterval(interval);
    }, [dispatch, isExpanded, scanStatus?.scanning]);
    
    useEffect(() => {
        if (scanStatus && !scanStatus.scanning) {
            if (!scanFinishedRef.current) {
                dispatch(loadLibraryDatabase());
                dispatch(loadArtists());
                dispatch(loadAlbums());
                scanFinishedRef.current = true;
            }
        } else if (scanStatus?.scanning) {
            scanFinishedRef.current = false;
        }
    }, [scanStatus?.scanning, dispatch]);

    const handleFileAction = useCallback((file: File) => {
        if (file.type === FileType.Directory) {
            setCurrentPath((prev: string[]) => [...prev, file.name]);
        } else {
            handleAddToPlaylist([file]);
        }
    }, [handleAddToPlaylist]);

    const renderGridView = (files: File[]) => (
        <Grid container spacing={2}>
            {files.map((file: File) => (
                <Grid item xs={12} sm={6} md={12 / gridColumns} key={file.name}>
                    <Card className={classes.card}>
                        <Box sx={{ position: 'relative' }}>
                            <CardActionArea onClick={() => handleFileAction(file)}>
                                <CardMedia
                                    className={classes.media}
                                    image={file.props?.artwork || ''}
                                    title={file.name}
                                >
                                    {(!file.props?.artwork) && (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                            {file.type === FileType.Directory ? <Album sx={{ fontSize: 48, color: 'action.disabled' }} /> : <MusicNote sx={{ fontSize: 48, color: 'action.disabled' }} />}
                                        </Box>
                                    )}
                                </CardMedia>
                                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                    <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                        {file.name}
                                    </Typography>
                                    {file.type === FileType.File && (
                                        <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ fontSize: '0.7rem' }}>
                                            {file.props?.artist}
                                        </Typography>
                                    )}
                                </CardContent>
                            </CardActionArea>
                            {file.type === FileType.File && (
                                <Box sx={{ position: 'absolute', top: 5, right: 5, display: 'flex', gap: 0.5, opacity: currentTrack?.id === file.props?.['id'] ? 1 : 0, transition: 'opacity 0.2s', '.MuiCard-root:hover &': { opacity: 1 } }}>
                                    <IconButton 
                                        size="small" 
                                        sx={{ 
                                            bgcolor: currentTrack?.id === file.props?.['id'] ? 'primary.main' : 'background.paper', 
                                            color: currentTrack?.id === file.props?.['id'] ? 'white' : 'inherit',
                                            '&:hover': { bgcolor: 'primary.main', color: 'white' } 
                                        }} 
                                        onClick={(e: any) => { e.stopPropagation(); (currentTrack?.id === file.props?.['id']) ? handleTogglePlay() : handlePlayTrack(file); }}
                                    >
                                        {currentTrack?.id === file.props?.['id'] && isPlaying ? <Pause fontSize="inherit" /> : <PlayArrow fontSize="inherit" />}
                                    </IconButton>
                                    <IconButton size="small" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'secondary.main', color: 'white' } }} onClick={(e: any) => { e.stopPropagation(); handleAddToPlaylist([file]); }}>
                                        <Add fontSize="inherit" />
                                    </IconButton>
                                </Box>
                            )}
                        </Box>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );

    return (
        <Box className={cx(classes.root, isExpanded && classes.rootExpanded, isMinimized && classes.minimizedRoot)}>
            {isMinimized ? (
                <>
                    <Tooltip title="Expand Library" placement="right">
                        <IconButton onClick={onToggleMinimize} size="small">
                            <GridView />
                        </IconButton>
                    </Tooltip>
                    <Box className={classes.verticalTitle}>
                        <Typography variant="caption">Music Library</Typography>
                    </Box>
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title="Refresh" placement="right">
                        <IconButton onClick={handleRefresh} size="small">
                            <Refresh fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </>
            ) : (
                <>
            <Box className={classes.header}>
                <Box className={classes.headerActions}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Music Library</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Playlists">
                            <IconButton size="small" onClick={() => setPlaylistDialogOpen(true)}>
                                <Album fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Refresh Library">
                            <IconButton onClick={handleRefresh} size="small">
                                <Refresh fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Settings">
                            <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                                <Settings fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Minimize">
                            <IconButton size="small" onClick={onToggleMinimize}>
                                <FullscreenExit fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={isExpanded ? "Restore" : "Maximize"}>
                            <IconButton size="small" onClick={onToggleExpand}>
                                {isExpanded ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>

            {(!scanStatus || (!scanStatus.scanning && scanStatus.files_found === 0)) ? (
                <Box className={classes.statusCard} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">Library not scanned</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>Check settings</Typography>
                </Box>
            ) : (
                <Box className={classes.statusCard}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {scanStatus.scanning ? "Scanning..." : "Library Ready"}
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {scanStatus.current_activity}
                    </Typography>
                    <LinearProgress 
                        variant={scanStatus.scanning ? "indeterminate" : "determinate"} 
                        value={100} 
                        sx={{ height: 4, borderRadius: 2, mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box><Typography variant="caption" color="text.secondary">Tracks</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.files_found}</Typography></Box>
                        <Box><Typography variant="caption" color="text.secondary">Artists</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.artists_found}</Typography></Box>
                        <Box><Typography variant="caption" color="text.secondary">Albums</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.albums_found}</Typography></Box>
                    </Box>
                </Box>
            )}

            <Tabs value={tabValue} onChange={(_: any, v: number) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
                <Tab icon={<Folder />} label="Folders" />
                <Tab icon={<MusicNote />} label="Artists" />
                <Tab icon={<Album />} label="Albums" />
            </Tabs>

            <Paper className={classes.search}>
                <Search color="disabled" sx={{ fontSize: 20 }} />
                <InputBase className={classes.input} placeholder="Search..." />
                <IconButton size="small" onClick={() => setViewMode((v: 'list' | 'grid') => v === 'list' ? 'grid' : 'list')}>
                    {viewMode === 'list' ? <GridView fontSize="inherit" /> : <List fontSize="inherit" />}
                </IconButton>
                {viewMode === 'grid' && (
                    <Slider size="small" value={gridColumns} min={2} max={10} onChange={handleGridColumnsChange} sx={{ width: 60, ml: 1 }} />
                )}
            </Paper>

            <Box className={classes.browserWrapper}>
                {tabValue === 0 && (
                    <Box className={classes.tabPanel}>
                        {viewMode === 'list' ? (
                            <FileBrowser
                                fileTree={currentFileTree}
                                onFileDoubleClick={handleFileAction}
                                columnNotFoundPlaceholder=""
                                manualName={true}
                                allowMultifileSelection={true}
                                pathString={currentPath.join('/')}
                                iconGenerator={(file: File) => {
                                    const isActive = currentTrack?.id === file.props?.['id'];
                                    if (file.type === FileType.File) {
                                        if (isActive && isPlaying) return <Pause sx={{ color: 'primary.main' }} />;
                                        if (isActive) return <PlayArrow sx={{ color: 'primary.main' }} />;
                                        if (file.props?.artwork) return <img src={file.props.artwork} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 2 }} />;
                                    }
                                    return file.type === FileType.Directory ? <Folder sx={{ color: 'primary.main' }} /> : <Description />;
                                }}
                                additionalColumns={[{ name: 'name', sortable: true }]}
                                actions={[
                                    { name: 'Back', actionPossible: () => currentPath.length > 0, handler: () => setCurrentPath((prev: string[]) => prev.slice(0, -1)) },
                                    { name: 'Add to Burn List', icon: <Add />, actionPossible: (e: File[]) => e.length > 0, handler: handleAddToPlaylist },
                                    { name: 'Play', icon: <PlayArrow />, actionPossible: (e: File[]) => e.length === 1 && e[0].type === FileType.File, handler: (e: File[]) => handlePlayTrack(e[0]) }
                                ]}
                            />
                        ) : renderGridView(currentFileTree)}
                    </Box>
                )}
                {tabValue === 1 && (
                    <Box className={classes.tabPanel}>
                        {!filterArtist ? (
                             <Grid container spacing={2}>
                                {visualArtists.map((artist: any) => (
                                    <Grid item xs={12} sm={6} md={12 / gridColumns} key={artist.name}>
                                        <Card className={classes.card}>
                                            <CardActionArea onClick={() => setFilterArtist(artist.name)}>
                                                <CardMedia className={classes.media} image={artist.artwork || ''}>
                                                    {!artist.artwork && <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><MusicNote sx={{ fontSize: 48, opacity: 0.3 }} /></Box>}
                                                </CardMedia>
                                                <CardContent sx={{ p: 1 }}>
                                                    <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{artist.name}</Typography>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Box>
                                <Button size="small" onClick={() => setFilterArtist(null)} sx={{ mb: 1 }}>Back to Artists</Button>
                                <FileBrowser
                                    fileTree={allTracks.filter((t: File) => t.props?.artist === filterArtist)}
                                    manualName={true}
                                    allowMultifileSelection={true}
                                    pathString={filterArtist}
                                    iconGenerator={() => <MusicNote />}
                                    additionalColumns={[{ name: 'name', sortable: true }]}
                                    actions={[
                                        { name: 'Add to Burn List', icon: <Add />, actionPossible: (e: File[]) => e.length > 0, handler: handleAddToPlaylist },
                                        { name: 'Play', icon: <PlayArrow />, actionPossible: (e: File[]) => e.length === 1, handler: (e: File[]) => handlePlayTrack(e[0]) }
                                    ]}
                                />
                            </Box>
                        )}
                    </Box>
                )}
                {tabValue === 2 && (
                    <Box className={classes.tabPanel}>
                        {!filterAlbum ? (
                            <Grid container spacing={2}>
                                {albums.map((album: any, idx: number) => (
                                    <Grid item xs={12} sm={6} md={12 / gridColumns} key={idx}>
                                        <Card className={classes.card}>
                                            <CardActionArea onClick={() => { setFilterArtist(album.artist); setFilterAlbum(album.album); }}>
                                                <CardMedia className={classes.media} image={album.artwork || ''}>
                                                    {!album.artwork && <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Album sx={{ fontSize: 48, opacity: 0.3 }} /></Box>}
                                                </CardMedia>
                                                <CardContent sx={{ p: 1 }}>
                                                    <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{album.album}</Typography>
                                                    <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ fontSize: '0.7rem' }}>{album.artist}</Typography>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Box>
                                <Button size="small" onClick={() => { setFilterAlbum(null); setFilterArtist(null); }} sx={{ mb: 1 }}>Back to Albums</Button>
                                <FileBrowser
                                    fileTree={allTracks.filter((t: File) => t.props?.artist === filterArtist && t.props?.album === filterAlbum)}
                                    manualName={true}
                                    allowMultifileSelection={true}
                                    pathString={`${filterArtist}/${filterAlbum}`}
                                    iconGenerator={() => <MusicNote />}
                                    additionalColumns={[{ name: 'name', sortable: true }]}
                                    actions={[
                                        { name: 'Add to Burn List', icon: <Add />, actionPossible: (e: File[]) => e.length > 0, handler: handleAddToPlaylist },
                                        { name: 'Play', icon: <PlayArrow />, actionPossible: (e: File[]) => e.length === 1, handler: (e: File[]) => handlePlayTrack(e[0]) }
                                    ]}
                                />
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            {uploadedFiles.length > 0 && (
                <Box sx={{ p: 2, borderTop: `1px solid`, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Burn Queue</Typography>
                        <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                            {uploadedFiles.length}
                        </Box>
                    </Box>
                    <Button variant="contained" size="small" onClick={() => dispatch(convertDialogActions.setVisible(true))}>
                        Send to Burner
                    </Button>
                </Box>
            )}

            {currentTrack && (
                <Box className={classes.playerMiniModern}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                            <Avatar variant="rounded" src={currentTrack.artwork} sx={{ width: 40, height: 40 }}><Album /></Avatar>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>{currentTrack.title}</Typography>
                                <Typography variant="caption" color="textSecondary" noWrap display="block">{currentTrack.artist}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <IconButton size="small" onClick={handleStopPlayback}><Stop /></IconButton>
                                <IconButton size="small" onClick={handleTogglePlay} sx={{ color: isPlaying ? 'primary.main' : 'inherit' }}>{isPlaying ? <Pause /> : <PlayArrow />}</IconButton>
                            </Box>
                        </Box>
                        {audioError && <Typography variant="caption" color="error" sx={{ px: 1, display: 'block' }}>{audioError}</Typography>}
                        <Box sx={{ px: 1 }}>
                            <Slider size="small" value={currentTime} max={duration || 100} onChange={handleSeek} sx={{ py: 0.5 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: -1 }}><Typography variant="caption">{formatDuration(currentTime)}</Typography><Typography variant="caption">{formatDuration(duration)}</Typography></Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <VolumeUp sx={{ fontSize: 16, opacity: 0.6 }} />
                            <Slider size="small" value={volume} max={1} step={0.01} onChange={handleVolumeChange} sx={{ width: 80 }} />
                        </Box>
                    </Box>
                </Box>
            )}

            <LibrarySettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onRestart={() => window.location.reload()} scanStatus={scanStatus} onStartScan={handleStartScan} />
            <PlaylistDialog open={playlistDialogOpen} onClose={() => setPlaylistDialogOpen(false)} />

            <Snackbar open={addedSnackbarOpen} autoHideDuration={2000} onClose={() => setAddedSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
                <Alert severity="success" sx={{ width: '100%' }}>
                    Added {lastAddedTitle} to Disc
                </Alert>
            </Snackbar>

            <Box sx={{ p: 1, borderTop: '1px solid divider', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.5, fontSize: '0.65rem' }}>
                    NATIVE ENGINE v1.5.3 • AUDIO DECODER ACTIVE
                </Typography>
            </Box>
            </>
            )}
        </Box>
    );
};
