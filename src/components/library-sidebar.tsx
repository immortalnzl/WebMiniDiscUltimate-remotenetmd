import React, { Suspense, lazy, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useShallowEqualSelector, useDispatch } from '../frontend-utils';
import { loadLibraryDatabase, loadLibraryStatus, loadArtists, loadAlbums } from '../redux/actions';
import serviceRegistry from '../services/registry';
import { File as BrowserFile, FileBrowser } from './file-browser/browser';
import { FileType } from './file-browser/utils';
import { LocalDatabase } from '../services/library/library';
import { makeStyles } from 'tss-react/mui';
import { Typography, Box, InputBase, Paper, IconButton, Tabs, Tab, LinearProgress, Button, Chip, Tooltip } from '@mui/material';
import { Search, Folder, Description, PlayArrow, Add, GridView, List, Fullscreen, FullscreenExit, Album, MusicNote, Settings, Refresh, QueueMusic } from '@mui/icons-material';
import { AdaptiveFile } from '../utils';
import { actions as playlistActions } from '../redux/playlist-feature';
import { Grid, Card, CardMedia, CardContent, CardActionArea } from '@mui/material';
import { LibrarySettingsDialog } from './library-settings-dialog';
import { PreviewPlayer } from './preview-player';
import type { NowPlayingItem } from './now-playing-dialog';
import { Style as StyleIcon } from '@mui/icons-material';
const NowPlayingPanel = lazy(() => import('./now-playing-dialog').then((module) => ({ default: module.NowPlayingPanel })));
const MDLabelMakerDialog = lazy(() => import('./md-label-maker-dialog').then((module) => ({ default: module.MDLabelMakerDialog })));

const useStyles = makeStyles()((theme: any) => ({
    root: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.default,
        transition: 'width 0.3s ease-in-out',
        overflow: 'hidden',
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
    headerActionButton: {
        marginLeft: theme.spacing(0.25),
    },
    headerPrimaryAction: {
        marginLeft: theme.spacing(0.5),
        padding: theme.spacing(1),
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
    playerMini: {
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
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
        height: 140,
        backgroundColor: theme.palette.action.hover,
    },
    mediaSquare: {
        height: 160,
        backgroundColor: theme.palette.action.hover,
        aspectRatio: '1 / 1',
    },
    logTerm: {
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        fontFamily: 'monospace',
        padding: theme.spacing(1),
        height: '400px',
        overflowY: 'auto',
        fontSize: '0.8rem',
        borderRadius: 4,
    }
}));

const TAB_NOW_PLAYING = 0;
const TAB_FOLDERS = 1;
const TAB_ARTISTS = 2;
const TAB_ALBUMS = 3;
const NOW_PLAYING_QUEUE_KEY = 'md_now_playing_queue_v1';

export const MusicLibrarySidebar = ({ setUploadedFiles, isExpanded, onToggleExpand, onOpenPlaylists, showNowPlaying, onOpenNowPlaying, onCloseNowPlaying }: { 
    setUploadedFiles: React.Dispatch<React.SetStateAction<(File | AdaptiveFile)[]>>;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onOpenPlaylists: () => void;
    showNowPlaying: boolean;
    onOpenNowPlaying: () => void;
    onCloseNowPlaying: () => void;
}) => {
    const { classes, cx } = useStyles();
    const dispatch = useDispatch();
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const { database, artists, albums, scanStatus } = useShallowEqualSelector((state) => state.localLibrary);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [previewTrack, setPreviewTrack] = useState<{ title: string; artist: string; album: string; year?: string; artwork?: string; duration?: number } | null>(null);
    const [previewPlaying, setPreviewPlaying] = useState(false);
    const [previewQueue, setPreviewQueue] = useState<NowPlayingItem[]>([]);
    const [previewIndex, setPreviewIndex] = useState<number>(-1);
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [shuffleEnabled, setShuffleEnabled] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [labelMakerOpen, setLabelMakerOpen] = useState(false);
    const [labelMakerSession, setLabelMakerSession] = useState(0);
    const [labelSeed, setLabelSeed] = useState<{ artwork?: string; album?: string; artist?: string; year?: string; track?: string } | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [tabValue, setTabValue] = useState(showNowPlaying ? TAB_NOW_PLAYING : TAB_FOLDERS);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
    const currentPlaylistId = useShallowEqualSelector((state) => state.playlist.currentPlaylistId);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(NOW_PLAYING_QUEUE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as NowPlayingItem[];
            if (!Array.isArray(parsed) || parsed.length === 0) return;
            const safe = parsed.filter((item) => item && typeof item.id === 'string' && item.id.length > 0);
            if (!safe.length) return;
            setPreviewQueue(safe);
            setPreviewIndex(0);
            const first = safe[0];
            setCurrentTrackId(first.id);
            setPreviewTrack({
                title: first.title,
                artist: first.artist,
                album: first.album,
                year: first.year,
                artwork: first.artwork,
                duration: first.duration,
            });
        } catch {
            // Ignore malformed local cache.
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(NOW_PLAYING_QUEUE_KEY, JSON.stringify(previewQueue.slice(0, 500)));
        } catch {
            // best effort
        }
    }, [previewQueue]);

    const ensureYear = useCallback(async (artist?: string, album?: string, title?: string): Promise<string | undefined> => {
        if (!artist && !album && !title) return undefined;
        try {
            const qs = new URLSearchParams();
            if (artist) qs.set('artist', artist);
            if (album) qs.set('album', album);
            if (title) qs.set('title', title);
            const response = await fetch(`/api/lookup_year?${qs.toString()}`);
            if (!response.ok) return undefined;
            const data = await response.json();
            return typeof data?.year === 'string' && data.year.trim() ? data.year.trim() : undefined;
        } catch {
            return undefined;
        }
    }, []);

    const handleStartScan = async () => {
        try {
            await fetch('/api/scan?mode=full', { method: 'POST' });
        } catch (e) {
            console.error("Failed to start scan", e);
        }
    };

    const handleScanNewFiles = async () => {
        try {
            await fetch('/api/scan?mode=incremental', { method: 'POST' });
        } catch (e) {
            console.error("Failed to start incremental scan", e);
        }
    };

    const handleRefreshMetadataArtwork = async () => {
        try {
            await fetch('/api/scan?mode=refresh_metadata', { method: 'POST' });
        } catch (e) {
            console.error("Failed to start metadata refresh", e);
        }
    };

    const convertToFileArray = (data: LocalDatabase, path: string[] = []): BrowserFile[] => {
        let currentData = data;
        const originalPath = [...path];
        const pathCopy = [...path];
        try {
            while(pathCopy.length){
                const part = pathCopy.shift();
                if (part && currentData[part]) {
                    currentData = currentData[part] as any;
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

    const [currentFileTree, setCurrentFileTree] = useState<BrowserFile[]>([]);

    useEffect(() => {
        if (database) {
            setCurrentFileTree(convertToFileArray(database, currentPath));
        }
    }, [database, currentPath]);

    useEffect(() => {
        const loadAll = () => {
            const { libraryService } = serviceRegistry;
            if (libraryService) {
                dispatch(loadLibraryDatabase());
                dispatch(loadLibraryStatus());
                dispatch(loadArtists());
                dispatch(loadAlbums());
            }
        };
        const loadStatusOnly = () => {
            const { libraryService } = serviceRegistry;
            if (libraryService) {
                dispatch(loadLibraryStatus());
            }
        };

        loadAll();
        const interval = setInterval(scanStatus?.scanning ? loadAll : loadStatusOnly, scanStatus?.scanning ? 3000 : 30000);
        return () => clearInterval(interval);
    }, [dispatch, scanStatus?.scanning]);

    useEffect(() => {
        if (showNowPlaying && tabValue !== TAB_NOW_PLAYING) {
            setTabValue(TAB_NOW_PLAYING);
        } else if (!showNowPlaying && tabValue === TAB_NOW_PLAYING) {
            setTabValue(TAB_FOLDERS);
        }
    }, [showNowPlaying, tabValue]);


    const expandToTrackFiles = useCallback((files: BrowserFile[]) => {
        const process = (path: string[], files: BrowserFile[]): BrowserFile[] => {
            const finalFiles: BrowserFile[] = [];
            for(let file of files){
                if(file.type === FileType.Directory) {
                    const newPath = [...path, file.name];
                    const subFiles = convertToFileArray(database ?? {}, newPath);
                    finalFiles.push(...process(newPath, subFiles));
                } else {
                    finalFiles.push(file);
                }
            }
            return finalFiles;
        };

        return process(currentPath, files);
    }, [database, currentPath]);

    const toAdaptiveFiles = useCallback((files: BrowserFile[]) => {
        const tracksToAdd = expandToTrackFiles(files);
        return tracksToAdd.map((file) => {
            const props = file.props!;
            const pathTokens = props['id'].split('/');
            return {
                album: props['album'],
                artist: props['artist'],
                title: props['title'],
                name: pathTokens[pathTokens.length - 1] || 'unknown.unk',
                duration: props['duration'],
                artwork: props['artwork'],
                getForEncoding: async (params, callback) => {
                    const { libraryService } = serviceRegistry;
                    if (!libraryService) throw new Error('Library service not available');
                    return libraryService.processLocalLibraryFile(props['id'], params, callback);
                },
            };
        }) as AdaptiveFile[];
    }, [expandToTrackFiles]);

    const handleAddToDisc = useCallback((files: BrowserFile[]) => {
        const adaptiveFiles = toAdaptiveFiles(files);
        setUploadedFiles((prev) => [...prev, ...adaptiveFiles]);
    }, [toAdaptiveFiles, setUploadedFiles]);

    const handleAddToPlaylist = useCallback((files: BrowserFile[]) => {
        const adaptiveFiles = toAdaptiveFiles(files);
        if (adaptiveFiles.length === 0) return;

        let targetId = currentPlaylistId;
        if (!targetId) {
            const defaultName = 'Quick Playlist';
            const id = `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            dispatch(playlistActions.createPlaylist({ name: defaultName, id }));
            targetId = id;
        }

        dispatch(playlistActions.setCurrentPlaylist(targetId));
        adaptiveFiles.forEach((track) => {
            dispatch(playlistActions.addTrackToPlaylist({ playlistId: targetId as string, track }));
        });
        onOpenPlaylists();
    }, [toAdaptiveFiles, currentPlaylistId, dispatch, onOpenPlaylists]);

    const appendToNowPlayingQueue = useCallback((files: BrowserFile[], autoplay = false) => {
        const tracks = expandToTrackFiles(files).filter((file) => file.type === FileType.File && !!file.props?.id);
        if (tracks.length === 0) return;

        const items = tracks.map((file) => {
            const props = file.props!;
            return {
                id: props['id'],
                title: props['title'] || file.name,
                artist: props['artist'] || '',
                album: props['album'] || '',
                year: props['year'],
                artwork: props['artwork'],
                duration: Number(props['duration']) || 0,
            } as NowPlayingItem;
        });

        setPreviewQueue((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const uniqueNew = items.filter((item) => !existingIds.has(item.id));
            if (uniqueNew.length === 0) {
                if (autoplay && prev.length > 0) {
                    const firstSelected = items[0];
                    const idx = prev.findIndex((q) => q.id === firstSelected.id);
                    if (idx >= 0) {
                        setPreviewIndex(idx);
                        setCurrentTrackId(prev[idx].id);
                        setPreviewTrack({
                            title: prev[idx].title,
                            artist: prev[idx].artist,
                            album: prev[idx].album,
                            year: prev[idx].year,
                            artwork: prev[idx].artwork,
                            duration: prev[idx].duration,
                        });
                        const url = serviceRegistry.libraryService?.getAudioUrl(prev[idx].id);
                        if (url) {
                            setCurrentAudioUrl(url);
                            setPreviewPlaying(true);
                        }
                    }
                }
                return prev;
            }
            const next = [...prev, ...uniqueNew];
            if (autoplay) {
                const firstId = items[0]?.id;
                const idx = next.findIndex((q) => q.id === firstId);
                if (idx >= 0) {
                    setPreviewIndex(idx);
                    setCurrentTrackId(next[idx].id);
                    setPreviewTrack({
                        title: next[idx].title,
                        artist: next[idx].artist,
                        album: next[idx].album,
                        year: next[idx].year,
                        artwork: next[idx].artwork,
                        duration: next[idx].duration,
                    });
                    const url = serviceRegistry.libraryService?.getAudioUrl(next[idx].id);
                    if (url) {
                        setCurrentAudioUrl(url);
                        setPreviewPlaying(true);
                    }
                }
            }
            return next;
        });
    }, [expandToTrackFiles]);

    const startPreview = useCallback((url: string, file?: BrowserFile) => {
        if (file?.props) {
            const item: NowPlayingItem = {
                id: file.props['id'],
                title: file.props['title'] || file.name,
                artist: file.props['artist'] || '',
                album: file.props['album'] || '',
                year: file.props['year'],
                artwork: file.props['artwork'],
                duration: Number(file.props['duration']) || 0,
            };
            setPreviewTrack({
                title: item.title,
                artist: item.artist,
                album: item.album,
                year: item.year,
                artwork: item.artwork,
                duration: item.duration,
            });
            setPreviewQueue((prev) => {
                const existingIndex = prev.findIndex((e) => e.id === item.id);
                if (existingIndex >= 0) {
                    setPreviewIndex(existingIndex);
                    setCurrentTrackId(prev[existingIndex]?.id || item.id);
                    return prev;
                }
                const next = [...prev, item];
                setPreviewIndex(next.length - 1);
                setCurrentTrackId(item.id);
                return next;
            });
            if (!item.year && (item.artist || item.album || item.title)) {
                ensureYear(item.artist, item.album, item.title).then((year) => {
                    if (!year) return;
                    setPreviewTrack((prevTrack) => {
                        if (!prevTrack) return prevTrack;
                        if (prevTrack.title === item.title && prevTrack.artist === item.artist && prevTrack.album === item.album) {
                            return { ...prevTrack, year };
                        }
                        return prevTrack;
                    });
                    setPreviewQueue((prev) => prev.map((q) => (
                        q.id === item.id ? { ...q, year: q.year || year } : q
                    )));
                });
            }
        }
        setCurrentAudioUrl(url);
        setPreviewPlaying(true);
    }, [ensureYear]);

    const handleFileAction = useCallback((file: BrowserFile) => {
        if (file.type === FileType.Directory) {
            setCurrentPath((prev: string[]) => [...prev, file.name]);
        } else {
            const url = serviceRegistry.libraryService?.getAudioUrl(file.props!['id']);
            if (url) startPreview(url, file);
        }
    }, [startPreview]);

    const playQueueItem = useCallback(
        (index: number) => {
            const item = previewQueue[index];
            if (!item) return;
            const url = serviceRegistry.libraryService?.getAudioUrl(item.id);
            if (url) {
                setPreviewIndex(index);
                setCurrentTrackId(item.id);
                setPreviewTrack({
                    title: item.title,
                    artist: item.artist,
                    album: item.album,
                    year: item.year,
                    artwork: item.artwork,
                    duration: item.duration,
                });
                setCurrentAudioUrl(url);
                setPreviewPlaying(true);
                if (!item.year && (item.artist || item.album || item.title)) {
                    ensureYear(item.artist, item.album, item.title).then((year) => {
                        if (!year) return;
                        setPreviewTrack((prevTrack) => {
                            if (!prevTrack) return prevTrack;
                            if (prevTrack.title === item.title && prevTrack.artist === item.artist && prevTrack.album === item.album) {
                                return { ...prevTrack, year };
                            }
                            return prevTrack;
                        });
                        setPreviewQueue((prev) => prev.map((q, qIdx) => (
                            qIdx === index ? { ...q, year: q.year || year } : q
                        )));
                    });
                }
            }
        },
        [previewQueue, ensureYear]
    );

    const removeQueueItem = useCallback(
        (index: number) => {
            setPreviewQueue((prev) => {
                const next = prev.filter((_, i) => i !== index);
                if (next.length === 0) {
                    setPreviewIndex(-1);
                    setCurrentAudioUrl(null);
                    setPreviewTrack(null);
                    setCurrentTrackId(null);
                    setPreviewPlaying(false);
                    return next;
                }
                if (previewIndex === index) {
                    setPreviewIndex(next.length ? Math.min(index, next.length - 1) : -1);
                    const fallbackIndex = Math.min(index, next.length - 1);
                    setCurrentTrackId(next[fallbackIndex]?.id || null);
                } else if (previewIndex > index) {
                    setPreviewIndex(previewIndex - 1);
                }
                return next;
            });
        },
        [previewIndex]
    );

    const clearQueue = useCallback(() => {
        setPreviewQueue([]);
        setPreviewIndex(-1);
        setCurrentAudioUrl(null);
        setPreviewTrack(null);
        setCurrentTrackId(null);
        setPreviewPlaying(false);
    }, []);

    const moveQueueItem = useCallback((index: number, direction: 'up' | 'down') => {
        setPreviewQueue((prev) => {
            if (index < 0 || index >= prev.length) return prev;
            const target = direction === 'up' ? index - 1 : index + 1;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            const temp = next[index];
            next[index] = next[target];
            next[target] = temp;

            setPreviewIndex((current) => {
                if (current === index) return target;
                if (current === target) return index;
                return current;
            });
            return next;
        });
    }, []);

    const reorderQueueItem = useCallback((fromIndex: number, toIndex: number) => {
        setPreviewQueue((prev) => {
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length || fromIndex === toIndex) {
                return prev;
            }
            const next = [...prev];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            setPreviewIndex((current) => {
                if (current === fromIndex) return toIndex;
                if (fromIndex < current && current <= toIndex) return current - 1;
                if (toIndex <= current && current < fromIndex) return current + 1;
                return current;
            });
            return next;
        });
    }, []);

    const addQueueItemToBurn = useCallback(
        (index: number) => {
            const item = previewQueue[index];
            if (!item) return;
            const adaptive: AdaptiveFile = {
                album: item.album,
                artist: item.artist,
                title: item.title,
                name: item.title || 'unknown.unk',
                duration: item.duration || 0,
                artwork: item.artwork,
                getForEncoding: async (params, callback) => {
                    const { libraryService } = serviceRegistry;
                    if (!libraryService) throw new Error('Library service not available');
                    return libraryService.processLocalLibraryFile(item.id, params, callback);
                },
            };
            setUploadedFiles((prev) => [...prev, adaptive]);
        },
        [previewQueue, setUploadedFiles]
    );

    const addAllQueueToBurn = useCallback(() => {
        const adaptives = previewQueue.map((item) => ({
            album: item.album,
            artist: item.artist,
            title: item.title,
            name: item.title || 'unknown.unk',
            duration: item.duration || 0,
            artwork: item.artwork,
            getForEncoding: async (params: any, callback?: (obj: { state: number; total: number }) => void) => {
                const { libraryService } = serviceRegistry;
                if (!libraryService) throw new Error('Library service not available');
                return libraryService.processLocalLibraryFile(item.id, params, callback);
            },
        })) as AdaptiveFile[];
        setUploadedFiles((prev) => [...prev, ...adaptives]);
    }, [previewQueue, setUploadedFiles]);

    const saveQueueAsPlaylist = useCallback(() => {
        if (!previewQueue.length) return;
        const id = `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        dispatch(playlistActions.createPlaylist({ name: 'Now Playing', id }));
        dispatch(playlistActions.setCurrentPlaylist(id));
        previewQueue.forEach((item) => {
            const adaptive: AdaptiveFile = {
                album: item.album,
                artist: item.artist,
                title: item.title,
                name: item.title || 'unknown.unk',
                duration: 0,
                artwork: item.artwork,
                getForEncoding: async (params, callback) => {
                    const { libraryService } = serviceRegistry;
                    if (!libraryService) throw new Error('Library service not available');
                    return libraryService.processLocalLibraryFile(item.id, params, callback);
                },
            };
            dispatch(playlistActions.addTrackToPlaylist({ playlistId: id, track: adaptive }));
        });
    }, [dispatch, previewQueue]);

    const playAtIndex = useCallback(
        (idx: number) => {
            if (idx < 0 || idx >= previewQueue.length) return;
            playQueueItem(idx);
        },
        [playQueueItem, previewQueue.length]
    );

    const resolvedPreviewIndex = useMemo(() => {
        if (previewQueue.length === 0) return -1;
        if (previewIndex >= 0 && previewIndex < previewQueue.length) return previewIndex;
        if (currentTrackId) {
            const idx = previewQueue.findIndex((item) => item.id === currentTrackId);
            if (idx >= 0) return idx;
        }
        return 0;
    }, [previewQueue, previewIndex, currentTrackId]);

    const handlePrevTrack = useCallback(() => {
        if (!previewQueue.length) return;
        if (resolvedPreviewIndex <= 0) {
            if (repeatMode === 'all') {
                playAtIndex(previewQueue.length - 1);
            } else {
                playAtIndex(0);
            }
            return;
        }
        playAtIndex(resolvedPreviewIndex - 1);
    }, [previewQueue.length, resolvedPreviewIndex, repeatMode, playAtIndex]);

    const handleNextTrack = useCallback(() => {
        if (!previewQueue.length) return;
        if (shuffleEnabled) {
            if (previewQueue.length === 1) {
                playAtIndex(0);
                return;
            }
            let next = resolvedPreviewIndex;
            for (let i = 0; i < 6 && next === resolvedPreviewIndex; i++) {
                next = Math.floor(Math.random() * previewQueue.length);
            }
            playAtIndex(next === resolvedPreviewIndex ? (resolvedPreviewIndex + 1) % previewQueue.length : next);
            return;
        }
        if (resolvedPreviewIndex + 1 < previewQueue.length) {
            playAtIndex(resolvedPreviewIndex + 1);
            return;
        }
        if (repeatMode === 'all') {
            playAtIndex(0);
        }
    }, [previewQueue.length, resolvedPreviewIndex, shuffleEnabled, repeatMode, playAtIndex]);

    const handleTrackEnded = useCallback(() => {
        if (!previewQueue.length) return;
        if (repeatMode === 'one') {
            playAtIndex(Math.max(resolvedPreviewIndex, 0));
            return;
        }
        handleNextTrack();
    }, [previewQueue.length, repeatMode, playAtIndex, resolvedPreviewIndex, handleNextTrack]);

    const toggleRepeatMode = useCallback(() => {
        setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
    }, []);

    const withArtworkSize = useCallback((url?: string, size: number = 256) => {
        if (!url) return '';
        try {
            const parsed = new URL(url, window.location.origin);
            const isArtworkApi =
                parsed.pathname.includes('/api/get_artwork') ||
                parsed.pathname.includes('/api/get_artwork_cached') ||
                parsed.pathname.endsWith('api/get_artwork') ||
                parsed.pathname.endsWith('api/get_artwork_cached');
            if (!isArtworkApi) return url;
            if (!parsed.searchParams.has('size')) {
                parsed.searchParams.set('size', `${size}`);
            }
            return parsed.toString();
        } catch {
            return url;
        }
    }, []);

    const artistArtworkUrl = useCallback((artist: string, size: number = 256) => {
        // Ask backend to fallback to album art to avoid noisy 404 retries and extra client fallback fetches.
        return `/api/get_artist_art?artist=${encodeURIComponent(artist)}&size=${size}&fallback_album=true`;
    }, []);

    const openLabelMaker = useCallback(() => {
        const activeItem = previewIndex >= 0 ? previewQueue[previewIndex] : null;
        const artworkSource = previewTrack?.artwork || activeItem?.artwork;
        setLabelSeed({
            artwork: artworkSource || undefined,
            album: previewTrack?.album || activeItem?.album,
            artist: previewTrack?.artist || activeItem?.artist,
            year: previewTrack?.year || activeItem?.year,
            track: previewTrack?.title || activeItem?.title,
        });
        setLabelMakerSession((v) => v + 1);
        setLabelMakerOpen(true);
    }, [previewIndex, previewQueue, previewTrack]);

    const renderGridView = (files: BrowserFile[]) => (
        <Grid container spacing={2}>
            {files.map((file) => (
                <Grid item xs={6} sm={4} md={3} key={file.name}>
                    <Card className={classes.card}>
                        <CardActionArea onClick={() => handleFileAction(file)}>
                            <CardMedia
                                className={classes.mediaSquare}
                                image={withArtworkSize(file.props?.artwork || '', 256)}
                                title={file.name}
                                sx={{ backgroundSize: 'cover' }}
                            >
                                {(!file.props?.artwork) && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                        {file.type === FileType.Directory ? <Album sx={{ fontSize: 64, color: 'action.disabled' }} /> : <MusicNote sx={{ fontSize: 64, color: 'action.disabled' }} />}
                                    </Box>
                                )}
                            </CardMedia>
                            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                                <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.85rem' }}>
                                    {file.name}
                                </Typography>
                                {file.type === FileType.File && (
                                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                        {file.props?.artist}
                                    </Typography>
                                )}
                            </CardContent>
                        </CardActionArea>
                    </Card>
                </Grid>
            ))}
        </Grid>
    );

    const artistsWithArtwork = useMemo(() => {
        const map = new Map<string, { artist: string; artwork?: string; albumCount: number }>();
        (albums || []).forEach((album: any) => {
            const artist = album?.artist;
            if (!artist) return;
            if (!map.has(artist)) {
                map.set(artist, { artist, artwork: album?.artwork, albumCount: 0 });
            }
            const existing = map.get(artist);
            if (existing) {
                existing.albumCount += 1;
                if (!existing.artwork && album?.artwork) {
                    existing.artwork = album.artwork;
                }
            }
        });
        (artists || []).forEach((artist: string) => {
            if (!map.has(artist)) {
                map.set(artist, { artist, artwork: undefined, albumCount: 0 });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.artist.localeCompare(b.artist));
    }, [albums, artists]);

    const deferredSearchQuery = useDeferredValue(searchQuery);
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
    const hasLibraryData = useMemo(() => {
        if ((scanStatus?.files_found || 0) > 0) return true;
        if ((albums?.length || 0) > 0) return true;
        if ((artists?.length || 0) > 0) return true;
        if (!database || typeof database !== 'object') return false;
        return Object.keys(database).length > 0;
    }, [scanStatus?.files_found, albums, artists, database]);

    const filteredFiles = useMemo(() => {
        if (!normalizedSearch || tabValue !== TAB_FOLDERS) return currentFileTree;
        return currentFileTree.filter((file) => {
            const artist = (file.props?.artist || '').toString().toLowerCase();
            const album = (file.props?.album || '').toString().toLowerCase();
            const title = (file.props?.title || '').toString().toLowerCase();
            const name = file.name.toLowerCase();
            return name.includes(normalizedSearch) || artist.includes(normalizedSearch) || album.includes(normalizedSearch) || title.includes(normalizedSearch);
        });
    }, [currentFileTree, normalizedSearch, tabValue]);

    const filteredArtists = useMemo(() => {
        if (!normalizedSearch || tabValue !== TAB_ARTISTS) return artistsWithArtwork;
        return artistsWithArtwork.filter((artist) => artist.artist.toLowerCase().includes(normalizedSearch));
    }, [artistsWithArtwork, normalizedSearch, tabValue]);

    const filteredAlbums = useMemo(() => {
        const base = (albums || []).filter((album: any) => !selectedArtist || album.artist === selectedArtist);
        if (!normalizedSearch || tabValue !== TAB_ALBUMS) return base;
        return base.filter((album: any) => {
            const name = (album.album || '').toString().toLowerCase();
            const artist = (album.artist || '').toString().toLowerCase();
            return name.includes(normalizedSearch) || artist.includes(normalizedSearch);
        });
    }, [albums, normalizedSearch, selectedArtist, tabValue]);

    const findAlbumPath = useCallback((db: LocalDatabase, artist: string, albumName: string, path: string[] = []): string[] | null => {
        for (const [key, value] of Object.entries(db || {})) {
            if (!value || typeof value !== 'object') continue;
            if ('artist' in (value as any)) {
                const track = value as any;
                if (track.artist === artist && track.album === albumName) {
                    return path;
                }
                continue;
            }
            const found = findAlbumPath(value as LocalDatabase, artist, albumName, [...path, key]);
            if (found) return found;
        }
        return null;
    }, []);

    const openAlbumInFolders = useCallback((artist: string, albumName: string) => {
        if (!database) return;
        const path = findAlbumPath(database, artist, albumName);
        if (path) {
            setCurrentPath(path);
            setTabValue(TAB_FOLDERS);
        }
    }, [database, findAlbumPath]);

    return (
        <Box className={cx(classes.root, isExpanded && classes.rootExpanded)}>
            <Box className={classes.header}>
                <Box className={classes.headerActions}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Music Library</Typography>
                    <Box>
                        <IconButton
                            size="small"
                            className={classes.headerActionButton}
                            onClick={() => {
                                if (tabValue === TAB_NOW_PLAYING) {
                                    setTabValue(TAB_FOLDERS);
                                    onCloseNowPlaying();
                                } else {
                                    setTabValue(TAB_NOW_PLAYING);
                                    onOpenNowPlaying();
                                }
                            }}
                        >
                            <PlayArrow fontSize="small" />
                        </IconButton>
                        <IconButton size="medium" className={classes.headerPrimaryAction} onClick={onOpenPlaylists}>
                            <QueueMusic fontSize="medium" />
                        </IconButton>
                        <IconButton size="medium" className={classes.headerPrimaryAction} onClick={openLabelMaker}>
                            <StyleIcon fontSize="medium" />
                        </IconButton>
                        <Tooltip title="Library Settings">
                            <IconButton size="small" className={classes.headerActionButton} onClick={() => setSettingsOpen(true)}>
                                <Settings fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={isExpanded ? "Exit Expanded View" : "Expand Library"}>
                            <IconButton size="small" className={classes.headerActionButton} onClick={onToggleExpand}>
                                {isExpanded ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>

            {(!scanStatus || (!scanStatus.scanning && !hasLibraryData)) ? (
                <Box className={classes.statusCard} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">Library not scanned</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>Check settings</Typography>
                </Box>
            ) : (
                scanStatus.scanning ? (
                    <Box className={classes.statusCard}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                                Scanning...
                                <Refresh fontSize="inherit" className="rotating" sx={{ ml: 1 }} />
                            </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {scanStatus.current_activity}
                        </Typography>
                        <LinearProgress 
                            variant="indeterminate"
                            sx={{ height: 4, borderRadius: 2, mb: 1 }}
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Tracks</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.files_found || 0}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Artists</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.artists_found || 0}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Albums</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.albums_found || 0}</Typography>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    <Box className={classes.statusCard} sx={{ py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Library ready</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {`${scanStatus.files_found || 0} tracks • ${scanStatus.artists_found || 0} artists • ${scanStatus.albums_found || 0} albums`}
                        </Typography>
                    </Box>
                )
            )}

            <Tabs
                value={tabValue}
                onChange={(e: any, v: any) => {
                    startTransition(() => {
                        setTabValue(v);
                        setSearchQuery('');
                        if (v !== TAB_ALBUMS) setSelectedArtist(null);
                    });
                    if (v === TAB_NOW_PLAYING) {
                        onOpenNowPlaying();
                    } else if (showNowPlaying) {
                        onCloseNowPlaying();
                    }
                }}
                variant="fullWidth"
                sx={{ minHeight: 40, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label="Now Playing" sx={{ minHeight: 40, fontSize: '0.75rem' }} />
                <Tab label="Folders" sx={{ minHeight: 40, fontSize: '0.75rem' }} />
                <Tab label="Artists" sx={{ minHeight: 40, fontSize: '0.75rem' }} />
                <Tab label="Albums" sx={{ minHeight: 40, fontSize: '0.75rem' }} />
            </Tabs>

            {tabValue !== TAB_NOW_PLAYING && (
                <Paper className={classes.search}>
                    <Search color="disabled" sx={{ fontSize: 20 }} />
                    <InputBase
                        className={classes.input}
                        placeholder={`Search ${tabValue === TAB_FOLDERS ? "folders" : tabValue === TAB_ARTISTS ? "artists" : "albums"}...`}
                        value={searchQuery}
                        onChange={(e) => {
                            const nextValue = e.target.value;
                            startTransition(() => setSearchQuery(nextValue));
                        }}
                    />
                    <IconButton size="small" onClick={() => setViewMode((v: any) => v === 'list' ? 'grid' : 'list')}>
                        {viewMode === 'list' ? <GridView fontSize="inherit" /> : <List fontSize="inherit" />}
                    </IconButton>
                </Paper>
            )}

            <Box className={classes.browserWrapper}>
                {tabValue === TAB_NOW_PLAYING && (
                    <Box className={classes.tabPanel}>
                        <Suspense fallback={<Box sx={{ p: 2 }}><LinearProgress /></Box>}>
                            <NowPlayingPanel
                                onClose={onCloseNowPlaying}
                                previewTrack={previewTrack}
                                previewActive={!!currentAudioUrl}
                                previewPlaying={previewPlaying}
                                queue={previewQueue}
                                currentIndex={resolvedPreviewIndex}
                                onPlayItem={playQueueItem}
                                onRemoveItem={removeQueueItem}
                                onMoveQueueItem={moveQueueItem}
                                onReorderQueue={reorderQueueItem}
                                onAddItemToBurn={addQueueItemToBurn}
                                onAddAllToBurn={addAllQueueToBurn}
                                onSavePlaylist={saveQueueAsPlaylist}
                                onClearQueue={clearQueue}
                                onOpenLabelMaker={openLabelMaker}
                                currentAudioUrl={currentAudioUrl}
                                previewDuration={previewTrack?.duration}
                                onPreviewClose={() => setCurrentAudioUrl(null)}
                                onPreviewPlayStateChange={setPreviewPlaying}
                                onTrackEnded={handleTrackEnded}
                                onPrevTrack={handlePrevTrack}
                                onNextTrack={handleNextTrack}
                                onToggleShuffle={() => setShuffleEnabled((v) => !v)}
                                onToggleRepeat={toggleRepeatMode}
                                shuffleEnabled={shuffleEnabled}
                                repeatMode={repeatMode}
                                onOpenArtist={() => {
                                    if (!previewTrack?.artist) return;
                                    setSelectedArtist(previewTrack.artist);
                                    setTabValue(TAB_ALBUMS);
                                    setSearchQuery('');
                                    onCloseNowPlaying();
                                }}
                                onOpenAlbum={() => {
                                    if (!previewTrack?.artist || !previewTrack?.album) return;
                                    openAlbumInFolders(previewTrack.artist, previewTrack.album);
                                    setTabValue(TAB_FOLDERS);
                                    onCloseNowPlaying();
                                }}
                            />
                        </Suspense>
                    </Box>
                )}
                {tabValue === TAB_FOLDERS && (
                    <Box className={classes.tabPanel}>
                        {viewMode === 'list' ? (
                            <FileBrowser
                                fileTree={filteredFiles}
                                onFileDoubleClick={handleFileAction}
                                columnNotFoundPlaceholder=""
                                manualName={true}
                                allowMultifileSelection={true}
                                pathString={currentPath.join('/')}
                                iconGenerator={(file) => {
                                    if (file.type === FileType.File && file.props?.artwork) {
                                        return <img src={withArtworkSize(file.props.artwork, 64)} alt="" loading="lazy" decoding="async" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 2 }} />;
                                    }
                                    return file.type === FileType.Directory ? <Folder sx={{ color: 'primary.main' }} /> : <Description />;
                                }}
                                additionalColumns={[{ name: 'name', sortable: true }]}
                                actions={[
                                    {
                                        name: 'Back',
                                        actionPossible: () => currentPath.length > 0,
                                        handler: () => setCurrentPath(e => e.slice(0, -1)),
                                    },
                                    {
                                        name: 'Add to Burn List',
                                        icon: <Add />,
                                        actionPossible: (e) => e.length > 0,
                                        handler: (e) => handleAddToDisc(e),
                                    },
                                    {
                                        name: 'Add to Playlist',
                                        icon: <QueueMusic />,
                                        actionPossible: (e) => e.length > 0,
                                        handler: (e) => handleAddToPlaylist(e),
                                    },
                                    {
                                        name: 'Play Preview',
                                        icon: <PlayArrow />,
                                        actionPossible: (e) => !!serviceRegistry.libraryService && (
                                            e.some((file) => file.type === FileType.File) ||
                                            filteredFiles.some((file) => file.type === FileType.File)
                                        ),
                                        handler: (e) => {
                                            const selected = e.filter((file) => file.type === FileType.File || file.type === FileType.Directory);
                                            const source = selected.length > 0 ? selected : filteredFiles;
                                            appendToNowPlayingQueue(source, true);
                                        },
                                    },
                                    {
                                        name: 'Add to Now Playing',
                                        icon: <QueueMusic />,
                                        actionPossible: (e) => e.length > 0,
                                        handler: (e) => appendToNowPlayingQueue(e, false),
                                    },
                                    {
                                        name: 'Play All (Visible)',
                                        icon: <PlayArrow />,
                                        actionPossible: () => !!serviceRegistry.libraryService && filteredFiles.some((file) => file.type === FileType.File || file.type === FileType.Directory),
                                        handler: () => appendToNowPlayingQueue(filteredFiles, true),
                                    },
                                ]}
                            />
                        ) : renderGridView(filteredFiles)}
                    </Box>
                )}
                {tabValue === TAB_ARTISTS && (
                    <Box className={classes.tabPanel}>
                        {viewMode === 'list' ? (
                            <Grid container spacing={1}>
                                {filteredArtists.map((artist) => (
                                    <Grid item xs={12} key={artist.artist}>
                                        <Button
                                            fullWidth
                                            onClick={() => {
                                                setSelectedArtist(artist.artist);
                                                setTabValue(TAB_ALBUMS);
                                                setSearchQuery('');
                                            }}
                                            sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 1, textTransform: 'none', borderBottom: 1, borderColor: 'divider' }}
                                        >
                                            {artist.artwork ? (
                                                <img
                                                    src={artistArtworkUrl(artist.artist, 64)}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, marginRight: 8 }}
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        const fallback = withArtworkSize(artist.artwork, 64);
                                                        if (fallback && target.src !== fallback) {
                                                            target.src = fallback;
                                                        } else {
                                                            target.style.display = 'none';
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <MusicNote sx={{ mr: 1, opacity: 0.5 }} />
                                            )}
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="body2" noWrap>{artist.artist}</Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {artist.albumCount ? `${artist.albumCount} album${artist.albumCount === 1 ? '' : 's'}` : 'No albums yet'}
                                                </Typography>
                                            </Box>
                                        </Button>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Grid container spacing={2}>
                                {filteredArtists.map((artist) => (
                                    <Grid item xs={6} sm={4} md={3} key={artist.artist}>
                                        <Card className={classes.card}>
                                            <CardActionArea
                                                onClick={() => {
                                                    setSelectedArtist(artist.artist);
                                                    setTabValue(TAB_ALBUMS);
                                                    setSearchQuery('');
                                                }}
                                            >
                                                <CardMedia className={classes.mediaSquare} image={artistArtworkUrl(artist.artist, 256)} sx={{ backgroundSize: 'cover' }}>
                                                    {!artist.artwork && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                                            <MusicNote sx={{ fontSize: 64, color: 'action.disabled' }} />
                                                        </Box>
                                                    )}
                                                </CardMedia>
                                                <CardContent sx={{ p: 1 }}>
                                                    <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.85rem' }}>
                                                        {artist.artist}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                                                        {artist.albumCount ? `${artist.albumCount} album${artist.albumCount === 1 ? '' : 's'}` : 'No albums yet'}
                                                    </Typography>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Box>
                )}
                {tabValue === TAB_ALBUMS && (
                    <Box className={classes.tabPanel}>
                        {selectedArtist && (
                            <Box sx={{ mb: 1 }}>
                                <Chip
                                    label={`Artist: ${selectedArtist}`}
                                    onDelete={() => setSelectedArtist(null)}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                />
                            </Box>
                        )}
                        <Box
                            sx={{
                                display: 'grid',
                                gap: 2,
                                gridTemplateColumns: {
                                    xs: 'repeat(2, minmax(0, 1fr))',
                                    sm: 'repeat(3, minmax(0, 1fr))',
                                    md: `repeat(${isExpanded ? 7 : 5}, minmax(0, 1fr))`,
                                },
                            }}
                        >
                            {filteredAlbums.map((album: any, idx: number) => (
                                <Box key={idx}>
                                        <Card className={classes.card}>
                                            <CardActionArea onClick={() => openAlbumInFolders(album.artist, album.album)}>
                                                <CardMedia className={classes.mediaSquare} image={withArtworkSize(album.artwork || '', 256)} sx={{ backgroundSize: 'cover' }}>
                                            {!album.artwork && <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Album sx={{ fontSize: 48, opacity: 0.3 }} /></Box>}
                                            </CardMedia>
                                            <CardContent sx={{ p: 1 }}>
                                                <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.8rem' }}>{album.album}</Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap display="block">{album.artist}</Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}
            </Box>

            {currentAudioUrl && tabValue !== TAB_NOW_PLAYING && (
                <Box className={classes.playerMini}>
                    <PreviewPlayer
                        sourceUrl={currentAudioUrl}
                        initialDuration={previewTrack?.duration}
                        artworkUrl={previewTrack?.artwork ? withArtworkSize(previewTrack.artwork, 128) : undefined}
                        onArtworkClick={() => {
                            setTabValue(TAB_NOW_PLAYING);
                            onOpenNowPlaying();
                        }}
                        onClose={() => setCurrentAudioUrl(null)}
                        compact={!previewPlaying}
                        trackTitle={previewTrack?.title}
                        trackSubtitle={previewTrack?.artist || previewTrack?.album}
                        onPlayStateChange={setPreviewPlaying}
                        onEnded={handleTrackEnded}
                        onPrev={handlePrevTrack}
                        onNext={handleNextTrack}
                        onToggleShuffle={() => setShuffleEnabled((v) => !v)}
                        onToggleRepeat={toggleRepeatMode}
                        shuffleEnabled={shuffleEnabled}
                        repeatMode={repeatMode}
                    />
                </Box>
            )}

            <LibrarySettingsDialog 
                open={settingsOpen} 
                onClose={() => setSettingsOpen(false)} 
                onRestart={() => setTimeout(() => window.location.reload(), 3000)}
                scanStatus={scanStatus}
                onStartScan={handleStartScan}
                onStartIncrementalScan={handleScanNewFiles}
                onRefreshMetadataArtwork={handleRefreshMetadataArtwork}
            />
            <Suspense fallback={null}>
                <MDLabelMakerDialog
                    key={`label-${labelMakerSession}`}
                    open={labelMakerOpen}
                    onClose={() => setLabelMakerOpen(false)}
                    defaultArtwork={labelSeed?.artwork || previewTrack?.artwork}
                    defaultTitle={labelSeed?.album || previewTrack?.album}
                    defaultArtist={labelSeed?.artist || previewTrack?.artist}
                    defaultYear={labelSeed?.year || previewTrack?.year}
                    defaultTrackTitle={labelSeed?.track || previewTrack?.title}
                />
            </Suspense>
        </Box>
    );
};
