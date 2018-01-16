///<reference path="types.ts"/>
import {Observable} from 'rxjs';
import {initDocument, initOptions, initSocket, initWindow} from "./socket";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {canSync} from "./browser-sync";
import {FileReloadEventPayload} from "../types/socket";
import {fileReload, isBlacklisted} from "./code-sync";
import {reload} from "../vendor/Reloader";
const nanlogger = require("nanologger");
const log = nanlogger("Browsersync", { colors: { magenta: "#0F2634" } });

const { of, from, empty } = Observable;

interface Inputs {
    window$: Observable<Window>,
    document$: Observable<Document>,
    socket$: Observable<SocketEvent>,
    option$: Observable<IBrowserSyncOptions>,
}

type EffectStream = Observable<[EffectNames, any]>
type AnyStream = Observable<any|[any, any]>

type SocketStreamMapped = {[name in SocketNames]: (xs, inputs?: any) => EffectStream}
type EffectStreamMapped = {[name in EffectNames]: (xs, inputs?: any) => AnyStream}
type SocketEvent = [SocketNames, any];
type EffectEvent = [EffectNames] | [EffectNames, any] | EffectNames[];

export enum SocketNames {
    Connection = 'connection',
    FileReload = 'file:reload',
}

export enum EffectNames {
    FileReload = '@@FileReload [e]',
    BrowserReload = '@@BrowserReload [e]',
    SetOptions = '@@SetOptions [e]',
}

const window$ = initWindow();
const document$ = initDocument();
const socket$ = initSocket();
const option$ = initOptions();

const inputs = {
    window$,
    document$,
    socket$,
    option$,
};

const inputHandlers$ = new BehaviorSubject<SocketStreamMapped>({
    [SocketNames.Connection]: (xs) => xs
        .map(x => {
            return [EffectNames.SetOptions, x]
        }),
    [SocketNames.FileReload]: (xs, input) => xs
        .withLatestFrom(input.option$)
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
        })
});

const outputHandlers$ = new BehaviorSubject<EffectStreamMapped>({
    /**
     * Set the local client options
     * @param xs
     */
    [EffectNames.SetOptions]: (xs) => xs
        .do(x => option$.next(x))
        .ignoreElements(),
    /**
     * Attempt to reload files in place
     * @param xs
     * @param inputs
     */
    [EffectNames.FileReload]: (xs, inputs: Inputs) => xs
        .withLatestFrom(inputs.document$)
        .do(([event, document]) => {
            fileReload(event, document);
        })
        .ignoreElements(),
    /**
     * Hard reload the browser
     */
    [EffectNames.BrowserReload]: (xs, inputs: Inputs) => xs
        .withLatestFrom(inputs.window$)
        .do(([, window]) => window.location.reload(true))
        .ignoreElements(),
        // .map(x => {
        //     return {
        //         type: 'set options',
        //         payload: x
        //     }
        // })
    // 'file:reload': (xs, inputs) => xs
    //     .withLatestFrom()
});

function getStream(name: string, inputs) {
    return function(handlers$, inputStream$) {
        return inputStream$
            .do(x => log.trace(`${name}`, x[0], x[1]))
            .groupBy(([name]) => name)
            .withLatestFrom(handlers$)
            .filter(([x, handlers]) => typeof handlers[x.key] === 'function')
            .flatMap(([x, handlers]) => handlers[x.key](x.pluck(1), inputs))
    }
}

const output$ = getStream('[socket]', inputs)(inputHandlers$, inputs.socket$);
const effect$ = getStream('[effect]', inputs)(outputHandlers$, output$);

effect$
    .subscribe();

// var socket = require("./socket");
// var shims = require("./client-shims");
// var notify = require("./notify");
// // var codeSync = require("./code-sync");
// const { BrowserSync } = require("./browser-sync");
// var ghostMode = require("./ghostmode");
// var events = require("./events");
// var utils = require("./browser.utils");
//
// const mitt = require("mitt").default;
//
// var shouldReload = false;
// var initialised = false;
//
// /**
//  * @param options
//  */
// function init(options: bs.InitOptions) {
//     if (shouldReload && options.reloadOnRestart) {
//         utils.reloadBrowser();
//     }
//
//     var BS = window.___browserSync___ || {};
//     var emitter = mitt();
//
//     if (!BS.client) {
//         BS.client = true;
//
//         var browserSync = new BrowserSync({ options, emitter, socket });
//
//         // codeSync.init(browserSync);
//
//         // // Always init on page load
//         // ghostMode.init(browserSync);
//         //
//         // notify.init(browserSync);
//         //
//         // if (options.notify) {
//         //     notify.flash("Connected to BrowserSync");
//         // }
//     }
//
//     // if (!initialised) {
//     //     socket.on("disconnect", function() {
//     //         if (options.notify) {
//     //             notify.flash("Disconnected from BrowserSync");
//     //         }
//     //         shouldReload = true;
//     //     });
//     //     initialised = true;
//     // }
// }
//
// /**
//  * Handle individual socket connections
//  */
// socket.on("connection", init);
