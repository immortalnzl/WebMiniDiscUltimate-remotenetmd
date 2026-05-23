import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    FileUpload as FileUploadIcon,
    Download as DownloadIcon,
    Print as PrintIcon,
    ContentCopy as ContentCopyIcon,
    Save as SaveIcon,
    Person as PersonIcon,
} from '@mui/icons-material';
import miniDiscLogo from '../images/minidisc_logo_wiki.svg';

type LabelEntry = {
    id: string;
    sourceImage: string;
    title: string;
    artist: string;
    year: string;
    widthPx: number;
    heightPx: number;
    presetId: string;
    updatedAt: number;
};

const HISTORY_KEY = 'md_label_history_v1';
const LABEL_PRESETS = [
    { id: 'ref_580x852', label: 'Reference (580 x 852)', width: 580, height: 852 },
    { id: 'ratio_58x85mm_300dpi', label: '58 x 85 mm (300 DPI)', width: 685, height: 1004 },
    { id: 'square_60mm_300dpi', label: 'Square 60 x 60 mm (300 DPI)', width: 709, height: 709 },
    { id: 'custom', label: 'Custom', width: 580, height: 852 },
] as const;

const normalizeImageSource = (src: string): string => {
    const trimmed = (src || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
    try {
        const u = new URL(trimmed, window.location.origin);
        return u.toString();
    } catch {
        return trimmed;
    }
};

const withArtworkSizeHint = (src: string, size: number): string => {
    const normalized = normalizeImageSource(src);
    if (!normalized) return '';
    try {
        const u = new URL(normalized, window.location.origin);
        const isArtworkApi =
            u.pathname.includes('/api/get_artwork') ||
            u.pathname.includes('/api/get_artwork_cached') ||
            u.pathname.includes('/api/get_artist_art') ||
            u.pathname.endsWith('api/get_artwork') ||
            u.pathname.endsWith('api/get_artwork_cached') ||
            u.pathname.endsWith('api/get_artist_art');
        if (!isArtworkApi) return normalized;
        if (!u.searchParams.has('size')) {
            u.searchParams.set('size', `${Math.max(256, Math.min(1600, Math.round(size)))}`);
        }
        return u.toString();
    } catch {
        return normalized;
    }
};

const loadImage = (src: string, crossOrigin: 'anonymous' | undefined = undefined): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        if (crossOrigin) {
            img.crossOrigin = crossOrigin;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

const loadImageWithFallback = async (src: string): Promise<{ image: HTMLImageElement; cleanup: () => void }> => {
    const normalized = normalizeImageSource(src);
    if (!normalized) {
        throw new Error('Empty image source');
    }

    try {
        // Try CORS-friendly first (best for canvas export when remote host allows it).
        return { image: await loadImage(normalized, 'anonymous'), cleanup: () => undefined };
    } catch {
        // Retry without CORS for sources that block CORS but can still be displayed.
        try {
            return { image: await loadImage(normalized), cleanup: () => undefined };
        } catch {
            // Continue to same-origin fetch fallback.
        }
    }

    try {
        const parsed = new URL(normalized, window.location.origin);
        if (parsed.origin !== window.location.origin) {
            throw new Error('Cross-origin fetch fallback skipped');
        }
        if (normalized.startsWith('data:') || normalized.startsWith('blob:')) {
            throw new Error('Image load failed');
        }
        const response = await fetch(normalized, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Image fetch failed: ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
            const image = await loadImage(objectUrl, 'anonymous');
            return { image, cleanup: () => URL.revokeObjectURL(objectUrl) };
        } catch (err) {
            URL.revokeObjectURL(objectUrl);
            throw err;
        }
    } catch {
        return { image: await loadImage(normalized), cleanup: () => undefined };
    }
};

const makeId = () => `label_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const MDLabelMakerDialog = ({
    open,
    onClose,
    defaultArtwork,
    defaultTitle,
    defaultArtist,
    defaultYear,
    defaultTrackTitle,
}: {
    open: boolean;
    onClose: () => void;
    defaultArtwork?: string;
    defaultTitle?: string;
    defaultArtist?: string;
    defaultYear?: string;
    defaultTrackTitle?: string;
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [entryId, setEntryId] = useState<string>(makeId());
    const [sourceImage, setSourceImage] = useState<string>(defaultArtwork || '');
    const [title, setTitle] = useState(defaultTitle || '');
    const [artist, setArtist] = useState(defaultArtist || '');
    const [year, setYear] = useState(defaultYear || new Date().getFullYear().toString());
    const [widthPx, setWidthPx] = useState(580);
    const [heightPx, setHeightPx] = useState(852);
    const [presetId, setPresetId] = useState<string>('ref_580x852');
    const [history, setHistory] = useState<LabelEntry[]>([]);
    const [yearLookupAttempted, setYearLookupAttempted] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [renderNonce, setRenderNonce] = useState(0);

    useEffect(() => {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as LabelEntry[];
            if (Array.isArray(parsed)) {
                setHistory(parsed);
            }
        } catch {
            setHistory([]);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    }, [history]);

    useEffect(() => {
        if (!open) return;
        setSourceImage(normalizeImageSource(defaultArtwork || ''));
        setTitle(defaultTitle || '');
        setArtist(defaultArtist || '');
        setYear(defaultYear || '');
        setEntryId(makeId());
        setPresetId('ref_580x852');
        setWidthPx(580);
        setHeightPx(852);
        setYearLookupAttempted(false);
        setRenderNonce((v) => v + 1);
    }, [open, defaultArtwork, defaultTitle, defaultArtist, defaultYear]);

    useEffect(() => {
        const needsLookup =
            open &&
            !yearLookupAttempted &&
            !year?.trim() &&
            !!artist?.trim() &&
            (!!defaultTrackTitle?.trim() || !!title?.trim());
        if (!needsLookup) return;
        setYearLookupAttempted(true);
        const run = async () => {
            try {
                const params = new URLSearchParams({
                    artist: artist.trim(),
                    album: title.trim(),
                    title: (defaultTrackTitle || title).trim(),
                });
                const resp = await fetch(`/api/lookup_year?${params.toString()}`);
                if (!resp.ok) return;
                const json = await resp.json();
                const resolvedYear = (json?.year || '').toString().trim();
                if (resolvedYear) {
                    setYear(resolvedYear);
                }
            } catch {
                // best effort fallback
            }
        };
        run();
    }, [open, yearLookupAttempted, year, artist, title, defaultTrackTitle]);

    const combinedTitle = useMemo(() => {
        const left = title.trim() || 'Album Title';
        const mid = artist.trim() || 'Artist';
        const right = year.trim() || new Date().getFullYear().toString();
        return `${left}\n${mid}\n${right}`;
    }, [artist, title, year]);

    useEffect(() => {
        if (!open) return;
        let canceled = false;
        const render = async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            setIsRendering(true);

            const w = Math.max(300, Math.min(2200, widthPx || 580));
            const h = Math.max(400, Math.min(3200, heightPx || 852));
            canvas.width = w;
            canvas.height = h;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.fillStyle = '#16161a';
            ctx.fillRect(0, 0, w, h);

            const bottomBlock = Math.round(h * 0.17);
            const artworkH = h - bottomBlock;

            if (sourceImage) {
                let cleanup: () => void = () => {};
                try {
                    const targetImageSize = Math.max(w, h);
                    const preparedSource = withArtworkSizeHint(sourceImage, targetImageSize);
                    const loaded = await loadImageWithFallback(preparedSource);
                    const img = loaded.image;
                    cleanup = loaded.cleanup;
                    if (canceled) return;
                    const imgRatio = img.width / img.height;
                    const canvasRatio = w / artworkH;
                    let drawW = w;
                    let drawH = artworkH;
                    let dx = 0;
                    let dy = 0;
                    if (imgRatio > canvasRatio) {
                        drawW = artworkH * imgRatio;
                        dx = (w - drawW) / 2;
                    } else {
                        drawH = w / imgRatio;
                        dy = (artworkH - drawH) / 2;
                    }
                    ctx.drawImage(img, dx, dy, drawW, drawH);
                } catch {
                    ctx.fillStyle = '#2a2a2f';
                    ctx.fillRect(0, 0, w, artworkH);
                } finally {
                    cleanup();
                }
            } else {
                ctx.fillStyle = '#2a2a2f';
                ctx.fillRect(0, 0, w, artworkH);
            }

            ctx.fillStyle = '#ffffff';
            const basis = Math.min(w, h);
            const tri = Math.max(16, Math.round(basis * 0.038));
            const pad = Math.max(16, Math.round(basis * 0.045));
            const arrowTop = pad;
            ctx.beginPath();
            ctx.moveTo(pad, arrowTop + tri);
            ctx.lineTo(pad + tri, arrowTop);
            ctx.lineTo(pad + tri * 2, arrowTop + tri);
            ctx.closePath();
            ctx.fill();

            const logoBoxW = Math.max(64, Math.round(basis * 0.16));
            const logoBoxH = Math.max(54, Math.round(basis * 0.115));
            const logoX = w - logoBoxW - Math.max(12, Math.round(basis * 0.03));
            const logoY = Math.max(12, Math.round(basis * 0.03));
            const inset = Math.max(1, Math.round(basis * 0.004));
            const areaW = logoBoxW - inset * 2;
            const areaH = logoBoxH - inset * 2;
            const dx = logoX + inset;
            const dy = logoY + inset;
            try {
                const logoImg = await loadImage(miniDiscLogo);
                if (!canceled) {
                    const srcRatio = logoImg.width / logoImg.height;
                    const dstRatio = areaW / areaH;
                    let drawW = areaW;
                    let drawH = areaH;
                    if (srcRatio > dstRatio) {
                        drawH = areaW / srcRatio;
                    } else {
                        drawW = areaH * srcRatio;
                    }
                    const drawX = dx + (areaW - drawW) / 2;
                    const drawY = dy + (areaH - drawH) / 2;
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
                }
            } catch {
                // If logo load fails, continue without it.
            }

            ctx.fillStyle = '#1b1b1f';
            ctx.fillRect(0, artworkH, w, bottomBlock);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            const fontSize = Math.max(20, Math.round(bottomBlock * 0.24));
            ctx.font = `700 ${fontSize}px Arial`;
            const lines = combinedTitle.split('\n').slice(0, 3);
            const lineGap = Math.round(fontSize * 1.12);
            lines.forEach((line, idx) => {
                ctx.fillText(line, Math.round(w * 0.03), artworkH + Math.round(bottomBlock * 0.34) + idx * lineGap);
            });
            if (!canceled) {
                setIsRendering(false);
            }
        };
        render();
        return () => {
            canceled = true;
            setIsRendering(false);
        };
    }, [open, sourceImage, combinedTitle, widthPx, heightPx, renderNonce]);

    const onUploadFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
        const file = ev.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const content = typeof reader.result === 'string' ? reader.result : '';
            setSourceImage(normalizeImageSource(content));
        };
        reader.readAsDataURL(file);
    };

    const loadEntry = (entry: LabelEntry) => {
        setEntryId(entry.id);
        setSourceImage(entry.sourceImage);
        setTitle(entry.title);
        setArtist(entry.artist);
        setYear(entry.year);
        setWidthPx(entry.widthPx);
        setHeightPx(entry.heightPx);
        setPresetId(entry.presetId || 'custom');
        setYearLookupAttempted(true);
    };

    const saveEntry = () => {
        const item: LabelEntry = {
            id: entryId || makeId(),
            sourceImage,
            title,
            artist,
            year,
            widthPx,
            heightPx,
            presetId,
            updatedAt: Date.now(),
        };
        setEntryId(item.id);
        setHistory((prev) => {
            const without = prev.filter((e) => e.id !== item.id);
            return [item, ...without].sort((a, b) => b.updatedAt - a.updatedAt);
        });
    };

    const newEntry = () => {
        setEntryId(makeId());
        setSourceImage(normalizeImageSource(defaultArtwork || ''));
        setTitle(defaultTitle || '');
        setArtist(defaultArtist || '');
        setYear(defaultYear || '');
        setWidthPx(580);
        setHeightPx(852);
        setPresetId('ref_580x852');
        setYearLookupAttempted(false);
    };

    const downloadPng = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${(artist || 'artist').replace(/\s+/g, '_')}-${(title || 'album').replace(/\s+/g, '_')}-md-label.png`;
        a.click();
    };

    const printLabel = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
        if (!blob) {
            return;
        }
        const imageUrl = URL.createObjectURL(blob);
        const win = window.open('', '_blank', 'width=900,height=1200');
        if (!win) {
            URL.revokeObjectURL(imageUrl);
            return;
        }
        win.document.write(
            `<html><head><title>MD Label</title><style>html,body{margin:0;padding:0;background:#fff} body{display:flex;justify-content:center;align-items:flex-start} img{display:block;max-width:100vw;height:auto} @media print {body{margin:0} img{max-width:100%;break-inside:avoid;}}</style></head><body><img id="labelimg" src="${imageUrl}" alt="MD Label" /></body></html>`
        );
        win.document.close();
        const img = win.document.getElementById('labelimg') as HTMLImageElement | null;
        const cleanup = () => URL.revokeObjectURL(imageUrl);
        if (img) {
            const doPrint = () => {
                win.focus();
                setTimeout(() => win.print(), 50);
            };
            img.onerror = () => {
                win.focus();
                cleanup();
            };
            if (img.complete) {
                doPrint();
            } else {
                img.onload = doPrint;
            }
            win.onafterprint = () => {
                cleanup();
            };
        } else {
            cleanup();
        }
    };

    const copyToClipboard = async () => {
        const canvas = canvasRef.current;
        if (!canvas || !('clipboard' in navigator)) return;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
        if (!blob) return;
        await (navigator.clipboard as any).write([new ClipboardItem({ 'image/png': blob })]);
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>MD Label Maker</span>
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Stack spacing={1.5} sx={{ width: { xs: '100%', md: 360 } }}>
                        <Stack direction="row" spacing={1}>
                            <Button component="label" variant="outlined" startIcon={<FileUploadIcon />}>
                                Upload Artwork
                                <input hidden type="file" accept="image/*" onChange={onUploadFile} />
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<PersonIcon />}
                                disabled={!artist.trim()}
                                title={artist.trim() ? `Use artist image for "${artist.trim()}"` : 'Enter an artist name first'}
                                onClick={() => {
                                    setSourceImage(`/api/get_artist_art?artist=${encodeURIComponent(artist.trim())}&fallback_album=true`);
                                }}
                            >
                                Artist Image
                            </Button>
                            <Button variant="outlined" onClick={newEntry}>New</Button>
                        </Stack>
                        <TextField size="small" label="Artwork URL / Data URL" value={sourceImage} onChange={(e) => setSourceImage(e.target.value)} />
                        <TextField size="small" label="Album Name" value={title} onChange={(e) => setTitle(e.target.value)} />
                        <TextField size="small" label="Artist Name" value={artist} onChange={(e) => setArtist(e.target.value)} />
                        <TextField size="small" label="Release Year" value={year} onChange={(e) => setYear(e.target.value)} />
                        <TextField
                            select
                            size="small"
                            label="Label Size Preset"
                            value={presetId}
                            onChange={(e) => {
                                const next = e.target.value;
                                setPresetId(next);
                                const preset = LABEL_PRESETS.find((p) => p.id === next);
                                if (preset && preset.id !== 'custom') {
                                    setWidthPx(preset.width);
                                    setHeightPx(preset.height);
                                }
                            }}
                        >
                            {LABEL_PRESETS.map((preset) => (
                                <MenuItem key={preset.id} value={preset.id}>
                                    {preset.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                size="small"
                                type="number"
                                label="Width (px)"
                                value={widthPx}
                                onChange={(e) => {
                                    setPresetId('custom');
                                    setWidthPx(parseInt(e.target.value || '580', 10));
                                }}
                                fullWidth
                            />
                            <TextField
                                size="small"
                                type="number"
                                label="Height (px)"
                                value={heightPx}
                                onChange={(e) => {
                                    setPresetId('custom');
                                    setHeightPx(parseInt(e.target.value || '852', 10));
                                }}
                                fullWidth
                            />
                        </Stack>
                        <Button variant="contained" startIcon={<SaveIcon />} onClick={saveEntry}>
                            Save Label
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                            Saved labels appear below and can be reopened and edited.
                        </Typography>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 220, overflow: 'auto' }}>
                            <List dense disablePadding>
                                {history.map((item) => (
                                    <ListItemButton key={item.id} onClick={() => loadEntry(item)}>
                                        <ListItemText
                                            primary={`${item.title || 'Untitled'} - ${item.artist || 'Unknown Artist'}`}
                                            secondary={`${item.year || 'No year'} - ${new Date(item.updatedAt).toLocaleString()}`}
                                        />
                                    </ListItemButton>
                                ))}
                                {history.length === 0 && (
                                    <Box sx={{ p: 1.5 }}>
                                        <Typography variant="caption" color="text.secondary">No saved labels yet</Typography>
                                    </Box>
                                )}
                            </List>
                        </Box>
                    </Stack>
                    <Box sx={{ flexGrow: 1, minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }} />
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={copyToClipboard} startIcon={<ContentCopyIcon />}>Copy</Button>
                <Button onClick={downloadPng} startIcon={<DownloadIcon />}>Download PNG</Button>
                <Button onClick={printLabel} startIcon={<PrintIcon />} disabled={isRendering}>Print</Button>
            </DialogActions>
        </Dialog>
    );
};
