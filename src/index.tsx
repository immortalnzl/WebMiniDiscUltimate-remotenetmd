import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import serviceRegistry from './services/registry';

import { store } from './redux/store';
import { actions as appActions } from './redux/app-feature';
import { actions as mainActions } from './redux/main-feature';
import { AudioServices } from './services/audio-export-service-manager';
import { LibraryServices } from './services/library-services';

import App from './components/app';

import { MediaRecorderService } from './services/browserintegration/mediarecorder';
import { BrowserMediaSessionService } from './services/browserintegration/media-session';
import { listContent } from './redux/actions';
import { sleep } from './utils';
import { SettingsResetErrorBoundary } from './components/settings-reset-error-boundary';
serviceRegistry.mediaRecorderService = new MediaRecorderService();
serviceRegistry.mediaSessionService = new BrowserMediaSessionService(store);
const initialLibraryService = store.getState().appState.libraryService;
if (initialLibraryService !== -1) {
    serviceRegistry.libraryService = new LibraryServices[initialLibraryService].create(
        store.getState().appState.libraryServiceConfig
    );
}
serviceRegistry.audioExportService = new AudioServices[store.getState().appState.audioExportService].create(
    store.getState().appState.audioExportServiceConfig
);
serviceRegistry.audioExportService?.init?.();

Object.defineProperty(window, 'wmdVersion', {
    value: '1.5.4',
    writable: false,
});

const originalApplicationTitle = document.title;

if (localStorage.getItem('version') !== (window as any).wmdVersion) {
    store.dispatch(appActions.showChangelogDialog(true));
}

const BUILD_STAMP_KEY = 'wmd_build_stamp';
const CACHE_RESET_GUARD_KEY = 'wmd_cache_reset_once';

async function forceRefreshOnNewBuild() {
    const current = (window as any).wmdVersion as string;
    const previous = localStorage.getItem(BUILD_STAMP_KEY);
    const alreadyReset = sessionStorage.getItem(CACHE_RESET_GUARD_KEY) === current;

    if (previous === current || alreadyReset) {
        localStorage.setItem(BUILD_STAMP_KEY, current);
        return;
    }

    localStorage.setItem(BUILD_STAMP_KEY, current);
    sessionStorage.setItem(CACHE_RESET_GUARD_KEY, current);

    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((r) => r.unregister()));
        }
    } catch {
        // best effort
    }

    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
        }
    } catch {
        // best effort
    }

    const next = new URL(window.location.href);
    next.searchParams.set('v', current);
    window.location.replace(next.toString());
}

(function setupEventHandlers() {
    window.addEventListener('beforeunload', ev => {
        const state = store.getState();
        const isUploading = state.uploadDialog.visible;
        const isDownloading = state.factoryProgressDialog.visible || state.recordDialog.visible;
        if (!(isUploading || isDownloading)) {
            return;
        }
        ev.preventDefault();
        ev.returnValue = `Warning! Recording will be interrupted`;
    });

    if (navigator && navigator.usb) {
        navigator.usb.ondisconnect = function(event) {
            if(serviceRegistry.netmdService?.isDeviceConnected(event.device)){
                store.dispatch(appActions.setMainView('WELCOME'));
                document.title = originalApplicationTitle;
            } else {
                console.log("The device disconnected isn't connected to this webapp");
            }
        };
    } else {
        store.dispatch(appActions.setBrowserSupported(false));
        store.dispatch(appActions.setRunningChrome(false));
    }

    Object.defineProperty(window, 'reload', {
        value: window.native?.reload ?? window.location.reload.bind(window.location),
        writable: false,
        configurable: false
    });

    if (!('Notification' in window) || Notification.permission === 'denied') {
        store.dispatch(appActions.setNotificationSupport(false));
        store.dispatch(appActions.setNotifyWhenFinished(false));
    }

    let deferredPrompt: any;
    window.addEventListener('beforeinstallprompt', (e: any) => {
        e.preventDefault();
        deferredPrompt = e;
    });
})();

forceRefreshOnNewBuild();

(function statusMonitorManager() {
    // Polls the device for its state while playing tracks
    let exceptionOccurred: boolean = false;

    function shouldMonitorBeRunning(state: ReturnType<typeof store.getState>): boolean {
        return (
            !exceptionOccurred &&
            // App ready
            state.appState.mainView === 'MAIN' &&
            state.appState.loading === false &&
            // Disc playing
            // (state.main.deviceStatus?.state === 'playing' || state.main.disc === null) &&
            // No operational dialogs running
            state.convertDialog.visible === false &&
            state.uploadDialog.visible === false &&
            state.recordDialog.visible === false &&
            state.panicDialog.visible === false &&
            state.errorDialog.visible === false &&
            state.dumpDialog.visible === false &&
            state.songRecognitionProgressDialog.visible === false &&
            state.factoryProgressDialog.visible === false
        );
    }

    async function monitor() {
        const state = store.getState();
        if (shouldMonitorBeRunning(state)) {
            try {
                await sleep(250);
                let deviceStatus = await serviceRegistry.netmdService?.getDeviceStatus();
                if (!deviceStatus) {
                    setTimeout(monitor, 5000);
                    return;
                }
                if (!deviceStatus.discPresent && state.main.disc !== null) store.dispatch(mainActions.setDisc(null));
                if (deviceStatus.discPresent && state.main.disc === null) await listContent(true)(store.dispatch);
                if (JSON.stringify(deviceStatus) !== JSON.stringify(state.main.deviceStatus)) {
                    store.dispatch(mainActions.setDeviceStatus(deviceStatus));
                }
                const currentFlushability = store.getState().main.flushable;
                const serviceFlushability = deviceStatus.canBeFlushed;
                if (typeof serviceFlushability === 'boolean' && currentFlushability !== serviceFlushability) {
                    store.dispatch(mainActions.setFlushable(serviceFlushability));
                }
                // Since this function doesn't execute if there's any operational dialog on screen
                // (including the track upload dialog), this won't conflict with anything.
                if(document.title !== originalApplicationTitle) {
                    document.title = originalApplicationTitle;
                }
                await sleep(250);
            } catch (e) {
                console.error(e);
                exceptionOccurred = true; // Stop monitor on exception
            }
        }
        setTimeout(monitor, 500);
    }
    monitor();
})();

const root = createRoot(document.getElementById('root')!);
root.render(
    <Provider store={store}>
        <SettingsResetErrorBoundary>
            <App />
        </SettingsResetErrorBoundary>
    </Provider>
);

