import { actions as factoryProgressDialogActions } from './factory-progress-dialog-feature';
import { actions as factoryActions } from '../factory/factory-feature';
import { batchActions } from 'redux-batched-actions';
import { AppDispatch, RootState } from '../store';
import { actions as appStateActions } from '../app-feature';
import serviceRegistry from '../../services/registry';
import { getTracks } from 'netmd-js';
import {
    createDownloadTrackName,
    downloadBlob,
} from '../../utils';
import { concatUint8Arrays } from 'netmd-js/dist/utils';
import { NetMDFactoryService, ExploitCapability } from '../../services/netmd';
import { parseTOC, getTitleByTrackNumber, reconstructTOC } from 'netmd-tocmanip';

async function loadFactoryMode() {
    if (serviceRegistry.netmdFactoryService === undefined) {
        serviceRegistry.netmdFactoryService = (await serviceRegistry.netmdService!.factory()) as NetMDFactoryService;
    }
}

export function readToc() {
    return async function(dispatch: AppDispatch) {
        await loadFactoryMode();
        dispatch(appStateActions.setLoading(true));
        let newToc = parseTOC(
            await serviceRegistry.netmdFactoryService!.readUTOCSector(0),
            await serviceRegistry.netmdFactoryService!.readUTOCSector(1),
            await serviceRegistry.netmdFactoryService!.readUTOCSector(2)
        );
        const firmwareVersion = await serviceRegistry.netmdFactoryService!.getDeviceFirmware();
        const capabilities = await serviceRegistry.netmdFactoryService!.getExploitCapabilities();
        dispatch(
            batchActions([
                factoryActions.setToc(newToc),
                factoryActions.setExploitCapabilities(capabilities),
                factoryActions.setFirmwareVersion(firmwareVersion),
                factoryActions.setModified(false),
                appStateActions.setLoading(false),
            ])
        );
    };
}

export function editFragmentMode(index: number, mode: number) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const toc = JSON.parse(JSON.stringify(getState().factory.toc));
        if (toc.trackFragmentList[index].mode !== mode) {
            dispatch(factoryActions.setModified(true));
        }
        toc.trackFragmentList[index].mode = mode;
        dispatch(factoryActions.setToc(toc));
    };
}

export function writeModifiedTOC() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(appStateActions.setLoading(true));
        const toc = getState().factory.toc!;
        const sectors = reconstructTOC(toc);
        for (let i = 0; i < 3; i++) {
            await serviceRegistry.netmdFactoryService!.writeUTOCSector(i, sectors[i]!);
        }
        await serviceRegistry.netmdFactoryService!.flushUTOCCacheToDisc();
        dispatch(batchActions([appStateActions.setLoading(false), factoryActions.setModified(false)]));
    };
}

export function runTetris() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        await serviceRegistry.netmdFactoryService!.runTetris();
    };
}

export function downloadRam() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        const firmwareVersion = getState().factory.firmwareVersion;
        dispatch(
            batchActions([
                factoryProgressDialogActions.setDetails({
                    name: 'Transferring RAM',
                    units: 'bytes',
                }),
                factoryProgressDialogActions.setProgress({
                    current: 0,
                    total: 0,
                    additionalInfo: '',
                }),
                factoryProgressDialogActions.setVisible(true),
            ])
        );
        const ramData = await serviceRegistry.netmdFactoryService!.readRAM(
            ({ readBytes, totalBytes }: { readBytes: number; totalBytes: number }) => {
                dispatch(
                    factoryProgressDialogActions.setProgress({
                        current: readBytes,
                        total: totalBytes,
                    })
                );
            }
        );

        const fileName = `ram_${getState().main.deviceName}_${firmwareVersion}.bin`;
        downloadBlob(new Blob([ramData]), fileName);
        dispatch(factoryProgressDialogActions.setVisible(false));
    };
}

export function downloadRom() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(
            batchActions([
                factoryProgressDialogActions.setDetails({
                    name: 'Transferring Firmware',
                    units: 'bytes',
                }),
                factoryProgressDialogActions.setVisible(true),
            ])
        );
        const firmwareData = await serviceRegistry.netmdFactoryService!.readFirmware(
            ({ type, readBytes, totalBytes }: { type: 'RAM' | 'ROM'; readBytes: number; totalBytes: number }) => {
                if (readBytes % 0x200 === 0)
                    dispatch(
                        factoryProgressDialogActions.setProgress({
                            current: readBytes,
                            total: totalBytes,
                            additionalInfo: type,
                        })
                    );
            }
        );
        const firmwareVersion = getState().factory.firmwareVersion;
        const fileName = `firmware_${getState().main.deviceName}_${firmwareVersion}.bin`;
        downloadBlob(new Blob([firmwareData]), fileName);
        dispatch(factoryProgressDialogActions.setVisible(false));
    };
}

export function downloadToc() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(
            batchActions([
                factoryProgressDialogActions.setDetails({
                    name: 'Transferring TOC',
                    units: 'sectors',
                }),
                factoryProgressDialogActions.setProgress({
                    total: 6,
                    current: 0,
                }),
                factoryProgressDialogActions.setVisible(true),
            ])
        );
        let readSlices: Uint8Array[] = [];
        for (let i = 0; i < 6; i += 1) {
            dispatch(factoryProgressDialogActions.setProgress({ current: i + 1, total: 6 }));
            readSlices.push(await serviceRegistry.netmdFactoryService!.readUTOCSector(i));
        }
        const fileName = `toc_${getTitleByTrackNumber(getState().factory.toc!, 0 /* Disc */)}.bin`;
        downloadBlob(new Blob([concatUint8Arrays(...readSlices)]), fileName);
        dispatch(factoryProgressDialogActions.setVisible(false));
    };
}

export function uploadToc(file: File) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        if (file.size !== 2352 * 6) {
            window.alert('Not a valid TOC file');
            return;
        }
        dispatch(appStateActions.setLoading(true));

        const data = new Uint8Array(await file.arrayBuffer());

        for (let i = 0; i < 6; i++) {
            let sectorStart = i * 2352;
            await serviceRegistry.netmdFactoryService!.writeUTOCSector(i, data.slice(sectorStart, sectorStart + 2352));
        }
        await serviceRegistry.netmdFactoryService!.flushUTOCCacheToDisc();
        readToc()(dispatch);
    };
}

export function exploitDownloadTracks(trackIndexes: number[]) {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        // Verify if there even exists a track of that number
        const disc = getState().main.disc!;
        const tracks = getTracks(disc);
        try {
            await serviceRegistry.netmdService!.stop();
        } catch (ex) {
            /* Ignore */
        }

        dispatch(factoryProgressDialogActions.setVisible(true));
        for (let trackIndex of trackIndexes) {
            if (trackIndex >= disc.trackCount) {
                window.alert("This track does not exist. Make sure you've read the instructions on how to use the factory mode.");
                return;
            }
            const track = tracks.find(n => n.index === trackIndex)!;
            dispatch(
                batchActions([
                    factoryProgressDialogActions.setDetails({
                        name: `Transferring track ${trackIndex + 1}`,
                        units: 'sectors',
                    }),
                    factoryProgressDialogActions.setProgress({
                        current: -1,
                        total: 0,
                        additionalInfo: 'Rewriting firmware...',
                    }),
                ])
            );

            const trackData = await serviceRegistry.netmdFactoryService!.exploitDownloadTrack(
                trackIndex,
                ({
                    totalSectors,
                    sectorsRead,
                    action,
                    sector,
                }: {
                    sectorsRead: number;
                    totalSectors: number;
                    action: 'READ' | 'SEEK';
                    sector?: string;
                }) => {
                    dispatch(
                        factoryProgressDialogActions.setProgress({
                            current: action === 'SEEK' ? -1 : sectorsRead,
                            total: totalSectors,
                            additionalInfo: action === 'SEEK' ? 'Seeking...' : `Reading sector ${sector!}...`,
                        })
                    );
                }
            );
            const filename = createDownloadTrackName(track);
            downloadBlob(new Blob([trackData]), filename);
        }
        dispatch(factoryProgressDialogActions.setVisible(false));
    };
}

export function enableFactoryRippingModeInMainUi() {
    return async function(dispatch: AppDispatch, getState: () => RootState) {
        dispatch(appStateActions.setLoading(true));
        await serviceRegistry.netmdService!.stop();
        await loadFactoryMode();

        const capabilities = await serviceRegistry.netmdFactoryService!.getExploitCapabilities();
        if (!capabilities.includes(ExploitCapability.downloadAtrac)) {
            dispatch(appStateActions.setLoading(false));
            window.alert(
                'Cannot enable factory mode ripping in main UI.\nThis device is not supported yet.\nStay tuned for future updates.'
            );
            return;
        }

        // At this point we're in the factory mode, and CSAR is allowed.
        // It's safe to enable this functionality.

        dispatch(batchActions([appStateActions.setFactoryModeRippingInMainUi(true), appStateActions.setLoading(false)]));
    };
}
