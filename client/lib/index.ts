///<reference path="types.ts"/>

var socket = require("./socket");
var shims = require("./client-shims");
var notify = require("./notify");
var codeSync = require("./code-sync");
const { BrowserSync } = require("./browser-sync");
var ghostMode = require("./ghostmode");
var events = require("./events");
var utils = require("./browser.utils");

const mitt = require("mitt").default;

var shouldReload = false;
var initialised = false;

/**
 * @param options
 */
function init(options: bs.InitOptions) {
    if (shouldReload && options.reloadOnRestart) {
        utils.reloadBrowser();
    }

    var BS = window.___browserSync___ || {};
    var emitter = mitt();

    if (!BS.client) {
        BS.client = true;

        var browserSync = new BrowserSync({ options, emitter, socket });

        // // Always init on page load
        // ghostMode.init(browserSync);
        // codeSync.init(browserSync);
        //
        // notify.init(browserSync);
        //
        // if (options.notify) {
        //     notify.flash("Connected to BrowserSync");
        // }
    }

    // if (!initialised) {
    //     socket.on("disconnect", function() {
    //         if (options.notify) {
    //             notify.flash("Disconnected from BrowserSync");
    //         }
    //         shouldReload = true;
    //     });
    //     initialised = true;
    // }
}

/**
 * Handle individual socket connections
 */
socket.on("connection", init);
