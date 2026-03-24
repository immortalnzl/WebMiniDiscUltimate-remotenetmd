import React, { useState } from 'react';
import { Box, Typography, IconButton, Paper, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { SwapHoriz, MusicNote, SettingsInputHdmi } from '@mui/icons-material';
import { useShallowEqualSelector } from '../frontend-utils';

const useStyles = makeStyles()((theme) => ({
    root: {
        width: '100%',
        padding: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
        borderRadius: theme.shape.borderRadius,
        position: 'relative',
        boxShadow: theme.shadows[4],
        marginBottom: theme.spacing(2),
    },
    toggleBtn: {
        position: 'absolute',
        top: theme.spacing(1),
        right: theme.spacing(1),
    },
    visualContainer: {
        width: 240,
        height: 240,
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        perspective: '1000px',
    },
    disc: {
        width: 200,
        height: 200,
        backgroundColor: '#222',
        borderRadius: 8,
        position: 'relative',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'transform 0.5s ease',
    },
    discArt: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 0.6,
    },
    discLabel: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid #444',
    },
    playerBody: {
        width: 220,
        height: 220,
        backgroundColor: '#c0c0c0', // Silver MZ-N920 look
        borderRadius: 20,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        position: 'relative',
        border: '2px solid #a0a0a0',
        display: 'flex',
        flexDirection: 'column',
        padding: 10,
    },
    playerScreen: {
        width: '80%',
        height: 60,
        backgroundColor: '#002200', // LCD Off/Dark
        margin: '20px auto 10px',
        borderRadius: 4,
        border: '3px solid #666',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#00ff00', // Retro LCD text
        fontFamily: 'monospace',
        overflow: 'hidden',
        padding: 4,
    },
    playerButtons: {
        display: 'flex',
        justifyContent: 'center',
        gap: 10,
        marginTop: 20,
    },
    btnCircle: {
        width: 30,
        height: 30,
        borderRadius: '50%',
        backgroundColor: '#999',
        border: '1px solid #777',
    },
    meta: {
        marginTop: theme.spacing(2),
        textAlign: 'center',
        width: '100%',
    }
}));

export const DiscVisualizer = () => {
    const { classes } = useStyles();
    const [view, setView] = useState<'disc' | 'player'>('disc');
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const disc = useShallowEqualSelector((state) => state.main.disc);
    
    // Find current track for album art
    const tracks = disc?.groups.flatMap(g => g.tracks) ?? [];
    const currentTrackIndex = deviceStatus?.track ?? -1;
    const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;
    const albumArt = (currentTrack as any)?.artwork || null;

    return (
        <Box className={classes.root}>
            <Tooltip title={view === 'disc' ? "Show Player" : "Show Disc"}>
                <IconButton className={classes.toggleBtn} onClick={() => setView(v => v === 'disc' ? 'player' : 'disc')}>
                    <SwapHoriz />
                </IconButton>
            </Tooltip>

            <Box className={classes.visualContainer}>
                {view === 'disc' ? (
                    <Box className={classes.disc}>
                        {albumArt ? (
                            <img src={albumArt} className={classes.discArt} alt="Album Art" />
                        ) : (
                            <MusicNote sx={{ fontSize: 100, color: '#444' }} />
                        )}
                        <Box className={classes.discLabel}>
                            <Typography variant="caption" sx={{ color: '#00ff00', display: 'block' }}>
                                {currentTrack?.title || "No Track Loaded"}
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    <Box className={classes.playerBody}>
                        <Box className={classes.playerScreen}>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: '#00ff00' }}>
                                MDLP / MZ-N920
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#00ff00', whiteSpace: 'nowrap' }}>
                                {currentTrack?.title || "STANDBY"}
                            </Typography>
                        </Box>
                        <Box className={classes.playerButtons}>
                            <Box className={classes.btnCircle} />
                            <Box className={classes.btnCircle} />
                            <Box className={classes.btnCircle} />
                        </Box>
                        <Typography variant="caption" sx={{ mt: 'auto', textAlign: 'center', color: '#555' }}> SONY </Typography>
                    </Box>
                )}
            </Box>

            <Box className={classes.meta}>
                <Typography variant="subtitle2">
                    {disc ? (disc.title || "Untitled Disc") : "No Disc"}
                </Typography>
                {currentTrackIndex >= 0 && (
                    <Typography variant="caption" color="textSecondary">
                        Track {currentTrackIndex + 1} of {tracks.length}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};
