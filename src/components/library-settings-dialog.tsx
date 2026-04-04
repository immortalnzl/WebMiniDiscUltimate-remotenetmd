import React, { useEffect, useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    TextField, Button, Box, Typography, Switch, 
    FormControlLabel, CircularProgress, MenuItem, 
    Select, FormControl, InputLabel, InputAdornment, IconButton,
    List as MuiList, ListItemIcon, ListItemText, ListItemButton
} from '@mui/material';
import { FolderOpen, ArrowBack, Folder, Terminal, Refresh, History } from '@mui/icons-material';

const FolderPicker = ({ open, onClose, onSelect, initialPath }: { open: boolean, onClose: () => void, onSelect: (path: string) => void, initialPath: string }) => {
    const [currentPath, setCurrentPath] = useState(initialPath || '/');
    const [dirs, setDirs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            const path = currentPath || '/';
            fetch(`/api/list_dirs?path=${encodeURIComponent(path)}`)
                .then(r => r.json())
                .then(data => {
                    setDirs(Array.isArray(data) ? data : []);
                    setLoading(false);
                })
                .catch(() => {
                    setDirs([]);
                    setLoading(false);
                });
        }
    }, [open, currentPath]);

    const handleBack = () => {
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        setCurrentPath('/' + parts.join('/'));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Select Folder</DialogTitle>
            <DialogContent dividers sx={{ minHeight: 300 }}>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton onClick={handleBack} size="small" disabled={currentPath === '/' || currentPath === ''}>
                        <ArrowBack />
                    </IconButton>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all', fontWeight: 'bold' }}>{currentPath || '/'}</Typography>
                </Box>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
                ) : (
                    <MuiList dense>
                        {dirs.length === 0 && <Typography variant="caption" sx={{ p: 2, display: 'block' }}>No subdirectories found or access denied.</Typography>}
                        {dirs.map((d: string) => (
                            <ListItemButton key={d} onClick={() => setCurrentPath(currentPath === '/' || currentPath === '' ? `/${d}` : `${currentPath}/${d}`)}>
                                <ListItemIcon><Folder color="primary" /></ListItemIcon>
                                <ListItemText primary={d} />
                            </ListItemButton>
                        ))}
                    </MuiList>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={() => onSelect(currentPath)} variant="contained" color="primary">Select Current</Button>
            </DialogActions>
        </Dialog>
    );
};

export const LibrarySettingsDialog = ({ 
    open, onClose, onRestart, 
    scanStatus, onStartScan, onStartIncrementalScan, onRefreshMetadataArtwork
}: { 
    open: boolean, onClose: () => void, onRestart: () => void,
    scanStatus: any,
    onStartScan: () => void,
    onStartIncrementalScan: () => void,
    onRefreshMetadataArtwork: () => void
}) => {
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const logRef = React.useRef<HTMLPreElement>(null);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            const fetchLogs = async () => {
                try {
                    const resp = await fetch('/api/logs');
                    const data = await resp.json();
                    setLogs(data.logs || []);
                } catch (e) {}
            };
            fetchLogs();
            const it = setInterval(fetchLogs, 2000);
            return () => clearInterval(it);
        }
    }, [open]);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);
    const [settings, setSettings] = useState({
        MUSIC_PATH: '',
        FILE_EXTENSIONS: '',
        EXCLUDE_PATTERNS: '',
        ENABLE_SCRAPING: 'true',
        AUTO_SCAN_INTERVAL_MINUTES: '0',
        VOLUME_TYPE: 'none',
        VOLUME_OPTIONS: 'bind',
        SMB_USERNAME: '',
        SMB_PASSWORD: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            fetch('/api/storage')
                .then(r => {
                    if (!r.ok) throw new Error('Fetch failed');
                    return r.json();
                })
                .then(data => {
                    const volumeType = data.VOLUME_TYPE || 'none';
                    const volumeOptions = data.VOLUME_OPTIONS || 'bind';
                    let smbUsername = data.SMB_USERNAME || '';
                    let smbPassword = data.SMB_PASSWORD || '';
                    if (volumeType === 'cifs' && (!smbUsername || !smbPassword)) {
                        const parts = String(volumeOptions).split(',');
                        for (const p of parts) {
                            const [rawKey, ...rest] = p.split('=');
                            const key = (rawKey || '').trim().toLowerCase();
                            const value = rest.join('=').trim();
                            if (!value) continue;
                            if (key === 'username' || key === 'user') smbUsername = smbUsername || value;
                            if (key === 'password' || key === 'pass') smbPassword = smbPassword || value;
                        }
                    }
                    setSettings({
                        MUSIC_PATH: data.MUSIC_PATH || '/music',
                        FILE_EXTENSIONS: data.FILE_EXTENSIONS || '.mp3,.flac,.wav,.m4a,.ogg',
                        EXCLUDE_PATTERNS: data.EXCLUDE_PATTERNS || '@eaDir,#recycle,.DS_Store',
                        ENABLE_SCRAPING: data.ENABLE_SCRAPING || 'true',
                        AUTO_SCAN_INTERVAL_MINUTES: data.AUTO_SCAN_INTERVAL_MINUTES || '0',
                        VOLUME_TYPE: volumeType,
                        VOLUME_OPTIONS: volumeOptions,
                        SMB_USERNAME: smbUsername,
                        SMB_PASSWORD: smbPassword
                    });
                    setLoading(false);
                    setError(null);
                })
                .catch(err => {
                    setError('Failed to load settings from server');
                    setLoading(false);
                });
        }
    }, [open]);

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = { ...settings } as any;
            if (payload.VOLUME_TYPE === 'cifs') {
                const username = (payload.SMB_USERNAME || '').trim();
                const password = (payload.SMB_PASSWORD || '').trim();
                const extras = String(payload.VOLUME_OPTIONS || '')
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter((s: string) => !!s)
                    .filter((s: string) => {
                        const k = s.split('=')[0]?.trim().toLowerCase();
                        return !['username', 'user', 'password', 'pass'].includes(k);
                    });
                const authParts: string[] = [];
                if (username) authParts.push(`username=${username}`);
                if (password) authParts.push(`password=${password}`);
                payload.VOLUME_OPTIONS = [...authParts, ...extras].join(',');
            }
            const resp = await fetch('/api/storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!resp.ok) throw new Error('Save failed');
            
            // Trigger physical restart of the backend container
            await fetch('/api/restart', { method: 'POST' });
            
            onRestart();
            onClose();
        } catch (err) {
            setError('Failed to save settings. Make sure the backend is reachable.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Library Settings</DialogTitle>
            <DialogContent>
                {loading && !settings.MUSIC_PATH ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField 
                            label="Music Path" 
                            value={settings.MUSIC_PATH} 
                            onChange={(e: any) => setSettings({...settings, MUSIC_PATH: e.target.value})} 
                            fullWidth 
                            disabled={loading}
                            placeholder="/music"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={() => setPickerOpen(true)} size="small" title="Browse Server Folders">
                                            <FolderOpen />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                            helperText="Absolute path on the server (e.g. /music or //10.1.1.2/Music)"
                        />

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Volume Type</InputLabel>
                                <Select
                                    value={settings.VOLUME_TYPE}
                                    label="Volume Type"
                                    onChange={(e: any) => setSettings({...settings, VOLUME_TYPE: e.target.value})}
                                    disabled={loading}
                                >
                                    <MenuItem value="none">Bind (Local Folder)</MenuItem>
                                    <MenuItem value="cifs">SMB / CIFS</MenuItem>
                                    <MenuItem value="nfs">NFS</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField 
                                label="Mount Options" 
                                value={settings.VOLUME_OPTIONS} 
                                onChange={(e: any) => setSettings({...settings, VOLUME_OPTIONS: e.target.value})} 
                                fullWidth 
                                size="small"
                                disabled={loading || settings.VOLUME_TYPE === 'none'}
                                helperText="e.g. vers=3.0,user=guest"
                            />
                        </Box>
                        {settings.VOLUME_TYPE === 'cifs' && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                    label="SMB Username"
                                    value={settings.SMB_USERNAME}
                                    onChange={(e: any) => setSettings({ ...settings, SMB_USERNAME: e.target.value })}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                    autoComplete="username"
                                />
                                <TextField
                                    label="SMB Password"
                                    type="password"
                                    value={settings.SMB_PASSWORD}
                                    onChange={(e: any) => setSettings({ ...settings, SMB_PASSWORD: e.target.value })}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                            </Box>
                        )}

                        <TextField 
                            label="File Extensions" 
                            value={settings.FILE_EXTENSIONS} 
                            onChange={(e: any) => setSettings({...settings, FILE_EXTENSIONS: e.target.value})} 
                            fullWidth 
                            disabled={loading}
                            helperText="Comma-separated list (e.g. .mp3,.flac,.wav)"
                        />
                        <TextField 
                            label="Exclude Patterns" 
                            value={settings.EXCLUDE_PATTERNS} 
                            onChange={(e: any) => setSettings({...settings, EXCLUDE_PATTERNS: e.target.value})} 
                            fullWidth 
                            disabled={loading}
                            helperText="Folders or files to skip (e.g. @eaDir,#recycle)"
                        />
                        <FormControlLabel
                            control={
                                <Switch 
                                    checked={settings.ENABLE_SCRAPING === 'true'} 
                                    onChange={(e: any) => setSettings({...settings, ENABLE_SCRAPING: e.target.checked ? 'true' : 'false'})}
                                    disabled={loading}
                                />
                            }
                            label="Enable MusicBrainz Metadata Scraping"
                        />
                        <TextField
                            label="Scheduled Incremental Scan Interval (minutes)"
                            type="number"
                            value={settings.AUTO_SCAN_INTERVAL_MINUTES}
                            onChange={(e: any) => setSettings({ ...settings, AUTO_SCAN_INTERVAL_MINUTES: e.target.value })}
                            fullWidth
                            disabled={loading}
                            helperText="0 disables schedule. Example: 30 scans for new files every 30 minutes."
                            inputProps={{ min: 0, step: 1 }}
                        />
                        
                        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Library Maintenance</Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<Refresh className={scanStatus?.scanning ? "rotating" : ""} />}
                                        onClick={onStartIncrementalScan}
                                        disabled={scanStatus?.scanning}
                                    >
                                        {scanStatus?.scanning ? "Scanning..." : "Scan New Files"}
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={onRefreshMetadataArtwork}
                                        disabled={scanStatus?.scanning}
                                    >
                                        Update Metadata / Artwork
                                    </Button>
                                    <Button 
                                        size="small" 
                                        variant="outlined" 
                                        onClick={onStartScan}
                                        disabled={scanStatus?.scanning}
                                    >
                                        Full Rescan
                                    </Button>
                                </Box>
                            </Box>
                            
                            <Box sx={{ 
                                backgroundColor: '#1e1e1e', 
                                color: '#d4d4d4', 
                                fontFamily: 'monospace', 
                                fontSize: '0.75rem',
                                p: 1,
                                height: 200,
                                overflow: 'auto',
                                borderRadius: 1,
                                border: '1px solid #333'
                            }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} ref={logRef}>
                                    {(logs && logs.length > 0) ? logs.join('\n') : "No logs available. Start a scan to see activity."}
                                </pre>
                            </Box>
                        </Box>

                        {error && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{error}</Typography>}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Note: Saving settings will restart the backend service.
                        </Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={loading}>
                    Save & Restart
                </Button>
            </DialogActions>
        </Dialog>

        <FolderPicker 
            open={pickerOpen} 
            onClose={() => setPickerOpen(false)} 
            initialPath={settings.MUSIC_PATH}
            onSelect={(path) => {
                setSettings({...settings, MUSIC_PATH: path});
                setPickerOpen(false);
            }}
        />
        </>
    );
};
