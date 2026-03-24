import React, { useEffect, useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, 
    TextField, Button, Box, Typography, Switch, 
    FormControlLabel, CircularProgress, MenuItem, 
    Select, FormControl, InputLabel, InputAdornment, IconButton,
    List as MuiList, ListItemIcon, ListItemText, ListItemButton
} from '@mui/material';
import { FolderOpen, ArrowBack, Folder } from '@mui/icons-material';

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
                        {dirs.map(d => (
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

export const LibrarySettingsDialog = ({ open, onClose, onRestart }: { open: boolean, onClose: () => void, onRestart: () => void }) => {
    const [settings, setSettings] = useState({
        MUSIC_PATH: '',
        FILE_EXTENSIONS: '',
        EXCLUDE_PATTERNS: '',
        ENABLE_SCRAPING: 'true',
        VOLUME_TYPE: 'none',
        VOLUME_OPTIONS: 'bind'
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
                    setSettings({
                        MUSIC_PATH: data.MUSIC_PATH || '/music',
                        FILE_EXTENSIONS: data.FILE_EXTENSIONS || '.mp3,.flac,.wav,.m4a,.ogg',
                        EXCLUDE_PATTERNS: data.EXCLUDE_PATTERNS || '@eaDir,#recycle,.DS_Store',
                        ENABLE_SCRAPING: data.ENABLE_SCRAPING || 'true',
                        VOLUME_TYPE: data.VOLUME_TYPE || 'none',
                        VOLUME_OPTIONS: data.VOLUME_OPTIONS || 'bind'
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
            const resp = await fetch('/api/storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
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
                            onChange={(e) => setSettings({...settings, MUSIC_PATH: e.target.value})} 
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
                                    onChange={(e) => setSettings({...settings, VOLUME_TYPE: e.target.value})}
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
                                onChange={(e) => setSettings({...settings, VOLUME_OPTIONS: e.target.value})} 
                                fullWidth 
                                size="small"
                                disabled={loading || settings.VOLUME_TYPE === 'none'}
                                helperText="e.g. vers=3.0,user=guest"
                            />
                        </Box>

                        <TextField 
                            label="File Extensions" 
                            value={settings.FILE_EXTENSIONS} 
                            onChange={(e) => setSettings({...settings, FILE_EXTENSIONS: e.target.value})} 
                            fullWidth 
                            disabled={loading}
                            helperText="Comma-separated list (e.g. .mp3,.flac,.wav)"
                        />
                        <TextField 
                            label="Exclude Patterns" 
                            value={settings.EXCLUDE_PATTERNS} 
                            onChange={(e) => setSettings({...settings, EXCLUDE_PATTERNS: e.target.value})} 
                            fullWidth 
                            disabled={loading}
                            helperText="Folders or files to skip (e.g. @eaDir,#recycle)"
                        />
                        <FormControlLabel
                            control={
                                <Switch 
                                    checked={settings.ENABLE_SCRAPING === 'true'} 
                                    onChange={(e) => setSettings({...settings, ENABLE_SCRAPING: e.target.checked ? 'true' : 'false'})}
                                    disabled={loading}
                                />
                            }
                            label="Enable MusicBrainz Metadata Scraping"
                        />
                        {error && <Typography color="error" variant="body2">{error}</Typography>}
                        <Typography variant="caption" color="text.secondary">
                            Note: Saving will restart the backend service. The application will reload automatically.
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
