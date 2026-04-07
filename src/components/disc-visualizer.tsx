import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { SwapHoriz } from '@mui/icons-material';
import { useDeviceCapabilities, useShallowEqualSelector } from '../frontend-utils';
import { bytesToHumanReadable, formatTimeFromSeconds, getSortedTracks } from '../utils';
import serviceRegistry from '../services/registry';

const useStyles = makeStyles()((theme) => ({
    root: {
        width: '100%',
        padding: theme.spacing(1.5),
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: theme.spacing(2),
        background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
        borderRadius: theme.shape.borderRadius,
        position: 'relative',
        boxShadow: theme.shadows[4],
        marginBottom: theme.spacing(2),
        minHeight: 220,
        [theme.breakpoints.down('md')]: {
            minHeight: 180,
            gap: theme.spacing(1.5),
        },
    },
    toggleBtn: {
        position: 'absolute',
        top: theme.spacing(1),
        right: theme.spacing(1),
    },
    leftPane: {
        flex: '0 0 46%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        [theme.breakpoints.down('md')]: {
            flexBasis: '48%',
        },
    },
    disc: {
        width: 160,
        height: 160,
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
        [theme.breakpoints.down('md')]: {
            width: 132,
            height: 132,
        },
    },
    discArt: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 0.6,
    },
    discLabel: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid #444',
    },
    rightPane: {
        flex: '1 1 54%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingRight: theme.spacing(4),
        [theme.breakpoints.down('md')]: {
            paddingRight: theme.spacing(3),
        },
    },
    discTitle: {
        fontWeight: 700,
        lineHeight: 1.1,
        marginBottom: theme.spacing(0.5),
        wordBreak: 'break-word',
    },
    sectionRow: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(0.25),
        minHeight: 22,
    },
    statusText: {
        color: theme.palette.text.secondary,
    },
    capabilities: {
        display: 'flex',
        gap: theme.spacing(0.75),
        flexWrap: 'wrap',
        marginTop: theme.spacing(2),
    },
}));

const FALLBACK_DISC_ART = '/MiniDisc512.png';

function normalizeArtworkSize(url: string, size: number = 512): string {
    const raw = (url || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location.origin);
        const path = parsed.pathname;
        if (!path || path === '/') return '';
        const isArtworkApi =
            path.includes('/api/get_artwork') ||
            path.includes('/api/get_artwork_cached') ||
            path.endsWith('api/get_artwork') ||
            path.endsWith('api/get_artwork_cached');
        if (isArtworkApi) {
            parsed.searchParams.set('size', `${size}`);
        }
        return parsed.href;
    } catch {
        return raw;
    }
}

export const DiscVisualizer = () => {
    const { classes } = useStyles();
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [resolvedArtwork, setResolvedArtwork] = useState<string>(FALLBACK_DISC_ART);
    const artworkLookupCacheRef = useRef<Map<string, string | null>>(new Map());
    const deviceStatus = useShallowEqualSelector((state) => state.main.deviceStatus);
    const disc = useShallowEqualSelector((state) => state.main.disc);
    const deviceName = useShallowEqualSelector((state) => state.main.deviceName);
    const deviceCapabilities = useDeviceCapabilities();

    const tracks = useMemo(() => getSortedTracks(disc), [disc]);
    const currentTrackIndex = deviceStatus?.track ?? -1;
    const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;
    const currentTrackAny = currentTrack as any;
    useEffect(() => {
        let cancelled = false;
        const title = `${currentTrackAny?.title || ''}`.trim();
        const artist = `${currentTrackAny?.artist || ''}`.trim();
        const album = `${currentTrackAny?.album || ''}`.trim();
        const key = `${title}`.toLowerCase() + '||' + `${artist}`.toLowerCase() + '||' + `${album}`.toLowerCase();

        const directArtwork = normalizeArtworkSize(`${currentTrackAny?.artwork || ''}`.trim(), 512);
        if (directArtwork) {
            setResolvedArtwork(directArtwork);
            artworkLookupCacheRef.current.set(key, directArtwork);
            return () => {
                cancelled = true;
            };
        }

        if (!title) {
            setResolvedArtwork(FALLBACK_DISC_ART);
            return () => {
                cancelled = true;
            };
        }

        const cached = artworkLookupCacheRef.current.get(key);
        if (cached !== undefined) {
            setResolvedArtwork(cached || FALLBACK_DISC_ART);
            return () => {
                cancelled = true;
            };
        }

        (async () => {
            try {
                const qs = new URLSearchParams();
                qs.set('title', title);
                if (artist) qs.set('artist', artist);
                if (album) qs.set('album', album);
                qs.set('size', '512');
                const response = await fetch(`/api/find_artwork?${qs.toString()}`);
                if (!response.ok) {
                    artworkLookupCacheRef.current.set(key, null);
                    if (!cancelled) setResolvedArtwork(FALLBACK_DISC_ART);
                    return;
                }
                const payload = await response.json();
                const resolved = normalizeArtworkSize(`${payload?.artwork || ''}`, 512);
                artworkLookupCacheRef.current.set(key, resolved || null);
                if (!cancelled) {
                    setResolvedArtwork(resolved || FALLBACK_DISC_ART);
                }
            } catch {
                artworkLookupCacheRef.current.set(key, null);
                if (!cancelled) setResolvedArtwork(FALLBACK_DISC_ART);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [currentTrackAny?.title, currentTrackAny?.artist, currentTrackAny?.album, currentTrackAny?.artwork]);

    const albumArt = resolvedArtwork || FALLBACK_DISC_ART;
    const measurementUnits = serviceRegistry.netmdSpec?.measurementUnits ?? 'frames';

    const leftDisplay = useMemo(() => {
        if (!disc) return 'No disc loaded';
        if (measurementUnits === 'bytes') {
            return `${bytesToHumanReadable(Math.max(0, disc.left))} left`;
        }
        return `${formatTimeFromSeconds(Math.max(0, disc.left), false)} left`;
    }, [disc, measurementUnits]);

    const totalDisplay = useMemo(() => {
        if (!disc) return '-';
        if (measurementUnits === 'bytes') {
            return bytesToHumanReadable(Math.max(0, disc.total));
        }
        return formatTimeFromSeconds(Math.max(0, disc.total), false);
    }, [disc, measurementUnits]);

    const progressText = useMemo(() => {
        if (!disc || !deviceStatus?.time || currentTrackIndex < 0 || !tracks[currentTrackIndex]) return '-';
        const elapsed = (deviceStatus.time.minute ?? 0) * 60 + (deviceStatus.time.second ?? 0);
        const total = Math.max(0, tracks[currentTrackIndex].duration ?? 0);
        return `${formatTimeFromSeconds(elapsed, false)} / ${formatTimeFromSeconds(total, false)}`;
    }, [deviceStatus, currentTrackIndex, tracks, disc]);

    const isVirtual = Boolean(disc && disc.writeProtected && !disc.writable) || (deviceName || '').toLowerCase().includes('virtual');
    const capabilityBadges = [
        deviceCapabilities.trackUpload ? 'Upload' : null,
        deviceCapabilities.trackDownload ? 'Download' : null,
        deviceCapabilities.metadataEdit ? 'Edit' : null,
        deviceCapabilities.playbackControl ? 'Playback' : null,
        deviceCapabilities.himdTitles ? 'Hi-MD Titles' : null,
        deviceCapabilities.discEject ? 'Eject' : null,
    ].filter(Boolean) as string[];

    return (
        <Box className={classes.root}>
            <Tooltip title={showAdvanced ? 'Show Overview' : 'Show Advanced Details'}>
                <IconButton className={classes.toggleBtn} onClick={() => setShowAdvanced((v) => !v)}>
                    <SwapHoriz />
                </IconButton>
            </Tooltip>

            <Box className={classes.leftPane}>
                <Box className={classes.disc}>
                    <img src={albumArt} className={classes.discArt} alt="Album Art" />
                    <Box className={classes.discLabel}>
                        <Typography variant="caption" sx={{ color: '#00ff00', display: 'block' }}>
                            {currentTrack?.title || 'No Track Loaded'}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Box className={classes.rightPane}>
                <Typography variant="h6" className={classes.discTitle}>
                    {disc ? disc.title || 'Untitled Disc' : 'Select Disc'}
                </Typography>
                <Typography variant="subtitle2" className={classes.statusText}>
                    {currentTrackIndex >= 0 ? `Track ${currentTrackIndex + 1} of ${tracks.length}` : 'No track selected'}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                    {currentTrackAny?.artist || 'Unknown Artist'}
                </Typography>

                {!showAdvanced ? (
                    <>
                        <Box className={classes.sectionRow}>
                            <Typography variant="caption" className={classes.statusText}>
                                Device:
                            </Typography>
                            <Typography variant="caption">{deviceName || 'Not connected'}</Typography>
                        </Box>
                        <Box className={classes.sectionRow}>
                            <Typography variant="caption" className={classes.statusText}>
                                State:
                            </Typography>
                            <Typography variant="caption">{deviceStatus?.state || 'unknown'}</Typography>
                        </Box>
                        <Box className={classes.sectionRow}>
                            <Typography variant="caption" className={classes.statusText}>
                                Disc:
                            </Typography>
                            <Typography variant="caption">{leftDisplay} / {totalDisplay}</Typography>
                        </Box>
                    </>
                ) : (
                    <>
                        <Box className={classes.sectionRow}>
                            <Typography variant="caption" className={classes.statusText}>
                                Connection:
                            </Typography>
                            <Typography variant="caption">{isVirtual ? 'Virtual Disc' : 'Physical NetMD'}</Typography>
                        </Box>
                        <Box className={classes.sectionRow}>
                            <Typography variant="caption" className={classes.statusText}>
                                Playback:
                            </Typography>
                            <Typography variant="caption">{progressText}</Typography>
                        </Box>
                        <Box className={classes.sectionRow}>
                            <Typography variant="caption" className={classes.statusText}>
                                Writable:
                            </Typography>
                            <Typography variant="caption">{disc?.writable ? 'Yes' : 'No'} ({disc?.writeProtected ? 'Write-protected' : 'Unlocked'})</Typography>
                        </Box>
                        <Box className={classes.sectionRow}>
                            <Typography variant="caption" className={classes.statusText}>
                                Flush:
                            </Typography>
                            <Typography variant="caption">{(deviceStatus as any)?.canBeFlushed ? 'Pending flush' : 'Clean'}</Typography>
                        </Box>
                        <Box className={classes.capabilities}>
                            {capabilityBadges.map((cap) => (
                                <Chip key={cap} size="small" label={cap} />
                            ))}
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
};
