import {Observable} from 'rxjs/Observable';
import {merge} from 'rxjs/observable/merge';
import {ScrollEvent} from "./SocketNS";
import {getScrollPosition} from "./browser.utils";
import {empty} from "rxjs/observable/empty";
import {of} from "rxjs/observable/of";
import {timer} from "rxjs/observable/timer";
import {concat} from "rxjs/observable/concat";
const eventManager = require('./events').manager;

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

    return scrollObservable(window)
        .withLatestFrom(canSync$)
        .filter(([, canSync]) => canSync)
        .map(() => {
            return ScrollEvent.outgoing(getScrollPosition(window, document));
        });
}

function scrollObservable(window) {
    return Observable.create(obs => {
        eventManager.addEvent(window, 'scroll', function() {
            obs.next('scroll');
        });
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