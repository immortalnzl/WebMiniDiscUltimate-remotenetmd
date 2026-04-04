import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, LinearProgress, Typography, Slider, Tooltip } from '@mui/material';
import { PlayArrow, Pause, Stop, Close, SkipNext, SkipPrevious, Shuffle, Repeat, RepeatOne, MusicNote, Replay10, Forward10, VolumeUp, VolumeOff, Speed, Timer } from '@mui/icons-material';
import { makeStyles } from 'tss-react/mui';
import { formatTimeFromSeconds } from '../utils';

let sharedAudio: HTMLAudioElement | null = null;
const getSharedAudio = () => {
    if (!sharedAudio) {
        sharedAudio = new Audio();
        sharedAudio.preload = 'auto';
    }
    return sharedAudio;
};

const useStyles = makeStyles()((theme) => ({
    root: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        padding: theme.spacing(1.2, 1.5),
        minHeight: 76,
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
    },
    rootCompact: {
        padding: theme.spacing(0.9, 1.2),
        minHeight: 38,
    },
    rootImmersive: {
        padding: theme.spacing(1.4, 1.8),
        minHeight: 102,
        gap: theme.spacing(1.2),
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    topRow: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
    },
    artworkButton: {
        width: 48,
        height: 48,
        borderRadius: 6,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.action.hover,
        flexShrink: 0,
    },
    artwork: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    titleWrap: {
        minWidth: 0,
        maxWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    titlePrimary: {
        fontWeight: 600,
        lineHeight: 1.1,
    },
    titleSecondary: {
        opacity: 0.75,
        lineHeight: 1.1,
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
    },
    controlsImmersive: {
        gap: theme.spacing(1),
    },
    time: {
        minWidth: 110,
        fontVariantNumeric: 'tabular-nums',
        fontSize: '0.85rem',
    },
    timeImmersive: {
        minWidth: 140,
        fontSize: '0.95rem',
        fontWeight: 600,
    },
    progress: {
        flexGrow: 1,
    },
    progressImmersive: {
        '& .MuiLinearProgress-root': {
            height: 7,
            borderRadius: 8,
        },
    },
    auxRow: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    auxLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
    },
    auxRight: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        minWidth: 220,
    },
    auxCenter: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.75),
    },
    volumeWrap: {
        width: 120,
    },
    speedLabel: {
        minWidth: 52,
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
    },
    timerLabel: {
        minWidth: 78,
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
    },
}));

export const PreviewPlayer = ({
    sourceUrl,
    initialDuration,
    artworkUrl,
    onArtworkClick,
    onClose,
    compact = false,
    autoPlay = true,
    onPlayStateChange,
    onEnded,
    onPrev,
    onNext,
    onToggleShuffle,
    onToggleRepeat,
    shuffleEnabled = false,
    repeatMode = 'off',
    variant = 'mini',
    persistAcrossMounts = true,
    enableKeyboardShortcuts = false,
    trackTitle,
    trackSubtitle,
}: {
    sourceUrl: string;
    initialDuration?: number;
    artworkUrl?: string;
    onArtworkClick?: () => void;
    onClose?: () => void;
    compact?: boolean;
    autoPlay?: boolean;
    onPlayStateChange?: (playing: boolean) => void;
    onEnded?: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    onToggleShuffle?: () => void;
    onToggleRepeat?: () => void;
    shuffleEnabled?: boolean;
    repeatMode?: 'off' | 'one' | 'all';
    variant?: 'mini' | 'immersive';
    persistAcrossMounts?: boolean;
    enableKeyboardShortcuts?: boolean;
    trackTitle?: string;
    trackSubtitle?: string;
}) => {
    const { classes, cx } = useStyles();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [sleepUntilMs, setSleepUntilMs] = useState<number | null>(null);
    const [sleepTickMs, setSleepTickMs] = useState<number>(Date.now());
    const autostartedRef = useRef(false);
    const autoStartCanceledRef = useRef(false);

    const safeInitialDuration = Number.isFinite(initialDuration) && (initialDuration ?? 0) > 0 ? (initialDuration as number) : 0;
    const effectiveDuration = duration > 0 ? duration : safeInitialDuration;
    const progress = effectiveDuration > 0 ? Math.max(0, Math.min(100, (currentTime / effectiveDuration) * 100)) : 0;
    const canSeek = effectiveDuration > 0;

    useEffect(() => {
        const audio = getSharedAudio();
        const srcChanged = !audio.src || (!audio.src.endsWith(sourceUrl) && audio.src !== sourceUrl);
        if (srcChanged) {
            audio.src = sourceUrl;
            audio.load();
            setCurrentTime(0);
            setDuration(0);
            setIsPlaying(false);
            autostartedRef.current = false;
            autoStartCanceledRef.current = false;
        }
        audioRef.current = audio;

        const handleTimeUpdate = () => {
            const nextTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
            const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
            setCurrentTime(nextTime);
            setDuration(nextDuration);
        };
        const handlePlay = () => {
            setIsPlaying(true);
            onPlayStateChange?.(true);
        };
        const handlePause = () => {
            setIsPlaying(false);
            onPlayStateChange?.(false);
        };
        const handleEnded = () => {
            setIsPlaying(false);
            onPlayStateChange?.(false);
            setCurrentTime(0);
            onEnded?.();
        };
        const handleCanPlay = () => {
            if (autoPlay && !autostartedRef.current && !autoStartCanceledRef.current) {
                autostartedRef.current = true;
                audio.play().catch(() => undefined);
            }
        };
        const handleLoadedMetadata = () => {
            handleTimeUpdate();
            if (autoPlay && !autostartedRef.current && !autoStartCanceledRef.current) {
                autostartedRef.current = true;
                audio.play().catch(() => undefined);
            }
        };
        const handleError = () => {
            if (audio.preload !== 'auto') {
                audio.preload = 'auto';
                audio.load();
            }
        };
        const handleStalled = () => {
            if (audio.preload !== 'auto') {
                audio.preload = 'auto';
                audio.load();
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('stalled', handleStalled);

        handleTimeUpdate();
        setIsPlaying(!audio.paused && !audio.ended);
        setVolume(Number.isFinite(audio.volume) ? audio.volume : 1);
        setMuted(!!audio.muted);
        setPlaybackRate(Number.isFinite(audio.playbackRate) ? audio.playbackRate : 1);

        if (srcChanged && autoPlay && !autoStartCanceledRef.current) {
            autostartedRef.current = true;
            audio.play().catch(() => undefined);
        }

        return () => {
            autoStartCanceledRef.current = true;
            if (!persistAcrossMounts) {
                audio.pause();
                try {
                    audio.src = '';
                    audio.load();
                } catch (e) {}
            }
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('stalled', handleStalled);
            audioRef.current = null;
        };
    }, [sourceUrl, autoPlay, onPlayStateChange, onEnded, persistAcrossMounts]);

    const seekBy = useCallback((seconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        const next = Math.max(0, Math.min((audio.duration || effectiveDuration || 0), (audio.currentTime || 0) + seconds));
        try {
            audio.currentTime = next;
            setCurrentTime(next);
        } catch {
            // ignore
        }
    }, [effectiveDuration]);

    const handlePlay = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;
        await audio.play().catch(() => undefined);
    }, []);

    const handlePause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        autoStartCanceledRef.current = true;
        audio.pause();
    }, []);

    const handleStop = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        autoStartCanceledRef.current = true;
        audio.pause();
        audio.currentTime = 0;
        setCurrentTime(0);
    }, []);

    const handleSeek = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!canSeek) return;
            const audio = audioRef.current;
            if (!audio) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
            const percentage = rect.width > 0 ? x / rect.width : 0;
            const targetTime = percentage * effectiveDuration;
            try {
                audio.currentTime = targetTime;
                setCurrentTime(targetTime);
            } catch {
                // Ignore unsupported seek operations.
            }
        },
        [canSeek, effectiveDuration]
    );

    const handleVolumeChange = useCallback((_event: Event, nextValue: number | number[]) => {
        const raw = Array.isArray(nextValue) ? nextValue[0] : nextValue;
        const next = Math.max(0, Math.min(1, Number(raw)));
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = next;
        audio.muted = next === 0 ? true : false;
        setVolume(next);
        setMuted(audio.muted);
    }, []);

    const toggleMute = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.muted = !audio.muted;
        setMuted(audio.muted);
    }, []);

    const toggleSpeed = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const speeds = [1, 1.25, 1.5, 2];
        const idx = speeds.findIndex((s) => Math.abs(s - (audio.playbackRate || 1)) < 0.01);
        const next = speeds[(idx + 1) % speeds.length];
        audio.playbackRate = next;
        setPlaybackRate(next);
    }, []);

    const toggleSleepTimer = useCallback(() => {
        const steps = [0, 15, 30, 60];
        const minutesLeft = sleepUntilMs ? Math.max(0, Math.ceil((sleepUntilMs - Date.now()) / 60000)) : 0;
        let currentStep = 0;
        if (minutesLeft >= 55) currentStep = 60;
        else if (minutesLeft >= 25) currentStep = 30;
        else if (minutesLeft >= 10) currentStep = 15;
        const idx = steps.findIndex((s) => s === currentStep);
        const next = steps[(idx + 1) % steps.length];
        if (next === 0) {
            setSleepUntilMs(null);
            return;
        }
        setSleepUntilMs(Date.now() + next * 60 * 1000);
    }, [sleepUntilMs]);

    const handleCloseClick = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
        }
        onPlayStateChange?.(false);
        onClose?.();
    }, [onClose, onPlayStateChange]);

    const immersive = variant === 'immersive';
    const controlButtonSize: 'small' | 'medium' = immersive ? 'medium' : 'small';
    const iconSize: 'small' | 'medium' = immersive ? 'medium' : 'small';

    useEffect(() => {
        if (!enableKeyboardShortcuts) return;
        const handler = (event: KeyboardEvent) => {
            const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || (event.target as HTMLElement | null)?.isContentEditable) {
                return;
            }
            if (event.key === ' ' || event.code === 'Space') {
                event.preventDefault();
                if (isPlaying) {
                    handlePause();
                } else {
                    handlePlay();
                }
                return;
            }
            if (event.key.toLowerCase() === 'j' || event.key === 'ArrowLeft') {
                event.preventDefault();
                if (event.shiftKey) {
                    seekBy(-10);
                } else {
                    onPrev?.();
                }
                return;
            }
            if (event.key.toLowerCase() === 'l' || event.key === 'ArrowRight') {
                event.preventDefault();
                if (event.shiftKey) {
                    seekBy(10);
                } else {
                    onNext?.();
                }
                return;
            }
            if (event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (isPlaying) {
                    handlePause();
                } else {
                    handlePlay();
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [enableKeyboardShortcuts, isPlaying, handlePause, handlePlay, onPrev, onNext, seekBy]);

    useEffect(() => {
        if (!sleepUntilMs) return;
        const timer = window.setInterval(() => {
            const now = Date.now();
            setSleepTickMs(now);
            if (now < sleepUntilMs) return;
            const audio = audioRef.current;
            if (audio && !audio.paused) {
                audio.pause();
            }
            setSleepUntilMs(null);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [sleepUntilMs]);

    const sleepMinutesLeft = sleepUntilMs ? Math.max(0, Math.ceil((sleepUntilMs - sleepTickMs) / 60000)) : 0;

    if (!immersive) {
        return (
            <Box className={cx(classes.root, compact && classes.rootCompact)}>
                <IconButton
                    size="small"
                    className={classes.artworkButton}
                    onClick={onArtworkClick}
                    disabled={!onArtworkClick}
                >
                    {artworkUrl ? <img src={artworkUrl} alt="" className={classes.artwork} /> : <MusicNote fontSize="small" />}
                </IconButton>
                {(trackTitle || trackSubtitle) && (
                    <Box className={classes.titleWrap}>
                        {trackTitle && (
                            <Typography variant="body2" noWrap className={classes.titlePrimary}>
                                {trackTitle}
                            </Typography>
                        )}
                        {trackSubtitle && (
                            <Typography variant="caption" noWrap className={classes.titleSecondary}>
                                {trackSubtitle}
                            </Typography>
                        )}
                    </Box>
                )}
                <Box className={classes.controls}>
                    <IconButton size="small" onClick={onPrev}>
                        <SkipPrevious fontSize="small" />
                    </IconButton>
                </Box>
                <IconButton size="small" onClick={isPlaying ? handlePause : handlePlay}>
                    {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                </IconButton>
                <IconButton size="small" onClick={handleStop}>
                    <Stop fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={onNext}>
                    <SkipNext fontSize="small" />
                </IconButton>
                <IconButton
                    size="small"
                    onClick={onToggleRepeat}
                    color={repeatMode !== 'off' ? 'primary' : 'default'}
                >
                    {repeatMode === 'one' ? <RepeatOne fontSize="small" /> : <Repeat fontSize="small" />}
                </IconButton>
                <IconButton
                    size="small"
                    onClick={onToggleShuffle}
                    color={shuffleEnabled ? 'primary' : 'default'}
                >
                    <Shuffle fontSize="small" />
                </IconButton>
                <Typography className={classes.time}>
                    {formatTimeFromSeconds(currentTime, false)} / {formatTimeFromSeconds(effectiveDuration, false)}
                </Typography>
                <Box className={classes.progress} onClick={handleSeek} sx={{ cursor: canSeek ? 'pointer' : 'default' }}>
                    <LinearProgress variant={canSeek ? "determinate" : "indeterminate"} value={progress} />
                </Box>
                {onClose && (
                    <IconButton size="small" onClick={handleCloseClick}>
                        <Close fontSize="small" />
                    </IconButton>
                )}
            </Box>
        );
    }

    return (
        <Box className={cx(classes.root, classes.rootImmersive)}>
            <Box className={classes.topRow}>
                <IconButton
                    size={controlButtonSize}
                    className={classes.artworkButton}
                    onClick={onArtworkClick}
                    disabled={!onArtworkClick}
                    sx={{ width: 56, height: 56 }}
                >
                    {artworkUrl ? <img src={artworkUrl} alt="" className={classes.artwork} /> : <MusicNote fontSize={iconSize} />}
                </IconButton>
                <Box className={cx(classes.controls, classes.controlsImmersive)}>
                    <IconButton size={controlButtonSize} onClick={onPrev}>
                        <SkipPrevious fontSize={iconSize} />
                    </IconButton>
                </Box>
                <IconButton size={controlButtonSize} onClick={isPlaying ? handlePause : handlePlay}>
                    {isPlaying ? <Pause fontSize={iconSize} /> : <PlayArrow fontSize={iconSize} />}
                </IconButton>
                <IconButton size={controlButtonSize} onClick={handleStop}>
                    <Stop fontSize={iconSize} />
                </IconButton>
                <IconButton size={controlButtonSize} onClick={onNext}>
                    <SkipNext fontSize={iconSize} />
                </IconButton>
                <IconButton
                    size={controlButtonSize}
                    onClick={onToggleRepeat}
                    color={repeatMode !== 'off' ? 'primary' : 'default'}
                >
                    {repeatMode === 'one' ? <RepeatOne fontSize={iconSize} /> : <Repeat fontSize={iconSize} />}
                </IconButton>
                <IconButton
                    size={controlButtonSize}
                    onClick={onToggleShuffle}
                    color={shuffleEnabled ? 'primary' : 'default'}
                >
                    <Shuffle fontSize={iconSize} />
                </IconButton>
                <Typography className={cx(classes.time, classes.timeImmersive)}>
                    {formatTimeFromSeconds(currentTime, false)} / {formatTimeFromSeconds(effectiveDuration, false)}
                </Typography>
                {onClose && (
                    <IconButton size={controlButtonSize} onClick={handleCloseClick}>
                        <Close fontSize={iconSize} />
                    </IconButton>
                )}
            </Box>
            <Box className={cx(classes.progress, classes.progressImmersive)} onClick={handleSeek} sx={{ cursor: canSeek ? 'pointer' : 'default' }}>
                <LinearProgress variant={canSeek ? "determinate" : "indeterminate"} value={progress} />
            </Box>
            <Box className={classes.auxRow}>
                <Box className={classes.auxLeft}>
                    <Tooltip title="Back 10 seconds">
                        <IconButton size={controlButtonSize} onClick={() => seekBy(-10)}>
                            <Replay10 fontSize={iconSize} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Forward 10 seconds">
                        <IconButton size={controlButtonSize} onClick={() => seekBy(10)}>
                            <Forward10 fontSize={iconSize} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Playback speed">
                        <IconButton size={controlButtonSize} onClick={toggleSpeed}>
                            <Speed fontSize={iconSize} />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="body2" className={classes.speedLabel}>
                        {playbackRate.toFixed(2)}x
                    </Typography>
                </Box>
                <Box className={classes.auxCenter}>
                    <Tooltip title="Sleep timer (off, 15m, 30m, 60m)">
                        <IconButton size={controlButtonSize} onClick={toggleSleepTimer} color={sleepUntilMs ? 'primary' : 'default'}>
                            <Timer fontSize={iconSize} />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="body2" className={classes.timerLabel}>
                        {sleepUntilMs ? `${sleepMinutesLeft}m` : 'sleep off'}
                    </Typography>
                </Box>
                <Box className={classes.auxRight}>
                    <Tooltip title={muted ? 'Unmute' : 'Mute'}>
                        <IconButton size={controlButtonSize} onClick={toggleMute}>
                            {muted ? <VolumeOff fontSize={iconSize} /> : <VolumeUp fontSize={iconSize} />}
                        </IconButton>
                    </Tooltip>
                    <Box className={classes.volumeWrap}>
                        <Slider
                            value={muted ? 0 : volume}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={handleVolumeChange}
                            size="small"
                            aria-label="Volume"
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
