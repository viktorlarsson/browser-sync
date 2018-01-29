import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Rx";
import { FileReloadEventPayload } from "../types/socket";
import { Inputs } from "./index";
import { isBlacklisted } from "./utils";
import { of } from "rxjs/observable/of";
import { empty } from "rxjs/observable/empty";
import { EffectEvent, EffectNames, reloadBrowserSafe } from "./Effects";
import { Log } from "./Log";

export namespace ScrollEvent {
    export interface Data {
        raw: {x: number, y: number},
        proportional: number
    }
    export interface OutgoingPayload {
        position: Data
    }
    export interface IncomingPayload {
        position: Data,
        override: boolean
    }
    export function outgoing(data: Data): [OutgoingSocketEvents.Scroll, OutgoingPayload] {
        return [OutgoingSocketEvents.Scroll, {position: data}];
    }
}

export enum IncomingSocketNames {
    Connection = "connection",
    Disconnect = "disconnect",
    FileReload = "file:reload",
    BrowserReload = "browser:reload",
    BrowserLocation = "browser:location",
    Scroll = "scroll",
}

export enum OutgoingSocketEvents {
    Scroll = '@@outgoing/scroll'
}

export type SocketEvent = [IncomingSocketNames, any];

export const socketHandlers$ = new BehaviorSubject({
    [IncomingSocketNames.Connection]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck("logPrefix"))
            .flatMap(([x, logPrefix], index) => {
                if (index === 0) {
                    return of(
                        [EffectNames.SetOptions, x],
                        Log.overlayInfo(`${logPrefix}: connected`)
                    );
                }
                return of(reloadBrowserSafe());
            });
    },
    [IncomingSocketNames.Disconnect]: (xs, inputs: Inputs) => {
        return xs.do(x => console.log(x)).ignoreElements();
    },
    [IncomingSocketNames.FileReload]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$)
            .filter(([event, options]) => options.codeSync)
            .flatMap(([event, options]): Observable<EffectEvent> => {
                const data: FileReloadEventPayload = event;
                if (data.url || !options.injectChanges) {
                    return reloadBrowserSafe();
                }
                if (data.basename && data.ext && isBlacklisted(data)) {
                    return empty();
                }
                return of([EffectNames.FileReload, event]);
            });
    },
    [IncomingSocketNames.BrowserReload]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$)
            .filter(([event, options]) => options.codeSync)
            .flatMap(reloadBrowserSafe);
    },
    [IncomingSocketNames.BrowserLocation]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck('ghostMode', 'location'))
            .filter(([, canSyncLocation]) => canSyncLocation)
            .map(([event]) => {
                return [EffectNames.BrowserSetLocation, event];
            });
    },
    [IncomingSocketNames.Scroll]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck('ghostMode', 'scroll'))
            .filter(([, canScroll]) => canScroll)
            .map(([event]) => {
                return [EffectNames.BrowserSetScroll, event];
            });
    },
    [OutgoingSocketEvents.Scroll]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.io$)
            .do(([event, io]) => io.emit(IncomingSocketNames.Scroll, event))
            .ignoreElements();
    }
});
