import {SocketNames} from "../lib";

export type FileReloadEventPayload = {
    url?: string;
    ext: string;
    path: string;
    basename: string;
    event: string;
    type: 'inject' | 'reload';
}

export type FileReloadEvent = [SocketNames.FileReload, FileReloadEventPayload];
