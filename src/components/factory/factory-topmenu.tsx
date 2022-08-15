import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Divider from '@material-ui/core/Divider';
import MoreVertIcon from '@material-ui/icons/MoreVert';

import {
    downloadRam,
    downloadRom,
    downloadToc,
    uploadToc,
    readToc,
    runTetris,
} from '../../redux/factory/factory-actions';
import { actions as appActions } from '../../redux/app-feature';
import { actions as factoryEditOtherValuesDialogActions } from '../../redux/factory/factory-edit-other-values-dialog-feature';
import { useShallowEqualSelector } from '../../utils';
import Link from '@material-ui/core/Link';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import { makeStyles } from '@material-ui/core/styles';

import RefreshIcon from '@material-ui/icons/Refresh';
import GitHubIcon from '@material-ui/icons/GitHub';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import InfoIcon from '@material-ui/icons/Info';
import ToggleOffIcon from '@material-ui/icons/ToggleOff';
import ToggleOnIcon from '@material-ui/icons/ToggleOn';
import HelpIcon from '@material-ui/icons/Help';
import MemoryIcon from '@material-ui/icons/Memory';
import CodeIcon from '@material-ui/icons/Code';
import GetAppIcon from '@material-ui/icons/GetApp';
import PublishIcon from '@material-ui/icons/Publish';
import GamesIcon from '@material-ui/icons/Games';

import { ExploitCapability } from '../../services/netmd';

const useStyles = makeStyles(theme => ({
    listItemIcon: {
        minWidth: theme.spacing(5),
    },
    toolTippedText: {
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
    },
}));

export const FactoryTopMenu = function(props: { onClick?: () => void }) {
    const classes = useStyles();
    const dispatch = useDispatch();

    let { darkMode } = useShallowEqualSelector(
        state => state.appState
    );
    const exploitCapabilities = useShallowEqualSelector(state => state.factory.exploitCapabilities ?? []);

    const githubLinkRef = React.useRef<null | HTMLAnchorElement>(null);
    const helpLinkRef = React.useRef<null | HTMLAnchorElement>(null);
    const hiddenFileInputRef = React.useRef<null | HTMLInputElement>(null);
    const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
    const menuOpen = Boolean(menuAnchorEl);

    const handleMenuOpen = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            setMenuAnchorEl(event.currentTarget);
        },
        [setMenuAnchorEl]
    );

    const handleDarkMode = useCallback(() => {
        dispatch(appActions.setDarkMode(!darkMode));
    }, [dispatch, darkMode]);

    const handleMenuClose = useCallback(() => {
        setMenuAnchorEl(null);
    }, [setMenuAnchorEl]);

    const handleExit = useCallback(() => {
        dispatch(appActions.setMainView('WELCOME'));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleShowAbout = useCallback(() => {
        dispatch(appActions.showAboutDialog(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleShowChangelog = useCallback(() => {
        dispatch(appActions.showChangelogDialog(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleTOCUpload = useCallback(
        (event: any) => {
            const file = event.target.files[0];
            dispatch(uploadToc(file));
        },
        [dispatch]
    );

    const handleGithubLink = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            if (event.target !== githubLinkRef.current) {
                // Prevent opening the link twice
                githubLinkRef.current?.click();
            }
            handleMenuClose();
        },
        [handleMenuClose]
    );

    const handleHelpLink = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            if (event.target !== helpLinkRef.current) {
                // Prevent opening the link twice
                helpLinkRef.current?.click();
            }
            handleMenuClose();
        },
        [handleMenuClose]
    );

    const handleFactoryRefresh = useCallback(() => {
        dispatch(readToc());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleEditOtherToCValues = useCallback(() => {
        dispatch(factoryEditOtherValuesDialogActions.setVisible(true));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleReadRAM = useCallback(() => {
        dispatch(downloadRam());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleReadFirmware = useCallback(() => {
        dispatch(downloadRom());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleDownloadTOC = useCallback(() => {
        dispatch(downloadToc());
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const handleUploadTOC = useCallback(() => {
        hiddenFileInputRef.current?.click();
        handleMenuClose();
    }, [hiddenFileInputRef, handleMenuClose]);

    const handlePlayTetris = useCallback(() => {
        dispatch(runTetris());
        dispatch(appActions.setMainView('WELCOME'));
        handleMenuClose();
    }, [dispatch, handleMenuClose]);

    const menuItems = [];
    menuItems.push(
        <MenuItem key="update" onClick={handleFactoryRefresh}>
            <ListItemIcon className={classes.listItemIcon}>
                <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Reload TOC</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="editOtherTOC" onClick={handleEditOtherToCValues}>
            <ListItemIcon className={classes.listItemIcon}>
                <MemoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Other ToC values</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="readRAM" onClick={handleReadRAM}>
            <ListItemIcon className={classes.listItemIcon}>
                <MemoryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Read RAM</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="readROM" onClick={handleReadFirmware}>
            <ListItemIcon className={classes.listItemIcon}>
                <CodeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Read Firmware</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="downloadTOC" onClick={handleDownloadTOC}>
            <ListItemIcon className={classes.listItemIcon}>
                <GetAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download TOC</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="uploadTOC" onClick={handleUploadTOC} disabled={!exploitCapabilities.includes(ExploitCapability.flushUTOC)}>
            <ListItemIcon className={classes.listItemIcon}>
                <PublishIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Upload TOC</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="playTetris" onClick={handlePlayTetris} disabled={!exploitCapabilities.includes(ExploitCapability.runTetris)}>
            <ListItemIcon className={classes.listItemIcon}>
                <GamesIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Play TETRIS!</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="exit" onClick={handleExit}>
            <ListItemIcon className={classes.listItemIcon}>
                <ExitToAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Exit</ListItemText>
        </MenuItem>
    );
    menuItems.push(<Divider key="action-divider" />);
    menuItems.push(
        <MenuItem key="darkMode" onClick={handleDarkMode}>
            <ListItemIcon className={classes.listItemIcon}>
                {/* <Switch name="darkModeSwitch" inputProps={{ 'aria-label': 'Dark Mode switch' }} size="small" /> */}
                {darkMode ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>Dark Mode</ListItemText>
        </MenuItem>
    );

    menuItems.push(
        <MenuItem key="about" onClick={handleShowAbout}>
            <ListItemIcon className={classes.listItemIcon}>
                <InfoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>About</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="changelog" onClick={handleShowChangelog}>
            <ListItemIcon className={classes.listItemIcon}>
                <InfoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Changelog</ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="support" onClick={handleHelpLink}>
            <ListItemIcon className={classes.listItemIcon}>
                <HelpIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
                <Link
                    rel="noopener noreferrer"
                    href="https://github.com/cybercase/webminidisc/wiki/Support-and-FAQ"
                    target="_blank"
                    ref={helpLinkRef}
                    onClick={handleHelpLink}
                >
                    Support and FAQ
                </Link>
            </ListItemText>
        </MenuItem>
    );
    menuItems.push(
        <MenuItem key="github" onClick={handleGithubLink}>
            <ListItemIcon className={classes.listItemIcon}>
                <GitHubIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
                <Link
                    rel="noopener noreferrer"
                    href="https://github.com/asivery/webminidisc"
                    target="_blank"
                    ref={githubLinkRef}
                    onClick={handleGithubLink}
                >
                    Fork me on GitHub
                </Link>
            </ListItemText>
        </MenuItem>
    );

    return (
        <React.Fragment>
            <IconButton aria-label="actions" aria-controls="actions-menu" aria-haspopup="true" onClick={handleMenuOpen}>
                <MoreVertIcon />
            </IconButton>
            <Menu id="actions-menu" anchorEl={menuAnchorEl} keepMounted open={menuOpen} onClose={handleMenuClose}>
                {menuItems}
            </Menu>
            <input type="file" ref={hiddenFileInputRef} style={{ display: 'none' }} onChange={handleTOCUpload} />
        </React.Fragment>
    );
};
