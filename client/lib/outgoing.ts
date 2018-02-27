import { Observable } from "rxjs/Observable";
import { merge } from "rxjs/observable/merge";
import { ClickEvent, ScrollEvent } from "./SocketNS";
import {
    getElementData,
    getScrollPosition,
    getScrollPositionForElement
} from "./browser.utils";
import { of } from "rxjs/observable/of";
import { timer } from "rxjs/observable/timer";
import { concat } from "rxjs/observable/concat";

export function initOutgoing(window: Window, document: Document, socket$) {
    const merged$ = merge(
        getScrollStream(window, document, socket$),
        getClickStream(document, socket$)
    );

    return merged$;
}

function getClickStream(document: Document, socket$) {
    const canSync$ = createBooleanStream(
        socket$.filter(([name]) => name === "click")
    );

    return clickObservable(document)
        .withLatestFrom(canSync$)
        .filter(([, canSync]) => canSync)
        .map(incoming => {
            const clickEvent: { target: HTMLElement } = incoming[0];
            return ClickEvent.outgoing(getElementData(clickEvent.target));
        });
}

function getScrollStream(window: Window, document: Document, socket$) {
    /**
     * A stream of booleans than can be used to pause/resume
     * other streams
     */
    const canSync$ = createBooleanStream(
        socket$.filter(([name]) => name === "scroll")
    );

    return scrollObservable(window, document)
        .withLatestFrom(canSync$)
        .filter(([, canSync]) => canSync)
        .map(incoming => {
            const scrollEvent: { target: HTMLElement } = incoming[0];
            const { target } = scrollEvent;

            if ((target as any) === document) {
                return ScrollEvent.outgoing(
                    getScrollPosition(window, document),
                    "document",
                    0
                );
            }

            const elems = document.getElementsByTagName(target.tagName);
            const index = Array.prototype.indexOf.call(elems || [], target);

            return ScrollEvent.outgoing(
                getScrollPositionForElement(target),
                target.tagName,
                index
            );
        });
}

function clickObservable(document: Document) {
    return Observable.create(obs => {
        document.body.addEventListener(
            "click",
            function(e) {
                obs.next({ target: e.target });
            },
            true
        );
    }).share();
}

function scrollObservable(window, document) {
    return Observable.create(obs => {
        document.addEventListener(
            "scroll",
            function(e) {
                obs.next({ target: e.target });
            },
            true
        );
    }).share();
}

function createBooleanStream(source$, timeout = 1000) {
    return source$
        .switchMap(() => {
            return concat(of(false), timer(timeout).mapTo(true));
        })
        .startWith(true);
}
