import {Observable} from 'rxjs/Observable';
import {merge} from 'rxjs/observable/merge';
import {ScrollEvent} from "./SocketNS";
import {getScrollPosition, getScrollPositionForElement} from "./browser.utils";
import {of} from "rxjs/observable/of";
import {timer} from "rxjs/observable/timer";
import {concat} from "rxjs/observable/concat";

export function initOutgoing(window: Window, document: Document, socket$) {
    const merged$ = merge(
        getScrollStream(window, document, socket$)
    );

    return merged$;
}

function getScrollStream(window, document, socket$) {

    /**
     * A stream of booleans than can be used to pause/resume
     * other streams
     */
    const canSync$ = createBooleanStream(socket$.filter(([name]) => name === 'scroll'));

    return scrollObservable(window, document)
        .withLatestFrom(canSync$)
        .filter(([, canSync]) => canSync)
        .map((incoming) => {
            const scrollEvent: {target: HTMLElement} = incoming[0];
            const {target} = scrollEvent;

            if (target === document) {
                return ScrollEvent.outgoing(getScrollPosition(window, document), 'document', 0);
            }

            const elems = document.getElementsByTagName(target.tagName);
            const index = Array.prototype.indexOf.call((elems || []), target);

            return ScrollEvent.outgoing(getScrollPositionForElement(target), target.tagName, index);
        });
}

function scrollObservable(window, document) {
    return Observable.create(obs => {
        // eventManager.addEvent(window, 'scroll', function(e) {
        //     obs.next({target: window});
        // });
        document.addEventListener('scroll', function(e) {
            obs.next({target: e.target});
        }, true)
        // eventManager.addEvent(document, 'scroll', function(e) {
        //     // obs.next('scroll');
        //     console.log(e);
        // });
    }).share();
}

function createBooleanStream(source$, timeout = 1000) {
    return source$
        .switchMap(() => {
            return concat(
                of(false),
                timer(timeout).mapTo(true)
            )
        }
    ).startWith(true);
}