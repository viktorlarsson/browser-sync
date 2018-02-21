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

    return scrollObservable(window, document)
        .withLatestFrom(canSync$)
        .filter(([, canSync]) => canSync)
        .map((incoming) => {
            const scrollEvent: {target: HTMLElement} = incoming[0];
            const {target} = scrollEvent;

            if (target === document) {
                console.log('document scroll');
            }

            const elems = document.getElementsByTagName(target.tagName);

            if (elems && elems.length) {
                const {tagName} = target;
                console.log('element scroll', tagName);
                console.log('element index', Array.prototype.indexOf.call(elems, target));
            }

            return ScrollEvent.outgoing(getScrollPosition(window, document));
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