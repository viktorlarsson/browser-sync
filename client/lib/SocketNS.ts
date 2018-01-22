import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Rx";
import { FileReloadEventPayload } from "../types/socket";
import {EffectStream, Inputs} from "./index";
import { isBlacklisted } from "./code-sync";
import { of } from "rxjs/observable/of";
import { empty } from "rxjs/observable/empty";
import { EffectEvent, EffectNames, reloadBrowserSafe } from "./Effects";
import { Log, Overlay } from "./Log";
import {BSDOM} from "./BSDOM";

export namespace SocketNS {

}

type SocketStreamMapped = {
    [name in SocketNames]: (xs, inputs?: any) => EffectStream
};

export enum SocketNames {
    Connection = "connection",
    Disconnect = "disconnect",
    FileReload = "file:reload",
    BrowserReload = "browser:reload"
}

export type SocketEvent = [SocketNames, any];

export const socketHandlers$ = new BehaviorSubject<SocketStreamMapped>({
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
                console.log('NOT 0');
                return of(reloadBrowserSafe());
            });
    },
    [SocketNames.Disconnect]: (xs, inputs: Inputs) => {
        return xs.do(x => console.log(x)).ignoreElements();
    },
    [SocketNames.FileReload]: (xs, inputs) =>
        xs
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
            }),
    [SocketNames.BrowserReload]: (xs, inputs) =>
        xs
            .withLatestFrom(inputs.option$)
            .filter(([event, options]) => options.codeSync)
            .flatMap(reloadBrowserSafe)
});
