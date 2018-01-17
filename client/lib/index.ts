///<reference path="types.ts"/>
import {Observable} from 'rxjs';
import {initDocument, initOptions, initSocket, initWindow} from "./socket";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {FileReloadEventPayload} from "../types/socket";
import {isBlacklisted, options} from "./code-sync";
import {reload} from "../vendor/Reloader";
const nanlogger = require("nanologger");
const log = nanlogger("Browsersync", { colors: { magenta: "#0F2634" } });

const { of, empty } = Observable;

interface Inputs {
    window$: Observable<Window>,
    document$: Observable<Document>,
    socket$: Observable<SocketEvent>,
    option$: Observable<IBrowserSyncOptions>,
    navigator$: Observable<Navigator>,
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
    BrowserReload = 'browser:reload',
}

export enum EffectNames {
    FileReload = '@@FileReload',
    BrowserReload = '@@BrowserReload',
    SetOptions = '@@SetOptions',
}

export namespace BSDOM {
    export enum Events {
        PropSet = '@@BSDOM.Events.PropSet',
        StyleSet = '@@BSDOM.Events.StyleSet',
        LinkReplace = '@@BSDOM.Events.LinkReplace'

    }
    export function propSet(incoming): [Events.PropSet, any] {
        return [Events.PropSet, incoming];
    }
    export function linkReplace(incoming): [Events.LinkReplace, any] {
        return [Events.LinkReplace, incoming];
    }
}

const window$ = initWindow();
const document$ = initDocument();
const socket$ = initSocket();
const option$ = initOptions();
const navigator$ = initOptions();

const inputs: Inputs = {
    window$,
    document$,
    socket$,
    option$,
    navigator$,
};

const inputHandlers$ = new BehaviorSubject<SocketStreamMapped>({
    [SocketNames.Connection]: (xs) => xs
        .map(x => {
            return [EffectNames.SetOptions, x]
        }),
    [SocketNames.FileReload]: (xs, inputs) => xs
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
    [SocketNames.BrowserReload]: (xs, inputs) => xs
        .withLatestFrom(inputs.option$)
        .filter(([event, options]) => options.codeSync)
        .mapTo([EffectNames.BrowserReload])
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
        .withLatestFrom(inputs.document$, inputs.navigator$)
        .flatMap(([event, document, navigator]) => {
            return reload(document, navigator)(event, {
                ...options,
                liveCSS: true,
                liveImg: true
            })
        }),
    /**
     * Hard reload the browser
     */
    [EffectNames.BrowserReload]: (xs, inputs: Inputs) => xs
        .withLatestFrom(inputs.window$)
        .do(([, window]) => window.location.reload(true)),
});

const domHandlers$ = new BehaviorSubject({
    [BSDOM.Events.PropSet]: (xs) => xs
        .do(({target, prop, value}) => {
            target[prop] = value;
        })
        .ignoreElements(),
    [BSDOM.Events.StyleSet]: (xs) => xs
        .do(({style, styleName, newValue}) => {
            style[styleName] = newValue;
        })
        .ignoreElements(),
    [BSDOM.Events.LinkReplace]: (xs, inputs) => xs
        .withLatestFrom(inputs.option$)
        .do(([incoming, options]) => {
            log.info(`replaced ${incoming.prevHref} with ${incoming.nextHref}`)
        })
        // .ignoreElements()
});

function getStream(name: string, inputs) {
    return function(handlers$, inputStream$) {
        return inputStream$
            .do(x => {
                log.trace(`${name}`, x[0], x[1]);
                // log.trace(`${name}`, x[0], x[1]);
            })
            .groupBy(([name]) => name)
            .withLatestFrom(handlers$)
            .filter(([x, handlers]) => typeof handlers[x.key] === 'function')
            .flatMap(([x, handlers]) => {
                return handlers[x.key](x.pluck(1), inputs);
            })
    }
}

const output$ = getStream('[socket]', inputs)(inputHandlers$, inputs.socket$);
const effect$ = getStream('[effect]', inputs)(outputHandlers$, output$.do(x => log.trace(`[effect:${x[0]}]`, x[1])));
const dom$    = getStream('[dom-effect]', inputs)(domHandlers$, effect$);

dom$.subscribe();

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
