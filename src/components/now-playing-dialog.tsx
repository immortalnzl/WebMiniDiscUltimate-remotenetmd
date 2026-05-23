import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
    Stack,
    Button,
    Chip,
    Tooltip,
} from '@mui/material';
import { Close as CloseIcon, Fullscreen, FullscreenExit, DragIndicator, PlayArrow, DeleteOutline } from '@mui/icons-material';
import { makeStyles } from 'tss-react/mui';
import { PreviewPlayer } from './preview-player';

const MD_FACTS: string[] = [
    'MiniDisc launched in Japan in November 1992 as a consumer magneto-optical digital audio format.',
    'A standard MD data area stores about 140 MB, mapped to 74 or 80 minutes of SP audio depending on disc generation.',
    'Classic MD media is a 64 mm disc inside a cartridge shell roughly 68 x 72 x 5 mm.',
    'Writing on MD is magneto-optical: the laser heats spots near Curie temperature while a magnetic field sets polarity.',
    'Reading on MD uses the Kerr effect, detecting polarization changes in reflected laser light.',
    'SP mode used ATRAC psychoacoustic coding, not PCM storage, to fit full albums on tiny rewritable media.',
    'MDLP (introduced in 2000) added ATRAC3 long-play modes: LP2 (~132 kbps) and LP4 (~66 kbps).',
    'LP2 doubled recording time versus SP; LP4 quadrupled it, trading fidelity for capacity.',
    'Many early SP-era decks cannot decode MDLP tracks correctly, causing compatibility surprises.',
    'NetMD (consumer rollout in the early 2000s) added USB transfer from PC software to compatible portables/decks.',
    'NetMD generation still imposed software-side restrictions that frustrated power users.',
    'Hi-MD (2004) introduced native 1 GB discs and reformattable legacy discs for data-centric workflows.',
    'A reformatted legacy 80-minute disc in Hi-MD mode yields roughly 305 MB of usable capacity.',
    'Hi-MD recorders could capture linear PCM (44.1 kHz/16-bit), a major jump over legacy ATRAC-only recording.',
    'TOC (Table of Contents) commits are why interrupted power during write/rename operations could risk metadata loss.',
    'MD supports random access natively, unlike cassette, so track jumps are near-instant after spin-up.',
    'Track-level editing (move, divide, combine, erase, rename) is baked into many standalone decks.',
    'Portable MD anti-skip improved through larger memory buffers, making motion use far more robust than CD players.',
    'Sony remote “stick” controls often exposed transport, titling, and group operations without touching the main unit.',
    'Group mode on later units added album-like organization directly on disc.',
    'Some decks accept PS/2 keyboards for faster title entry, avoiding slow character-wheel editing.',
    'Type-R and Type-S generations refined ATRAC DSP behavior in late-era hardware implementations.',
    'Commercial pre-recorded MD releases exist, with especially strong catalog presence in Japan.',
    'Recordable MD media was marketed with rewrite lifetimes in the hundreds of thousands to around one million cycles.',
    'Because the disc surface is enclosed, MD media is less exposed to fingerprints and dust than bare optical discs.',
    'The cartridge shutter only opens in-drive, reducing casual handling damage risk.',
    'SCMS copy control applied in many digital dubbing paths, shaping consumer digital-copy behavior.',
    'Line-in MD recording became a field standard for rehearsals, lectures, interviews, and live audience taping.',
    'Manual track-mark insertion during recording enabled fast post-session editing workflows.',
    'MD decks frequently include real-time level metering and independent analog/digital input routing options.',
    'Regional model variants can differ in firmware behavior, language support, and available recording modes.',
    'Hi-MD devices can appear as USB mass-storage for file operations in supported modes.',
    'Legacy MD and Hi-MD are physically related but not fully equivalent in mode/features across all hardware.',
    'Some NetMD-era workflows transcode on host side before transfer, not on-device, impacting speed and quality paths.',
    'Disc titling uses stored character metadata on media, so titles travel with the disc between compatible units.',
    'Blank media colorways and shell designs became a collector subculture parallel to the hardware itself.',
    'SP, LP2, LP4, and Hi-MD PCM can produce markedly different audible outcomes from the same source material.',
    'Many enthusiasts maintain separate decks for transfer, playback, and archival due to model-specific strengths.',
    'Modern open tooling revived NetMD/Hi-MD workflows by bypassing much of the historical software friction.',
    'MD’s enduring appeal combines tactile hardware control, physical media curation, and editable digital structure.',
    'Unlike CD-R audio, MD was designed from day one for iterative record-edit-erase cycles on the same disc.',
    'The format bridged analog recording habits and file-era organization long before phones unified both.',
    'MiniDisc preserved a “session” mindset: record live now, restructure tracks later, publish to a single disc.',
    'For many users, MD remains the most practical historical format for portable editable digital field recording.',
];

const useStyles = makeStyles()((theme) => ({
    dialogPaper: {
        minWidth: '72vw',
        minHeight: '64vh',
    },
    content: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: theme.shape.borderRadius * 2,
        padding: theme.spacing(2),
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.mode === 'dark'
            ? 'linear-gradient(155deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 45%, rgba(11,121,227,0.10))'
            : 'linear-gradient(155deg, rgba(0,0,0,0.03), rgba(0,0,0,0.01) 45%, rgba(11,121,227,0.07))',
        flex: '1 1 auto',
        minHeight: 0,
    },
    backdrop: {
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        opacity: 0.28,
        filter: 'blur(30px) saturate(1.15)',
        transform: 'scale(1.12)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        transition: 'opacity 320ms ease',
    },
    contentInner: {
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(560px, 46%) 1fr',
        gap: theme.spacing(3),
        height: '100%',
        minHeight: 0,
        [theme.breakpoints.down('md')]: {
            gridTemplateColumns: '1fr',
        },
    },
    leftColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
        minHeight: 0,
    },
    artwork: {
        width: 'min(100%, 52vh)',
        height: 'min(52vh, 100%)',
        borderRadius: theme.shape.borderRadius,
        backgroundColor: theme.palette.action.hover,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 14px 34px rgba(0,0,0,0.32)',
        alignSelf: 'center',
        aspectRatio: '1 / 1',
    },
    artworkImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        animation: 'fadein 280ms ease',
    },
    trackTitle: {
        fontWeight: 700,
        marginBottom: theme.spacing(1),
        fontSize: '2.5rem',
        lineHeight: 1.1,
        letterSpacing: 0.3,
    },
    meta: {
        color: theme.palette.text.secondary,
        display: 'block',
    },
    playerWrap: {
        borderRadius: theme.shape.borderRadius,
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        flexShrink: 0,
    },
    metaLink: {
        color: theme.palette.primary.main,
        cursor: 'pointer',
        display: 'inline-block',
        border: 0,
        background: 'transparent',
        padding: 0,
        textAlign: 'left',
        font: 'inherit',
        '&:hover': {
            textDecoration: 'underline',
        },
    },
    subtleButton: {
        alignSelf: 'center',
    },
    mdBurnIcon: {
        width: 18,
        height: 18,
        objectFit: 'contain',
        display: 'block',
        opacity: 0.78,
        filter: 'grayscale(1) brightness(0) invert(1)',
    },
    fullscreenFact: {
        marginTop: theme.spacing(1.9),
        padding: theme.spacing(0.75, 1),
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.6)',
        color: theme.palette.text.secondary,
        display: 'block',
        width: '100%',
        textAlign: 'center',
        fontSize: '1rem',
        fontFamily: '"Palatino Linotype", "Book Antiqua", cursive',
        lineHeight: 1.45,
    },
    '@keyframes fadein': {
        from: { opacity: 0.45 },
        to: { opacity: 1 },
    },
}));

export type NowPlayingItem = {
    id: string;
    title: string;
    artist: string;
    album: string;
    year?: string;
    artwork?: string;
    duration?: number;
};

const NowPlayingContent = ({
    onClose,
    previewTrack,
    previewActive,
    previewPlaying,
    queue,
    currentIndex,
    onPlayItem,
    onRemoveItem,
    onAddAllToBurn,
    onAddItemToBurn,
    onSavePlaylist,
    onClearQueue,
    onOpenLabelMaker,
    onOpenArtist,
    onOpenAlbum,
    currentAudioUrl,
    previewDuration,
    onPreviewClose,
    onTrackEnded,
    onPreviewPlayStateChange,
    onPrevTrack,
    onNextTrack,
    onToggleShuffle,
    onToggleRepeat,
    shuffleEnabled,
    repeatMode,
    onMoveQueueItem,
    onReorderQueue,
}: {
    onClose?: () => void;
    previewTrack?: { title: string; artist: string; album: string; year?: string; artwork?: string } | null;
    previewActive?: boolean;
    previewPlaying?: boolean;
    queue?: NowPlayingItem[];
    currentIndex?: number;
    onPlayItem?: (index: number) => void;
    onRemoveItem?: (index: number) => void;
    onAddAllToBurn?: () => void;
    onAddItemToBurn?: (index: number) => void;
    onSavePlaylist?: () => void;
    onClearQueue?: () => void;
    onOpenLabelMaker?: () => void;
    onOpenArtist?: () => void;
    onOpenAlbum?: () => void;
    currentAudioUrl?: string | null;
    previewDuration?: number;
    onPreviewClose?: () => void;
    onTrackEnded?: () => void;
    onPreviewPlayStateChange?: (playing: boolean) => void;
    onPrevTrack?: () => void;
    onNextTrack?: () => void;
    onToggleShuffle?: () => void;
    onToggleRepeat?: () => void;
    shuffleEnabled?: boolean;
    repeatMode?: 'off' | 'one' | 'all';
    onMoveQueueItem?: (index: number, direction: 'up' | 'down') => void;
    onReorderQueue?: (fromIndex: number, toIndex: number) => void;
}) => {
    const { classes } = useStyles();
    const panelRef = useRef<HTMLDivElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * MD_FACTS.length));
    const [showFact, setShowFact] = useState(false);
    const fallbackItem = typeof currentIndex === 'number' && queue && queue[currentIndex] ? queue[currentIndex] : undefined;
    const activeQueueIndex = typeof currentIndex === 'number' ? currentIndex : -1;
    const activeTitle = previewTrack?.title || fallbackItem?.title;
    const activeArtist = previewTrack?.artist || fallbackItem?.artist;
    const activeAlbum = previewTrack?.album || fallbackItem?.album;
    const activeArtwork = previewTrack?.artwork || fallbackItem?.artwork;
    const activeYear = previewTrack?.year || fallbackItem?.year;
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const toggleFullscreen = async () => {
        if (!panelRef.current) return;
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined);
        } else {
            await panelRef.current.requestFullscreen().catch(() => undefined);
        }
    };

    useEffect(() => {
        if (!isFullscreen) return;
        setFactIndex(Math.floor(Math.random() * MD_FACTS.length));
        setShowFact(Math.random() < 0.45);
        const interval = window.setInterval(() => {
            const shouldShow = Math.random() < 0.45;
            setShowFact(shouldShow);
            if (!shouldShow) return;
            setFactIndex((prev) => {
                const next = Math.floor(Math.random() * MD_FACTS.length);
                return next === prev ? (next + 1) % MD_FACTS.length : next;
            });
        }, 60 * 60 * 1000);
        return () => window.clearInterval(interval);
    }, [isFullscreen]);

    useEffect(() => {
        if (!isFullscreen) {
            setShowFact(false);
        }
    }, [isFullscreen]);

    return (
        <Box
            ref={panelRef}
            sx={{
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                ...(isFullscreen
                    ? {
                        minHeight: '100vh',
                        backgroundColor: 'background.default',
                        color: 'text.primary',
                        px: { xs: 1.5, md: 2 },
                        py: { xs: 1, md: 1.5 },
                    }
                    : {}),
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Now Playing</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton size="small" onClick={toggleFullscreen}>
                        {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                    </IconButton>
                    {onClose && (
                        <IconButton size="small" onClick={onClose}>
                            <CloseIcon />
                        </IconButton>
                    )}
                </Box>
            </Box>
            <Box className={classes.content}>
                {activeArtwork && <Box className={classes.backdrop} sx={{ backgroundImage: `url(${activeArtwork})` }} key={`bg-${activeArtwork}`} />}
                <Box className={classes.contentInner} sx={isFullscreen ? { gridTemplateColumns: 'minmax(640px, 72%) minmax(0, 28%)' } : undefined}>
                    <Box
                        className={classes.leftColumn}
                        sx={isFullscreen ? { alignItems: 'center', justifyContent: 'center' } : undefined}
                    >
                        <Box
                            className={classes.artwork}
                            sx={isFullscreen ? { width: 'min(100%, 72vh)', height: 'min(72vh, 100%)' } : undefined}
                        >
                            {activeArtwork ? (
                                <img src={activeArtwork} alt={activeTitle ?? 'Artwork'} className={classes.artworkImg} key={`art-${activeArtwork}`} />
                            ) : (
                                <Typography variant="h6" color="text.secondary">
                                    No Artwork
                                </Typography>
                            )}
                        </Box>
                        {currentAudioUrl && (
                            <Box
                                className={classes.playerWrap}
                                sx={isFullscreen ? { width: 'min(100%, 72vh)' } : undefined}
                            >
                                <PreviewPlayer
                                    sourceUrl={currentAudioUrl}
                                    initialDuration={previewDuration}
                                    artworkUrl={activeArtwork}
                                    compact={false}
                                    variant="immersive"
                                    onClose={onPreviewClose}
                                    onPlayStateChange={onPreviewPlayStateChange}
                                    onEnded={onTrackEnded}
                                    onPrev={onPrevTrack}
                                    onNext={onNextTrack}
                                    onToggleShuffle={onToggleShuffle}
                                    onToggleRepeat={onToggleRepeat}
                                    shuffleEnabled={!!shuffleEnabled}
                                    repeatMode={repeatMode || 'off'}
                                    enableKeyboardShortcuts
                                />
                            </Box>
                        )}
                        <Button
                            variant="outlined"
                            size="medium"
                            onClick={onOpenLabelMaker}
                            disabled={!activeArtwork}
                            className={classes.subtleButton}
                        >
                            Make Label
                        </Button>
                    </Box>
                    <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h4" className={classes.trackTitle}>
                            {activeAlbum || 'Unknown Album'}
                        </Typography>
                        {activeArtist ? (
                            <Typography
                                variant="subtitle1"
                                component="button"
                                type="button"
                                className={classes.metaLink}
                                onClick={() => onOpenArtist?.()}
                            >
                                {activeArtist}
                            </Typography>
                        ) : (
                            <Typography variant="subtitle1" className={classes.meta}>
                                Unknown Artist
                            </Typography>
                        )}
                        <Typography variant="subtitle2" className={classes.meta}>
                            {activeYear || 'Year Unknown'}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                            {(activeTitle || '').trim() && <Chip size="small" label={activeTitle} />}
                            <Chip
                                size="small"
                                color="primary"
                                variant="outlined"
                                label={previewActive ? 'Library Preview' : 'Queue'}
                            />
                            {(activeAlbum || '').trim() && (
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label="Go To Album"
                                    onClick={() => onOpenAlbum?.()}
                                />
                            )}
                        </Stack>
                        <Box sx={{ mt: 2, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="subtitle1">Current Playing List</Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => onPlayItem?.(activeQueueIndex >= 0 ? activeQueueIndex : 0)}
                                        disabled={!queue?.length}
                                    >
                                        Play Queue
                                    </Button>
                                    <Button size="small" variant="outlined" onClick={onAddAllToBurn} disabled={!queue?.length}>
                                        Move All to Burn List
                                    </Button>
                                    <Button size="small" variant="outlined" onClick={onSavePlaylist} disabled={!queue?.length}>
                                        Save as Playlist
                                    </Button>
                                    <Button size="small" variant="outlined" color="secondary" onClick={onClearQueue} disabled={!queue?.length}>
                                        Clear Queue
                                    </Button>
                                </Box>
                            </Box>
                            <Box
                                sx={{
                                    maxHeight: isFullscreen ? 'min(62vh, 760px)' : 'min(56vh, 640px)',
                                    overflow: 'auto',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                }}
                            >
                                {queue && queue.length > 0 ? (
                                    queue.map((item, idx) => (
                                        <Box
                                            key={item.id}
                                            draggable
                                            onDragStart={() => setDraggedIndex(idx)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => {
                                                if (draggedIndex === null) return;
                                                onReorderQueue?.(draggedIndex, idx);
                                                setDraggedIndex(null);
                                            }}
                                            onDragEnd={() => setDraggedIndex(null)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                px: 1,
                                                py: 0.75,
                                                backgroundColor: idx === activeQueueIndex ? 'action.hover' : 'transparent',
                                                borderBottom: idx === queue.length - 1 ? 'none' : '1px solid',
                                                borderColor: 'divider',
                                                cursor: 'grab',
                                            }}
                                        >
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="body2" noWrap>
                                                    {item.title || 'Untitled'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {item.artist} {item.album ? ` - ${item.album}` : ''}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <IconButton size="small" sx={{ opacity: 0.7 }}>
                                                    <DragIndicator fontSize="inherit" />
                                                </IconButton>
                                                <Tooltip title="Play">
                                                    <IconButton size="medium" color="primary" onClick={() => onPlayItem?.(idx)}>
                                                        <PlayArrow fontSize="medium" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Add to Burn">
                                                    <IconButton size="medium" color="primary" onClick={() => onAddItemToBurn?.(idx)}>
                                                        <img src="/MiniDisc192.png" alt="" className={classes.mdBurnIcon} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Remove">
                                                    <IconButton size="medium" color="secondary" onClick={() => onRemoveItem?.(idx)}>
                                                        <DeleteOutline fontSize="medium" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                                        No tracks in the current playing list yet.
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
            {isFullscreen && showFact && (
                <Typography variant="body2" className={classes.fullscreenFact}>
                    MiniDisc Fact: {MD_FACTS[factIndex]}
                </Typography>
            )}
        </Box>
    );
};

export const NowPlayingDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { classes } = useStyles();
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ className: classes.dialogPaper }}>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Now Playing</span>
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <NowPlayingContent />
            </DialogContent>
        </Dialog>
    );
};

export const NowPlayingPanel = ({
    onClose,
    previewTrack,
    previewActive,
    previewPlaying,
    queue,
    currentIndex,
    onPlayItem,
    onRemoveItem,
    onAddAllToBurn,
    onAddItemToBurn,
    onSavePlaylist,
    onClearQueue,
    onOpenLabelMaker,
    onOpenArtist,
    onOpenAlbum,
    currentAudioUrl,
    previewDuration,
    onPreviewClose,
    onTrackEnded,
    onPreviewPlayStateChange,
    onPrevTrack,
    onNextTrack,
    onToggleShuffle,
    onToggleRepeat,
    shuffleEnabled,
    repeatMode,
    onMoveQueueItem,
    onReorderQueue,
}: {
    onClose?: () => void;
    previewTrack?: { title: string; artist: string; album: string; year?: string; artwork?: string } | null;
    previewActive?: boolean;
    previewPlaying?: boolean;
    queue?: NowPlayingItem[];
    currentIndex?: number;
    onPlayItem?: (index: number) => void;
    onRemoveItem?: (index: number) => void;
    onAddAllToBurn?: () => void;
    onAddItemToBurn?: (index: number) => void;
    onSavePlaylist?: () => void;
    onClearQueue?: () => void;
    onOpenLabelMaker?: () => void;
    onOpenArtist?: () => void;
    onOpenAlbum?: () => void;
    currentAudioUrl?: string | null;
    previewDuration?: number;
    onPreviewClose?: () => void;
    onTrackEnded?: () => void;
    onPreviewPlayStateChange?: (playing: boolean) => void;
    onPrevTrack?: () => void;
    onNextTrack?: () => void;
    onToggleShuffle?: () => void;
    onToggleRepeat?: () => void;
    shuffleEnabled?: boolean;
    repeatMode?: 'off' | 'one' | 'all';
    onMoveQueueItem?: (index: number, direction: 'up' | 'down') => void;
    onReorderQueue?: (fromIndex: number, toIndex: number) => void;
}) => {
    return (
        <NowPlayingContent
            onClose={onClose}
            previewTrack={previewTrack}
            previewActive={previewActive}
            previewPlaying={previewPlaying}
            queue={queue}
            currentIndex={currentIndex}
            onPlayItem={onPlayItem}
            onRemoveItem={onRemoveItem}
            onAddAllToBurn={onAddAllToBurn}
            onAddItemToBurn={onAddItemToBurn}
            onSavePlaylist={onSavePlaylist}
            onClearQueue={onClearQueue}
            onOpenLabelMaker={onOpenLabelMaker}
            onOpenArtist={onOpenArtist}
            onOpenAlbum={onOpenAlbum}
            currentAudioUrl={currentAudioUrl}
            previewDuration={previewDuration}
            onPreviewClose={onPreviewClose}
            onTrackEnded={onTrackEnded}
            onPreviewPlayStateChange={onPreviewPlayStateChange}
            onPrevTrack={onPrevTrack}
            onNextTrack={onNextTrack}
            onToggleShuffle={onToggleShuffle}
            onToggleRepeat={onToggleRepeat}
            shuffleEnabled={shuffleEnabled}
            repeatMode={repeatMode}
            onMoveQueueItem={onMoveQueueItem}
            onReorderQueue={onReorderQueue}
        />
    );
};
