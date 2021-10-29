import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useShallowEqualSelector } from '../utils';

import { actions as appActions } from '../redux/app-feature';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Slide from '@material-ui/core/Slide';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import { TransitionProps } from '@material-ui/core/transitions';
import { W95ChangelogDialog } from './win95/changelog-dialog';

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
    },
    formControl: {
        minWidth: 60,
    },
    toggleButton: {
        minWidth: 40,
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'stretch',
    },
}));

export const ChangelogDialog = (props: {}) => {
    const dispatch = useDispatch();
    const classes = useStyles();

    const vintageMode = useShallowEqualSelector(state => state.appState.vintageMode);
    const visible = useShallowEqualSelector(state => state.appState.changelogDialogVisible);

    const handleClose = useCallback(() => {
        localStorage.setItem('version', (window as any).wmdVersion);
        dispatch(appActions.showChangelogDialog(false));
    }, [dispatch]);

    const content = (
        <ul>
            <li>Added the changelog dialog</li>
            <li>Added a basic self-test</li>
            <li>
                Added full support for Sony LAM-Series devices (Issue <a href="https://github.com/cybercase/webminidisc/issues/29">#29</a>,{' '}
                <a href="https://github.com/cybercase/webminidisc/issues/60">#60</a>)
            </li>
            <li>
                Overhauled the convert dialog
                <ul>
                    <li>Added the ability to rename tracks before sending them to the recorder</li>
                    <li>Added a live preview of how the tracks are going to be titled when selecting different formats</li>
                    <li>
                        Added a warning about using too many characters (Issue{' '}
                        <a href="https://github.com/cybercase/webminidisc/issues/66">#66</a>)
                    </li>
                </ul>
            </li>
        </ul>
    );

    if (vintageMode) {
        const p = {
            visible,
            handleClose,
            content,
        };
        return <W95ChangelogDialog {...p} />;
    }

    return (
        <Dialog
            open={visible}
            maxWidth={'xs'}
            fullWidth={true}
            TransitionComponent={Transition as any}
            aria-labelledby="changelog-dialog-slide-title"
            aria-describedby="changelog-dialog-slide-description"
        >
            <DialogTitle id="changelog-dialog-slide-title">Changelog for version {(window as any).wmdVersion}</DialogTitle>
            <DialogContent className={classes.dialogContent}>{content}</DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};
