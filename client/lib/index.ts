///<reference path="types.ts"/>
import {Observable} from 'rxjs';
import {initDocument, initOptions, initSocket, initWindow} from "./socket";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {FileReloadEventPayload} from "../types/socket";
import {isBlacklisted, options} from "./code-sync";
import {reload} from "../vendor/Reloader";
const nanlogger = require("nanologger");
const log = nanlogger("Browsersync", { colors: { magenta: "#0F2634" } });

const { of, empty, merge } = Observable;

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

export enum Log {
    Info = '@@Log.info',
}

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
    export function styleSet(incoming): [Events.StyleSet, any] {
        return [Events.StyleSet, incoming];
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
        .flatMap(x => {
            return of(
                [EffectNames.SetOptions, x],
                [Log.Info, ['Connection']],
            );
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
        .withLatestFrom(inputs.option$.pluck('injectNotification'))
        .do(([incoming, injectNotification]) => {
            const {target, prop, value, pathname} = incoming;
            target[prop] = value;
            if (injectNotification === 'console') {
                log.info(`[PropSet]`, target, `${prop} = ${pathname}`)
            }
        })
        .ignoreElements(),
    [BSDOM.Events.StyleSet]: (xs) => xs
        .withLatestFrom(inputs.option$.pluck('injectNotification'))
        .do(([event, injectNotification]) => {
            const {style, styleName, newValue, pathName} = event;
            style[styleName] = newValue;

            if (injectNotification === 'console') {
                log.info(`[StyleSet] ${styleName} = ${pathName}`)
            }
        })
        .ignoreElements(),
    [BSDOM.Events.LinkReplace]: (xs, inputs) => xs
        .withLatestFrom(inputs.option$.pluck('injectNotification'))
        .do(([incoming, injectNotification]) => {
            if (injectNotification === 'console') {
                log.info(`[LinkReplace] ${incoming.pathname}`)
            }
            if (injectNotification === 'overlay') {
                console.log('SHOULD NOTIFY');
            }
        })
        .ignoreElements()
});

const logHandler$ = new BehaviorSubject({
    [Log.Info]: (xs, inputs) => {
        return xs
            .do(x => {
                log.info.apply(log, x);
            }).ignoreElements()
    }
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
            .share()
    }
}

const output$ = getStream('[socket]', inputs)(inputHandlers$, inputs.socket$);
const effect$ = getStream('[effect]', inputs)(outputHandlers$, output$);
const dom$    = getStream('[dom-effect]', inputs)(domHandlers$, effect$);
const log$    = getStream('[log]', inputs)(logHandler$, merge(output$, effect$, dom$));

log$.subscribe();

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
