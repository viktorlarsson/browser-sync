import {getByPath, isUndefined} from "./browser.utils";

interface BrowserSyncInit {
    socket: any,
    emitter: any,
    options: bs.InitOptions
}

/**
 * @constructor
 */
export class BrowserSync {

    public socket: any;
    public emitter: any;
    public options: bs.InitOptions;
    public tabHidden: boolean = false;

    constructor(public init: BrowserSyncInit) {

        this.socket = init.socket;
        this.emitter = init.emitter;
        this.options = init.options;

        /**
         * Options set
         */
        this.socket.on("options:set", (data: {options: bs.InitOptions}) => {
            this.emitter.emit("notify", "Setting options...");
            this.options = data.options;
        });

        this.emitter.on("tab:hidden", () => {
            this.tabHidden = true;
        });
        this.emitter.on("tab:visible", () => {
            this.tabHidden = false;
        });
    }
    /**
     * Helper to check if syncing is allowed
     * @param data
     * @param optPath
     * @returns {boolean}
     */
    canSync(data, optPath) {

        data = data || {};

        if (data.override) {
            return true;
        }

        var canSync = true;

        if (optPath) {
            canSync = this.getOption(optPath);
        }

        return canSync && data.url === window.location.pathname;
    }
    /**
     * Helper to check if syncing is allowed
     * @returns {boolean}
     */
    public getOption(path) {
        if (path && path.match(/\./)) {
            return getByPath(this.options, path);
        } else {
            var opt = this.options[path];

            if (isUndefined(opt)) {
                return false;
            } else {
                return opt;
            }
        }
    }
}


