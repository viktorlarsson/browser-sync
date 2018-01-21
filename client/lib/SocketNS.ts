import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Observable } from "rxjs/Rx";
import { FileReloadEventPayload } from "../types/socket";
import { EffectStream } from "./index";
import { isBlacklisted } from "./code-sync";
import { of } from "rxjs/observable/of";
import { empty } from "rxjs/observable/empty";
import { EffectEvent, EffectNames } from "./Effects";
import { Log, Overlay } from "./Log";

export namespace SocketNS {

}

type SocketStreamMapped = {
    [name in SocketNames]: (xs, inputs?: any) => EffectStream
};

export enum SocketNames {
    Connection = "connection",
    FileReload = "file:reload",
    BrowserReload = "browser:reload"
}

export type SocketEvent = [SocketNames, any];

export const socketHandlers$ = new BehaviorSubject<SocketStreamMapped>({
    [SocketNames.Connection]: (xs, inputs) => {
        return xs
            .withLatestFrom(inputs.option$.pluck("logPrefix"))
            .flatMap(([x, logPrefix]) => {
                return of(
                    [EffectNames.SetOptions, x],
                    Log.overlayInfo(`${logPrefix}: connected`)
                );
            });
    },
    [SocketNames.FileReload]: (xs, inputs) =>
        xs
            .withLatestFrom(inputs.option$)
            .filter(([event, options]) => options.codeSync)
            .flatMap(([event, options]): Observable<EffectEvent> => {
                const data: FileReloadEventPayload = event;
                if (data.url || !options.injectChanges) {
                    return of([EffectNames.BrowserReload]);
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
            .mapTo([EffectNames.BrowserReload])
});
