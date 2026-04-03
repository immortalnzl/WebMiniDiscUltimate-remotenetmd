import React, { useCallback } from 'react';
import { useDispatch, useShallowEqualSelector } from '../frontend-utils';
import { actions as convertDialogActions } from '../redux/convert-dialog-feature';
import {
    Box,
    FormControl,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    Select,
    MenuItem,
    Input,
    Paper,
    Button,
    Stack,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import serviceRegistry from '../services/registry';
import { getCodecFromIndex } from '../services/interfaces/netmd';

const useStyles = makeStyles()((theme) => ({
    container: {
        padding: theme.spacing(1.5),
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
    },
    title: {
        marginBottom: theme.spacing(1.5),
        fontWeight: 600,
        fontSize: '1rem',
    },
    section: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: theme.spacing(2),
        marginBottom: theme.spacing(1.5),
        alignItems: 'flex-start',
    },
    leftBlock: {
        display: 'flex',
        flexDirection: 'column',
    },
    rightBlock: {
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
    },
    formControl: {
        marginBottom: theme.spacing(1),
    },
    label: {
        display: 'block',
        marginBottom: theme.spacing(0.75),
        fontSize: '0.85rem',
        fontWeight: 500,
    },
    toggleGroup: {
        marginTop: theme.spacing(0.5),
        display: 'flex',
        gap: '2px',
        '& .MuiToggleButton-root': {
            flex: 1,
            fontSize: '0.85rem',
            padding: theme.spacing(0.75, 1),
        },
    },
    statsRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: theme.spacing(1),
        marginTop: theme.spacing(1),
        paddingTop: theme.spacing(1),
        borderTop: `1px solid ${theme.palette.divider}`,
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        fontSize: '0.7rem',
        opacity: 0.6,
        textTransform: 'uppercase',
    },
    statValue: {
        fontWeight: 600,
        fontSize: '0.95rem',
        marginTop: theme.spacing(0.25),
    },
    warningText: {
        marginTop: theme.spacing(1),
        padding: theme.spacing(1),
        backgroundColor: theme.palette.warning.light,
        color: theme.palette.warning.dark,
        borderRadius: theme.shape.borderRadius,
        fontSize: '0.875rem',
    },
    actions: {
        marginTop: theme.spacing(1),
        display: 'flex',
        gap: theme.spacing(1),
        justifyContent: 'flex-end',
    },
}));

interface UploadSettingsPanelProps {
    uploadedFiles?: any[];
}

export const UploadSettingsPanel: React.FC<UploadSettingsPanelProps> = ({ uploadedFiles = [] }) => {
    const { classes } = useStyles();
    const dispatch = useDispatch();

    const { format, titleFormat } = useShallowEqualSelector((state) => state.convertDialog);
    const minidiscSpec = serviceRegistry.netmdSpec;

    const currentlySelectedCodecIndex = React.useMemo(() => {
        if (!minidiscSpec) return [0, 0] as [number, number];
        return format[minidiscSpec.specName] ?? minidiscSpec.defaultFormat;
    }, [format, minidiscSpec]);

    const currentlySelectedCodec = React.useMemo(() => {
        if (!minidiscSpec) return { codec: 'SPS', bitrate: 292 };
        return getCodecFromIndex(minidiscSpec, currentlySelectedCodecIndex);
    }, [currentlySelectedCodecIndex, minidiscSpec]);

    const currentlySelectedCodecFamily = React.useMemo(() => {
        if (!minidiscSpec) return { codec: 'SPS', availableBitrates: [292], defaultBitrate: 292 } as any;
        return minidiscSpec.availableFormats[currentlySelectedCodecIndex[0]];
    }, [currentlySelectedCodecIndex, minidiscSpec]);

    const handleChangeFormat = useCallback(
        (_ev: React.SyntheticEvent, newFormatIndex?: number) => {
            if (newFormatIndex === undefined || !minidiscSpec) return;
            const defaultBitrateIndex = minidiscSpec.availableFormats[newFormatIndex].availableBitrates.indexOf(
                minidiscSpec.availableFormats[newFormatIndex].defaultBitrate
            );
            dispatch(
                convertDialogActions.updateFormatForSpec({
                    spec: minidiscSpec.specName,
                    codec: [newFormatIndex, defaultBitrateIndex] as [number, number],
                })
            );
        },
        [dispatch, minidiscSpec]
    );

    const handleChangeBitrate = useCallback(
        (ev: any) => {
            if (!minidiscSpec) return;
            dispatch(
                convertDialogActions.updateFormatForSpec({
                    spec: minidiscSpec.specName,
                    codec: [currentlySelectedCodecIndex[0], currentlySelectedCodecFamily.availableBitrates.indexOf(ev.target.value)],
                })
            );
        },
        [dispatch, currentlySelectedCodecIndex, minidiscSpec, currentlySelectedCodecFamily]
    );

    const handleChangeTitleFormat = useCallback(
        (event: any) => {
            dispatch(convertDialogActions.setTitleFormat(event.target.value));
        },
        [dispatch]
    );

    const handleStartConversion = useCallback(() => {
        dispatch(convertDialogActions.setVisible(true));
    }, [dispatch]);

    if (!uploadedFiles.length) {
        return null;
    }

    return (
        <Paper className={classes.container}>
            <Typography variant="h6" className={classes.title}>
                Upload Settings
            </Typography>

            <Box className={classes.section}>
                <FormControl className={classes.leftBlock}>
                    <Typography variant="caption" color="textSecondary" className={classes.label}>
                        Recording Mode
                    </Typography>
                    <ToggleButtonGroup
                        value={currentlySelectedCodecIndex[0]}
                        exclusive
                        onChange={handleChangeFormat}
                        size="small"
                        className={classes.toggleGroup}
                    >
                        {minidiscSpec?.availableFormats.map((e, idx) => (
                            <ToggleButton key={`format-${idx}`} value={idx}>
                                {e.userFriendlyName ?? e.codec}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </FormControl>

                <Box className={classes.rightBlock}>
                    <FormControl className={classes.formControl}>
                        <Typography variant="caption" color="textSecondary" className={classes.label}>
                            Track title
                        </Typography>
                        <Select
                            value={titleFormat}
                            color="secondary"
                            input={<Input />}
                            size="small"
                        >
                            <MenuItem value="filename">Filename</MenuItem>
                            <MenuItem value="title">Title</MenuItem>
                            <MenuItem value="album-title">Album - Title</MenuItem>
                            <MenuItem value="artist-title">Artist - Title</MenuItem>
                            <MenuItem value="title-artist">Title - Artist</MenuItem>
                            <MenuItem value="artist-album-title">Artist - Album - Title</MenuItem>
                        </Select>
                    </FormControl>

                    {(currentlySelectedCodecFamily?.availableBitrates.length ?? 0) > 1 && (
                        <FormControl className={classes.formControl}>
                            <Typography variant="caption" color="textSecondary" className={classes.label}>
                                Bitrate
                            </Typography>
                            <Select
                                value={currentlySelectedCodec.bitrate}
                                color="secondary"
                                input={<Input />}
                                size="small"
                            >
                                {minidiscSpec?.availableFormats
                                    .find((e) => e.codec === currentlySelectedCodec.codec)
                                    ?.availableBitrates?.map((e) => (
                                        <MenuItem value={e} key={`bitrate-${e}`}>
                                            {e} Kbps
                                        </MenuItem>
                                    ))}
                            </Select>
                        </FormControl>
                    )}
                </Box>
            </Box>

            <Box className={classes.statsRow}>
                <Box className={classes.statItem}>
                    <Typography className={classes.statLabel}>Total</Typography>
                    <Typography className={classes.statValue}>{uploadedFiles.length} tracks</Typography>
                </Box>
                <Box className={classes.statItem}>
                    <Typography className={classes.statLabel}>Format</Typography>
                    <Typography className={classes.statValue}>{currentlySelectedCodec.codec}</Typography>
                </Box>
                <Box className={classes.statItem}>
                    <Typography className={classes.statLabel}>Bitrate</Typography>
                    <Typography className={classes.statValue}>{currentlySelectedCodec.bitrate} kbps</Typography>
                </Box>
            </Box>

            <Box className={classes.actions}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleStartConversion}
                >
                    Convert & Upload
                </Button>
            </Box>
        </Paper>
    );
};
