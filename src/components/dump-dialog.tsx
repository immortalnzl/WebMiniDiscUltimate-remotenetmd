import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useShallowEqualSelector } from '../utils';

import { downloadTracks, recordTracks } from '../redux/actions';
import { actions as dumpDialogActions } from '../redux/dump-dialog-feature';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Slide from '@material-ui/core/Slide';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Typography from '@material-ui/core/Typography';
import FormHelperText from '@material-ui/core/FormHelperText';
import { Controls } from './controls';
import Box from '@material-ui/core/Box';
import serviceRegistry from '../services/registry';
import { TransitionProps } from '@material-ui/core/transitions';
import { W95DumpDialog } from './win95/dump-dialog';
import { Capability } from '../services/netmd';
import { exploitDownloadTracks } from '../redux/factory/factory-actions';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & { children?: React.ReactElement<any, any> },
    ref: React.Ref<unknown>
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles(theme => ({
    container: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginRight: -theme.spacing(2),
        flexFlow: 'wrap',
    },
    formControl: {
        minWidth: 120,
    },
    selectEmpty: {
        marginTop: theme.spacing(2),
    },
    head: {
        textShadow: '0px 0px 12px rgba(150, 150, 150, 1)',
        fontSize: theme.typography.h2.fontSize,
        textAlign: 'center',
        marginBottom: theme.spacing(2),
    },
    factoryModeNotice: {
        marginBottom: theme.spacing(2),
        fontWeight: 'bold',
    },
}));

export const DumpDialog = ({
    trackIndexes,
    isCapableOfDownload,
    isExploitDownload,
}: {
    trackIndexes: number[];
    isCapableOfDownload: boolean;
    isExploitDownload: boolean;
}) => {
    const dispatch = useDispatch();
    const classes = useStyles();

    const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);
    const [inputDeviceId, setInputDeviceId] = useState<string>('');

    let { visible } = useShallowEqualSelector(state => state.dumpDialog);
    let { deviceCapabilities } = useShallowEqualSelector(state => state.main);

    const handleClose = useCallback(() => {
        setInputDeviceId('');
        serviceRegistry.mediaRecorderService?.stopTestInput();
        dispatch(dumpDialogActions.setVisible(false));
    }, [dispatch]);

    const handleChange = useCallback(
        (ev: React.ChangeEvent<{ value: unknown }>) => {
            if (isCapableOfDownload) return;
            const deviceId = ev.target.value as string;
            setInputDeviceId(deviceId);
            serviceRegistry.mediaRecorderService?.stopTestInput();
            serviceRegistry.mediaRecorderService?.playTestInput(deviceId);
        },
        [setInputDeviceId, isCapableOfDownload]
    );

    const handleStartTransfer = useCallback(() => {
        if (isCapableOfDownload) {
            if (isExploitDownload) {
                dispatch(exploitDownloadTracks(trackIndexes));
            } else {
                dispatch(downloadTracks(trackIndexes));
            }
        } else {
            dispatch(recordTracks(trackIndexes, inputDeviceId));
        }
        handleClose();
    }, [trackIndexes, inputDeviceId, dispatch, handleClose, isCapableOfDownload, isExploitDownload]);

    useEffect(() => {
        async function updateDeviceList() {
            if (isCapableOfDownload) return;
            await navigator.mediaDevices.getUserMedia({ audio: true });
            let devices = await navigator.mediaDevices.enumerateDevices();
            let inputDevices = devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({ deviceId: device.deviceId, label: device.label }));
            setDevices(inputDevices);
        }
        if (visible) {
            updateDeviceList();
        }
    }, [visible, setDevices, isCapableOfDownload]);

    const vintageMode = useShallowEqualSelector(state => state.appState.vintageMode);

    if (vintageMode) {
        const p = {
            handleClose,
            handleChange,
            handleStartTransfer,
            visible,
            deviceCapabilities,
            devices,
            inputDeviceId,
            isCapableOfDownload,
        };
        return <W95DumpDialog {...p} />;
    }

    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="dump-dialog-slide-title"
            aria-describedby="dump-dialog-slide-description"
        >
            <DialogTitle id="dump-dialog-slide-title">{isCapableOfDownload ? 'Download' : 'Record'} Selected Tracks</DialogTitle>
            <DialogContent>
                <Typography component="p" variant="h2" className={classes.head}>
                    {`💻 ⬅ 💽`}
                </Typography>
                {isCapableOfDownload ? (
                    <React.Fragment>
                        {isExploitDownload ? (
                            <React.Fragment>
                                <Typography component="p" variant="body2">
                                    As you have enabled factory mode ripping in main ui, you can download tracks via USB.
                                </Typography>
                                <Typography component="p" variant="body2">
                                    Please keep in mind that this functionality is not stable.
                                </Typography>
                            </React.Fragment>
                        ) : (
                            <Typography component="p" variant="body2">
                                As you are using a Sony MZ-RH1, it is possible to transfer tracks via NetMD.
                            </Typography>
                        )}
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        {deviceCapabilities.includes(Capability.factoryMode) && (
                            <Typography component="h4" variant="body2" className={classes.factoryModeNotice}>
                                It looks like this player supports the factory mode - it might be capable of RH1-style digital transfer.
                                Please check the factory mode for more information.
                            </Typography>
                        )}

                        <Typography component="p" variant="body2">
                            1. Connect your MD Player line-out to your PC audio line-in.
                        </Typography>
                        <Typography component="p" variant="body2">
                            2. Use the controls at the bottom right to play some tracks.
                        </Typography>
                        <Typography component="p" variant="body2">
                            3. Select the input source. You should hear the tracks playing on your PC.
                        </Typography>
                        <Typography component="p" variant="body2">
                            4. Adjust the input gain and the line-out volume of your device.
                        </Typography>
                        <Box className={classes.container}>
                            <FormControl className={classes.formControl}>
                                <Select value={inputDeviceId} onChange={handleChange} displayEmpty className={classes.selectEmpty}>
                                    <MenuItem value="" disabled>
                                        Input Source
                                    </MenuItem>
                                    {devices.map(device => (
                                        <MenuItem key={device.deviceId} value={device.deviceId}>
                                            {device.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <FormHelperText>Input Source</FormHelperText>
                            </FormControl>
                            <Controls />
                        </Box>
                    </React.Fragment>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button onClick={handleStartTransfer} disabled={inputDeviceId === '' && !isCapableOfDownload}>
                    Start {isCapableOfDownload ? 'Download' : 'Record'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
