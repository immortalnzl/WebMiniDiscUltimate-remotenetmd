import React, { useMemo, lazy, Suspense } from 'react';
import { belowDesktop, forAnyDesktop, forWideDesktop, useShallowEqualSelector, useThemeDetector } from '../frontend-utils';

import CssBaseline from '@mui/material/CssBaseline';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import { W95App } from './win95/app';

const Toc = lazy(() => import('./factory/factory'));
const Controls = lazy(() => import('./controls'));
const Welcome = lazy(() => import('./welcome'));
const Main = lazy(() => import('./main'));

import { MusicLibrarySidebar } from './library-sidebar';
import { DiscVisualizer } from './disc-visualizer';
import { AdaptiveFile } from '../utils';

const useStyles = makeStyles()((theme) => ({
    layout: {
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
    },
    sidebar: {
        width: '75%',
        flexShrink: 0,
        height: '100%',
        transition: 'width 0.3s ease-in-out',
        [belowDesktop(theme)]: {
            display: 'none',
        },
    },
    sidebarExpanded: {
        width: '100%',
    },
    mainContent: {
        width: '25%',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.default,
        transition: 'opacity 0.3s ease-in-out',
    },
    mainContentHidden: {
        width: 0,
        padding: 0,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
    },
    paper: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: theme.spacing(2),
        flexGrow: 1,
        overflow: 'hidden',
    },
    paperShowsList: {
        [forAnyDesktop(theme)]: {
            height: 600,
        },
        [forWideDesktop(theme)]: {
            height: 700,
        },
    },
    paperFullHeight: {
        height: 'calc(100% - 50px)',
    },
    layoutFullWidth: {
        [forAnyDesktop(theme)]: {
            width: '90%',
        },
    },
    bottomBar: {
        display: 'flex',
        alignItems: 'center',
        [belowDesktop(theme)]: {
            flexWrap: 'wrap',
        },
        marginLeft: -theme.spacing(2),
    },
    copyrightTypography: {
        textAlign: 'center',
    },
    backdrop: {
        zIndex: theme.zIndex.drawer + 1000,
        color: '#fff',
    },
    minidiscLogo: {
        width: 48,
    },
    controlsContainer: {
        flex: '0 0 auto',
        width: '100%',
        paddingRight: theme.spacing(8),
        [belowDesktop(theme)]: {
            paddingLeft: 0,
        },
    },
}));

const themeCommons = {
    components: {
        MuiSelect: {
            defaultProps: { variant: 'standard' },
        },
        MuiPaper: {
            defaultProps: { elevation: 1 },
            styleOverrides: {
                elevation24: {
                    backgroundImage: 'none !important',
                },
            },
        },
        MuiDialog: {
            defaultProps: {
                PaperProps: {
                    elevation: 0,
                },
            },
        },
        MuiMenu: {
            defaultProps: {
                PaperProps: {
                    elevation: 24,
                },
            },
        },
        MuiTextField: {
            defaultProps: { variant: 'standard' },
        },
    },
} as const;

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            light: '#6ec6ff',
            main: '#2196f3',
            dark: '#0069c0',
            contrastText: '#fff',
        },
        secondary: {
            light: '#ff4081',
            main: '#f50057',
            dark: '#c51162',
        },
        background: {
            default: '#303030',
            paper: '#424242',
        },
        action: {
            active: '#fff',
            hover: 'rgba(255, 255, 255, 0.08)',
            hoverOpacity: 0.08,
            selected: 'rgba(255, 255, 255, 0.16)',
            selectedOpacity: 0.16,
            disabled: 'rgba(255, 255, 255, 0.3)',
            disabledBackground: 'rgba(255, 255, 255, 0.12)',
            disabledOpacity: 0.38,
            focus: 'rgba(255, 255, 255, 0.12)',
            focusOpacity: 0.12,
            activatedOpacity: 0.24,
        },
    },
    ...themeCommons,
});

const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            light: '#7986cb',
            main: '#3f51b5',
            dark: '#303f9f',
            contrastText: '#fff',
        },
        secondary: {
            light: '#ff4081',
            main: '#f50057',
            dark: '#c51162',
            contrastText: '#fff',
        },
        error: {
            light: '#e57373',
            main: '#f44336',
            dark: '#d32f2f',
            contrastText: '#fff',
        },
        warning: {
            light: '#ffb74d',
            main: '#ff9800',
            dark: '#f57c00',
            contrastText: 'rgba(0, 0, 0, 0.87)',
        },
        info: {
            light: '#64b5f6',
            main: '#2196f3',
            dark: '#1976d2',
            contrastText: '#fff',
        },
        success: {
            light: '#81c784',
            main: '#4caf50',
            dark: '#388e3c',
            contrastText: 'rgba(0, 0, 0, 0.87)',
        },
        text: {
            primary: 'rgba(0, 0, 0, 0.87)',
            secondary: 'rgba(0, 0, 0, 0.54)',
            disabled: 'rgba(0, 0, 0, 0.38)',
        },
        background: {
            paper: '#fff',
            default: '#fafafa',
        },
        action: {
            active: 'rgba(0, 0, 0, 0.54)',
            hover: 'rgba(0, 0, 0, 0.04)',
            hoverOpacity: 0.04,
            selected: 'rgba(0, 0, 0, 0.08)',
            selectedOpacity: 0.08,
            disabled: 'rgba(0, 0, 0, 0.26)',
            disabledBackground: 'rgba(0, 0, 0, 0.12)',
            disabledOpacity: 0.38,
            focus: 'rgba(0, 0, 0, 0.12)',
            focusOpacity: 0.12,
            activatedOpacity: 0.12,
        },
    },
    ...themeCommons,
});

const InternalApp = () => {
    const { mainView, loading, pageFullHeight, pageFullWidth } = useShallowEqualSelector((state) => state.appState);
    const { deviceCapabilities } = useShallowEqualSelector((state) => state.main);
    const { classes, cx } = useStyles();
    const [uploadedFiles, setUploadedFiles] = React.useState<(File | AdaptiveFile)[]>([]);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);

    return (
        <React.Fragment>
            <CssBaseline />

            <Suspense
                fallback={
                    <Backdrop open={true}>
                        <CircularProgress color="info" />
                    </Backdrop>
                }
            >
                <Box className={classes.layout}>
                    {mainView === 'MAIN' && (
                        <Box className={cx(classes.sidebar, isSidebarExpanded && classes.sidebarExpanded)}>
                            <MusicLibrarySidebar 
                                setUploadedFiles={setUploadedFiles} 
                                isExpanded={isSidebarExpanded}
                                onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
                            />
                        </Box>
                    )}
                    <Box className={cx(classes.mainContent, (mainView === 'MAIN' && isSidebarExpanded) && classes.mainContentHidden)}>
                        <Paper className={classes.paper}>
                            {mainView === 'WELCOME' ? <Welcome /> : null}
                            {mainView === 'MAIN' ? (
                                <>
                                    {!isSidebarExpanded && <DiscVisualizer />}
                                    <Main uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} />
                                </>
                             ) : null}
                            {mainView === 'FACTORY' ? <Toc /> : null}

                            <Box className={classes.controlsContainer}>{mainView === 'MAIN' ? <Controls /> : null}</Box>
                        </Paper>
                        <Typography variant="body2" color="textSecondary" className={classes.copyrightTypography}>
                            {'© '}
                            <Link rel="noopener noreferrer" color="inherit" target="_blank" href="https://stefano.brilli.me/">
                                Stefano Brilli
                            </Link>
                            {', '}
                            <Link rel="noopener noreferrer" color="inherit" target="_blank" href="https://github.com/asivery/">
                                Asivery
                            </Link>{' '}
                            {new Date().getFullYear()}
                            {'.'}
                        </Typography>
                    </Box>
                </Box>
            </Suspense>

            {loading ? (
                <Backdrop className={classes.backdrop} open={loading}>
                    <CircularProgress color="info" />
                </Backdrop>
            ) : null}
        </React.Fragment>
    );
};

const App = () => {
    const { colorTheme, vintageMode } = useShallowEqualSelector((state) => state.appState);
    const systemIsDarkTheme = useThemeDetector();

    const theme = useMemo(() => {
        switch (colorTheme) {
            case 'light':
                return lightTheme;
            case 'dark':
                return darkTheme;
            case 'system':
                return systemIsDarkTheme ? darkTheme : lightTheme;
        }
    }, [systemIsDarkTheme, colorTheme]);

    if (vintageMode) {
        return <W95App />;
    }

    return (
        <ThemeProvider theme={theme}>
            <InternalApp />
        </ThemeProvider>
    );
};

export default App;
