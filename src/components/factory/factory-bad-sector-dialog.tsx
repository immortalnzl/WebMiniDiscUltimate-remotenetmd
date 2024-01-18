import React, { useCallback } from 'react';
import { useShallowEqualSelector } from "../../frontend-utils";

import { actions as factoryBadSectorDialogActions } from '../../redux/factory/factory-bad-sector-dialog-feature';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide, { SlideProps } from '@mui/material/Slide';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import { TransitionProps } from '@mui/material/transitions';
import { useDispatch } from 'react-redux';
import { BadSectorResponse, reportBadSectorReponse } from '../../redux/factory/factory-actions';

const Transition = React.forwardRef(function Transition(
    props: SlideProps,
    ref: React.Ref<unknown>
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export const FactoryModeBadSectorDialog = (props: {}) => {
    const dispatch = useDispatch();

    const { visible, address, count, remember } = useShallowEqualSelector(state => state.factoryBadSectorDialog);

    const handleReturnValue = useCallback(
        (data: BadSectorResponse) => {
            dispatch(reportBadSectorReponse(data, remember));
        },
        [dispatch, remember]
    );

    const handleRememberChoiceChange = useCallback(
        (e: any) => {
            dispatch(factoryBadSectorDialogActions.setRememberChoice(e.target.checked));
        },
        [dispatch]
    );

    return (
        <Dialog
            open={visible}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="factory-bad-sector-dialog-slide-title"
            aria-describedby="factory-bad-sector-dialog-slide-description"
        >
            <DialogTitle id="factory-bad-sector-dialog-slide-title">Bad Sector Encountered!</DialogTitle>
            <DialogContent>
                <DialogContentText id="factory-bad-sector-dialog-slide-description">
                    A bad sector was encountered on address {address} ({count} sector of this block)
                </DialogContentText>
                <Box>
                    <FormControl>
                        <FormControlLabel
                            control={<Checkbox checked={remember} onChange={handleRememberChoiceChange} />}
                            label="Remember my choice"
                        />
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => handleReturnValue('abort')}>Stop reading</Button>
                <Button onClick={() => handleReturnValue('reload')}>Reload current block</Button>
                <Button onClick={() => handleReturnValue('skip')}>Skip this sector</Button>
                <Button onClick={() => handleReturnValue('yieldanyway')}>Ignore</Button>
            </DialogActions>
        </Dialog>
    );
};
