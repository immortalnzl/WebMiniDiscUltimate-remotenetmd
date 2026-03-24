import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useShallowEqualSelector, useDispatch } from '../frontend-utils';
import { actions as localLibraryActions } from '../redux/local-library-feature';
import { openLocalLibrary, loadLibraryDatabase, loadLibraryStatus, loadArtists, loadAlbums } from '../redux/actions';
import serviceRegistry from '../services/registry';
import { File, FileBrowser } from './file-browser/browser';
import { FileType } from './file-browser/utils';
import { LocalDatabase } from '../services/library/library';
import { makeStyles } from 'tss-react/mui';
import { Typography, Box, InputBase, Paper, IconButton, Tabs, Tab, Badge, LinearProgress, Dialog, DialogTitle, DialogContent, Button } from '@mui/material';
import { Search, Folder, Description, PlayArrow, Add, GridView, List, Fullscreen, FullscreenExit, Album, MusicNote, Settings, Refresh, Terminal, History } from '@mui/icons-material';
import { AdaptiveFile } from '../utils';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';
import { Grid, Card, CardMedia, CardContent, CardActionArea, Tooltip as MuiTooltip } from '@mui/material';
import { LibrarySettingsDialog } from './library-settings-dialog';

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
        padding: theme.spacing(1),
        borderTop: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
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
        aspectRatio: '1/1',
        backgroundColor: theme.palette.action.hover,
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

export const MusicLibrarySidebar = ({ setUploadedFiles, isExpanded, onToggleExpand }: { 
    setUploadedFiles: (files: AdaptiveFile[]) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}) => {
    const { classes, cx } = useStyles();
    const dispatch = useDispatch();
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const { database, status, artists, albums, scanStatus } = useShallowEqualSelector((state) => state.localLibrary);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [tabValue, setTabValue] = useState(0);
    const [logsOpen, setLogsOpen] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const logRef = useRef<HTMLPreElement>(null);

    const convertToFileArray = (data: LocalDatabase, path: string[] = []): File[] => {
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

    const [currentFileTree, setCurrentFileTree] = useState<File[]>([]);

    useEffect(() => {
        if (database) {
            setCurrentFileTree(convertToFileArray(database, currentPath));
        }
    }, [database, currentPath]);

    useEffect(() => {
        const load = () => {
            const { libraryService } = serviceRegistry;
            if (libraryService) {
                dispatch(loadLibraryDatabase());
                if (scanStatus?.scanning) {
                    dispatch(loadLibraryStatus());
                    dispatch(loadArtists());
                    dispatch(loadAlbums());
                }
            }
        };
        load();
        const interval = setInterval(load, 3000); 
        return () => clearInterval(interval);
    }, [dispatch, scanStatus?.scanning]);

    useEffect(() => {
        if (logsOpen) {
            const fetchLogs = async () => {
                try {
                    const resp = await fetch('/api/logs');
                    const data = await resp.json();
                    setLogs(data.logs);
                } catch (e) {}
            };
            fetchLogs();
            const it = setInterval(fetchLogs, 2000);
            return () => clearInterval(it);
        }
    }, [logsOpen]);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    const handleFileAction = useCallback((file: File) => {
        if (file.type === FileType.Directory) {
            setCurrentPath(e => [...e, file.name]);
        } else {
            handleAddToPlaylist([file]);
        }
    }, []);

    const handleAddToPlaylist = useCallback((files: File[]) => {
        const process = (path: string[], files: File[]): File[] => {
            const finalFiles = [];
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

        const tracksToAdd = process(currentPath, files);
        const adaptiveFiles: AdaptiveFile[] = tracksToAdd.map((file) => {
            const props = file.props!;
            const pathTokens = props['id'].split('/');
            return {
                album: props['album'],
                artist: props['artist'],
                title: props['title'],
                name: pathTokens[pathTokens.length - 1] || 'unknown.unk',
                duration: props['duration'],
                artwork: props['artwork'],
                getForEncoding: async (params) => {
                    const { libraryService } = serviceRegistry;
                    if (!libraryService) throw new Error('Library service not available');
                    return libraryService.processLocalLibraryFile(props['id'], params);
                },
            };
        });
        setUploadedFiles(adaptiveFiles);
        dispatch(convertDialogActions.setVisible(true));
    }, [database, currentPath, setUploadedFiles, dispatch]);

    const renderGridView = (files: File[]) => (
        <Grid container spacing={2}>
            {files.map((file) => (
                <Grid item xs={6} sm={4} md={isExpanded ? 2 : 6} key={file.name}>
                    <Card className={classes.card}>
                        <CardActionArea onClick={() => handleFileAction(file)}>
                            <CardMedia
                                className={classes.media}
                                image={file.props?.artwork || ''}
                                title={file.name}
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

    return (
        <Box className={cx(classes.root, isExpanded && classes.rootExpanded)}>
            <Box className={classes.header}>
                <Box className={classes.headerActions}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Music Library</Typography>
                    <Box>
                        <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                            <Settings fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={onToggleExpand}>
                            {isExpanded ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                        </IconButton>
                    </Box>
                </Box>
            </Box>

            {scanStatus && (
                <Box className={classes.statusCard}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                            {scanStatus.scanning ? "Scanning Library..." : "Library Ready"}
                            {scanStatus.scanning && <Refresh fontSize="inherit" className="rotating" sx={{ ml: 1 }} />}
                        </Typography>
                        <IconButton size="small" onClick={() => setLogsOpen(true)}>
                            <Terminal fontSize="inherit" />
                        </IconButton>
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
                        <Box>
                            <Typography variant="caption" color="text.secondary">Tracks</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.files_found}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Artists</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.artists_found}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">Albums</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{scanStatus.albums_found}</Typography>
                        </Box>
                    </Box>
                </Box>
            )}

            <Tabs value={tabValue} onChange={(e: any, v: any) => setTabValue(v)} variant="fullWidth" size="small" sx={{ minHeight: 40, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Folders" sx={{ minHeight: 40, fontSize: '0.75rem' }} />
                <Tab label="Artists" sx={{ minHeight: 40, fontSize: '0.75rem' }} />
                <Tab label="Albums" sx={{ minHeight: 40, fontSize: '0.75rem' }} />
            </Tabs>

            <Paper className={classes.search}>
                <Search color="disabled" sx={{ fontSize: 20 }} />
                <InputBase
                    className={classes.input}
                    placeholder={`Search ${tabValue === 0 ? "folders" : tabValue === 1 ? "artists" : "albums"}...`}
                />
                <IconButton size="small" onClick={() => setViewMode((v: any) => v === 'list' ? 'grid' : 'list')}>
                    {viewMode === 'list' ? <GridView fontSize="inherit" /> : <List fontSize="inherit" />}
                </IconButton>
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
                                iconGenerator={(file) => {
                                    if (file.type === FileType.File && file.props?.artwork) {
                                        return <img src={file.props.artwork} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 2 }} />;
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
                                        name: 'Add to Disc',
                                        icon: <Add />,
                                        actionPossible: (e) => e.length > 0,
                                        handler: (e) => handleAddToPlaylist(e),
                                    }
                                ]}
                            />
                        ) : renderGridView(currentFileTree)}
                    </Box>
                )}
                {tabValue === 1 && (
                    <Box className={classes.tabPanel}>
                        <Grid container spacing={1}>
                            {artists.map((artist: string) => (
                                <Grid item xs={12} key={artist}>
                                    <Button fullWidth onClick={() => {}} sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 1, textTransform: 'none', borderBottom: 1, borderColor: 'divider' }}>
                                        <MusicNote sx={{ mr: 1, opacity: 0.5 }} />
                                        <Typography variant="body2">{artist}</Typography>
                                    </Button>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}
                {tabValue === 2 && (
                    <Box className={classes.tabPanel}>
                        <Grid container spacing={2}>
                            {albums.map((album: any, idx: number) => (
                                <Grid item xs={6} sm={4} md={isExpanded ? 2 : 6} key={idx}>
                                    <Card className={classes.card}>
                                        <CardActionArea>
                                            <CardMedia className={classes.media} image={album.artwork || ''}>
                                            {!album.artwork && <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Album sx={{ fontSize: 48, opacity: 0.3 }} /></Box>}
                                            </CardMedia>
                                            <CardContent sx={{ p: 1 }}>
                                                <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.8rem' }}>{album.album}</Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap display="block">{album.artist}</Typography>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                )}
            </Box>

            {currentAudioUrl && (
                <Box className={classes.playerMini}>
                    <audio src={currentAudioUrl} controls autoPlay style={{ height: 32, flexGrow: 1 }} />
                    <IconButton size="small" onClick={() => setCurrentAudioUrl(null)}>
                        <Description fontSize="small" />
                    </IconButton>
                </Box>
            )}

            <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Live Backend Logs
                    <IconButton size="small" onClick={() => setLogsOpen(false)}><FullscreenExit /></IconButton>
                </DialogTitle>
                <DialogContent>
                    <Box component="pre" className={classes.logTerm} ref={logRef}>
                        {logs.join('\n')}
                    </Box>
                </DialogContent>
            </Dialog>

            <LibrarySettingsDialog 
                open={settingsOpen} 
                onClose={() => setSettingsOpen(false)} 
                onRestart={() => setTimeout(() => window.location.reload(), 3000)}
            />
        </Box>
    );
};
