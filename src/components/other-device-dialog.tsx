import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useShallowEqualSelector } from '../utils';
import { actions as otherDeviceActions } from '../redux/other-device-feature';

import { makeStyles } from '@material-ui/core/styles';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Slide from '@material-ui/core/Slide';
import Button from '@material-ui/core/Button';
import { TransitionProps } from '@material-ui/core/transitions';
import { Checkbox, FormControlLabel, MenuItem, Select } from '@material-ui/core';
import { CustomParameterInfo, CustomParameters, Services, initializeParameters } from '../services/service-manager';
import { batchActions } from 'redux-batched-actions';
import { addService } from '../redux/actions';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & { children?: React.ReactElement<any, any> },
    ref: React.Ref<unknown>
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles(theme => ({
    marginUpDown: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    select: {
        minWidth: '100%',
        marginBottom: theme.spacing(2),
    },
    fullWidth: {
        minWidth: '100%',
    },
}));

export const OtherDeviceDialog = (props: {}) => {
    let dispatch = useDispatch();
    let classes = useStyles();

    const otherDeviceDialogVisible = useShallowEqualSelector(state => state.otherDeviceDialog.visible);
    const otherDeviceDialogSelectedServiceIndex = useShallowEqualSelector(state => state.otherDeviceDialog.selectedServiceIndex);
    const otherDeviceDialogCustomParameters = useShallowEqualSelector(state => state.otherDeviceDialog.customParameters);

    const customServices = Services.filter(n => n.customParameters);
    const currentService = customServices[otherDeviceDialogSelectedServiceIndex];

    const handleClose = useCallback(() => {
        dispatch(otherDeviceActions.setVisible(false));
    }, [dispatch]);

    const handleAdd = useCallback(() => {
        dispatch(otherDeviceActions.setVisible(false));
        dispatch(
            addService({
                name: currentService.name,
                parameters: otherDeviceDialogCustomParameters,
            })
        );
    }, [dispatch, otherDeviceDialogCustomParameters, currentService]);

    const [addButtonDisabled, setAddButtonDisabled] = useState(false);

    const getFieldForType = (parameter: CustomParameterInfo) => {
        switch (parameter.type) {
            case 'boolean':
                return (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={(otherDeviceDialogCustomParameters[parameter.varName] as boolean) || false}
                                onChange={e => handleParameterChange(e, parameter.type, parameter.varName)}
                            />
                        }
                        label={parameter.userFriendlyName}
                        className={classes.fullWidth}
                        key={parameter.varName}
                    />
                );
            case 'string':
                return (
                    <TextField
                        key={parameter.varName}
                        label={parameter.userFriendlyName}
                        error={
                            parameter.validator
                                ? !parameter.validator(otherDeviceDialogCustomParameters[parameter.varName] as string)
                                : false
                        }
                        value={otherDeviceDialogCustomParameters[parameter.varName] || ''}
                        onChange={e => handleParameterChange(e, parameter.type, parameter.varName)}
                        className={classes.fullWidth}
                    />
                );
            case 'number':
                return (
                    <TextField
                        label={parameter.userFriendlyName}
                        error={
                            parameter.validator
                                ? !parameter.validator(otherDeviceDialogCustomParameters[parameter.varName] as string)
                                : false
                        }
                        type="number"
                        value={otherDeviceDialogCustomParameters[parameter.varName] || 0}
                        onChange={e => handleParameterChange(e, parameter.type, parameter.varName)}
                        className={classes.fullWidth}
                        key={parameter.varName}
                    />
                );
        }
    };

    const isAllValid = useCallback(
        (parameters: CustomParameters) => {
            let allValid = true;
            for (let parameter of currentService.customParameters!) {
                if (parameter.validator) {
                    if (!parameter.validator(parameters[parameter.varName]?.toString())) {
                        allValid = false;
                        break;
                    }
                }
            }
            setAddButtonDisabled(!allValid);
        },
        [setAddButtonDisabled, currentService.customParameters]
    );

    const handleServiceSelectionChanged = useCallback(
        event => {
            dispatch(
                batchActions([
                    otherDeviceActions.setSelectedServiceIndex(event.target.value),
                    otherDeviceActions.setCustomParameters(initializeParameters(customServices[event.target.value])),
                ])
            );
        },
        [dispatch, customServices]
    );

    const handleParameterChange = useCallback(
        (event, type, varName) => {
            const newData = { ...otherDeviceDialogCustomParameters };
            newData[varName] =
                type === 'string' ? event.target.value : type === 'number' ? parseInt(event.target.value) : event.target.checked;
            dispatch(otherDeviceActions.setCustomParameters(newData));
            isAllValid(newData);
        },
        [dispatch, otherDeviceDialogCustomParameters, isAllValid]
    );

    useEffect(() => isAllValid(otherDeviceDialogCustomParameters), [otherDeviceDialogCustomParameters, isAllValid]);

    return (
        <Dialog
            open={otherDeviceDialogVisible}
            onClose={handleClose}
            maxWidth={'sm'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="rename-dialog-title"
        >
            <DialogTitle id="rename-dialog-title">Add Custom Device</DialogTitle>
            <DialogContent>
                <Select
                    onChange={handleServiceSelectionChanged}
                    value={otherDeviceDialogSelectedServiceIndex}
                    className={classes.select}
                    label="Service"
                >
                    {customServices.map((n, i) => (
                        <MenuItem value={i} key={`${i}`}>
                            {n.name}
                        </MenuItem>
                    ))}
                </Select>
                {currentService.description}
                <div className={classes.fullWidth}>{currentService.customParameters!.map(n => getFieldForType(n))}</div>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button color={'primary'} onClick={handleAdd} disabled={addButtonDisabled}>
                    Add
                </Button>
            </DialogActions>
        </Dialog>
    );
};
