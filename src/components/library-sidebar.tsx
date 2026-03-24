import React, { useCallback, useEffect, useState } from 'react';
import { useShallowEqualSelector, useDispatch } from '../frontend-utils';
import { actions as localLibraryActions } from '../redux/local-library-feature';
import { openLocalLibrary } from '../redux/actions';
import serviceRegistry from '../services/registry';
import { File, FileBrowser } from './file-browser/browser';
import { FileType, dirSorter } from './file-browser/utils';
import { LocalDatabase } from '../services/library/library';
import { makeStyles } from 'tss-react/mui';
import { Typography, Box, InputBase, Paper, IconButton } from '@mui/material';
import { Search, Folder, Description, PlayArrow, Add, GridView, List, Fullscreen, FullscreenExit, Album, MusicNote } from '@mui/icons-material';
import { AdaptiveFile } from '../utils';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';
import { Grid, Card, CardMedia, CardContent, CardActionArea, Tooltip as MuiTooltip } from '@mui/material';

const useStyles = makeStyles()((theme) => ({
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
        padding: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    search: {
        display: 'flex',
        alignItems: 'center',
        padding: '2px 4px',
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
    },
    input: {
        marginLeft: theme.spacing(1),
        flex: 1,
    },
    browserWrapper: {
        flexGrow: 1,
        overflow: 'auto',
        padding: theme.spacing(1),
    },
    playerMini: {
        padding: theme.spacing(1),
        borderTop: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
    },
    gridItem: {
        height: '100%',
    },
    card: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    media: {
        aspectRatio: '1/1',
        backgroundColor: theme.palette.action.hover,
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
    const { database, status } = useShallowEqualSelector((state) => state.localLibrary);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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
        dispatch(openLocalLibrary());
    }, [dispatch]);

    const handleFileAction = useCallback((file: File) => {
        if (file.type === FileType.Directory) {
            setCurrentPath(e => [...e, file.name]);
        } else {
            // Add on double click
            handleAddToPlaylist([file]);
        }
    }, [currentPath]);

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
                    return serviceRegistry.libraryService!.processLocalLibraryFile(props['id'], params);
                },
            };
        });
        setUploadedFiles(adaptiveFiles);
        dispatch(convertDialogActions.setVisible(true));
    }, [database, currentPath, setUploadedFiles, dispatch]);

    const renderGridView = () => (
        <Grid container spacing={2}>
            {currentFileTree.map((file) => (
                <Grid item xs={6} sm={4} md={isExpanded ? 3 : 6} key={file.name}>
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
                                <Typography variant="subtitle2" noWrap>
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
                    <Typography variant="h6">Music Library</Typography>
                    <Box>
                        <MuiTooltip title={viewMode === 'list' ? 'Grid View' : 'List View'}>
                            <IconButton size="small" onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}>
                                {viewMode === 'list' ? <GridView fontSize="small" /> : <List fontSize="small" />}
                            </IconButton>
                        </MuiTooltip>
                        <MuiTooltip title={isExpanded ? 'Collapse' : 'Expand'}>
                            <IconButton size="small" onClick={onToggleExpand}>
                                {isExpanded ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
                            </IconButton>
                        </MuiTooltip>
                    </Box>
                </Box>
                <Paper className={classes.search}>
                    <Search color="disabled" sx={{ ml: 1 }} />
                    <InputBase
                        className={classes.input}
                        placeholder="Search artists, albums..."
                        inputProps={{ 'aria-label': 'search music' }}
                    />
                </Paper>
            </Box>
            <Box className={classes.browserWrapper}>
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
                                return <img src={file.props.artwork} alt="" style={{ width: 24, height: 24, objectFit: 'cover' }} />;
                            }
                            return file.type === FileType.Directory ? <Folder /> : <Description />;
                        }}
                        additionalColumns={[
                            { name: 'name', sortable: true },
                        ]}
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
                            },
                            {
                                name: 'Play',
                                icon: <PlayArrow />,
                                actionPossible: (e) => e.length === 1 && e[0].type === FileType.File,
                                handler: (e) => {
                                    const url = serviceRegistry.libraryService?.getAudioUrl(e[0].props!['id']);
                                    if (url) setCurrentAudioUrl(url);
                                },
                            }
                        ]}
                    />
                ) : renderGridView()}
            </Box>
            {currentAudioUrl && (
                <Box className={classes.playerMini}>
                    <audio src={currentAudioUrl} controls autoPlay style={{ height: 32, flexGrow: 1 }} />
                    <IconButton size="small" onClick={() => setCurrentAudioUrl(null)}>
                        <Description fontSize="small" />
                    </IconButton>
                </Box>
            )}
        </Box>
    );
};
