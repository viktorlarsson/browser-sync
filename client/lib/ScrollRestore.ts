import { getBrowserScrollPosition, setScroll } from "./browser.utils";
import { EffectNames } from "./Effects";
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { Inputs } from "./index";
import { empty } from "rxjs/observable/empty";
import { of } from "rxjs/observable/of";
import {Log} from "./Log";

export function initCookie() {
    console.log("initCookie");
    return empty();
}

export function initWindowName(window: Window) {
    var PRE = "<<BS_START>>";
    var SUF = "<<BS_END>>";
    var regex = new RegExp(PRE + "(.+?)" + SUF);
    var saved: any = {};

    /**
     * On page load, check window.name for an existing
     * BS json blob & parse it.
     */
    try {
        var json = window.name.match(regex);
        if (json) {
            saved = JSON.parse(json[1]);
        }
    } catch (e) {
        saved = {};
    }

    /**
     * Remove any existing BS json from window.name
     * to ensure we don't interfere with any other
     * libs who may be using it.
     */
    window.name = window.name.replace(regex, "");

    /**
     * If the JSON was parsed correctly, try to
     * find a scroll property and restore it.
     */
    if (saved && saved.bs && saved.bs.hardReload && saved.bs.scroll) {
        const {x, y} = saved.bs.scroll;
        window.scrollTo(x, y);
        return of(Log.consoleDebug(`[ScrollRestore] x: ${x} y: ${y}`))
    }
    return empty();
}

export const scrollRestoreHandlers$ = new BehaviorSubject({
    [EffectNames.SetOptions]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$)
            .take(1)
            .flatMap(([options, window]) => {
                if (options.scrollRestoreTechnique === "window.name") {
                    return initWindowName(window);
                }
                initCookie();
            })
    },
    /**
     * Hard reload the browser
     */
    [EffectNames.PreBrowserReload]: (xs, inputs: Inputs) => {
        return xs
            .withLatestFrom(inputs.window$, inputs.document$)
            .do(([, window, document]) => {
                const PRE = "<<BS_START>>";
                const SUF = "<<BS_END>>";
                const newname = [
                    window.name,
                    PRE,
                    JSON.stringify({
                        bs: {
                            hardReload: true,
                            scroll: getBrowserScrollPosition(window, document)
                        }
                    }),
                    SUF
                ].join("");
                window.name = newname;
            });
    }
});
