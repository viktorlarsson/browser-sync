import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Rx";
import { FileReloadEventPayload } from "../types/socket";
import { EffectStream, Inputs } from "./index";
import { isBlacklisted } from "./utils";
import { of } from "rxjs/observable/of";
import { empty } from "rxjs/observable/empty";
import { EffectEvent, EffectNames, reloadBrowserSafe } from "./Effects";
import { Log, Overlay } from "./Log";

export namespace SocketNS {
    export interface ScrollPayload {
        position: {raw: {x: number, y: number}, proportional: number},
        override: boolean
    }
}

export enum SocketNames {
    Connection = "connection",
    Disconnect = "disconnect",
    FileReload = "file:reload",
    BrowserReload = "browser:reload",
    BrowserLocation = "browser:location",
    Scroll = "scroll",
}

export enum OutgoingSocketEvents {
    Scroll = 'scroll'
}

export type SocketEvent = [SocketNames, any];

export const socketHandlers$ = new BehaviorSubject({
    [SocketNames.Connection]: (xs, inputs) => {
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
    [SocketNames.Disconnect]: (xs, inputs: Inputs) => {
        return xs.do(x => console.log(x)).ignoreElements();
    },
    [SocketNames.FileReload]: (xs, inputs) => {
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
    [SocketNames.BrowserReload]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$)
            .filter(([event, options]) => options.codeSync)
            .flatMap(reloadBrowserSafe);
    },
    [SocketNames.BrowserLocation]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck('ghostMode', 'location'))
            .filter(([, canSyncLocation]) => canSyncLocation)
            .map(([event]) => {
                return [EffectNames.BrowserSetLocation, event];
            });
    },
    [SocketNames.Scroll]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck('ghostMode', 'scroll'))
            .filter(([, canScroll]) => canScroll)
            .map(([event]) => {
                return [EffectNames.BrowserSetScroll, event];
            });
    },
    [OutgoingSocketEvents.Scroll]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.socket$)
            .do(([event, socket]) => socket.emit(event[0], event[1]))
            .ignoreElements();
    }
});
