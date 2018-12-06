interface IRoute {
    name: string;
    path: string;
    callback: void;
    paramsEnabled?: boolean;
    params?: Array<string>;
}

/**
 * @class RouterRequest
 */
class RouterRequest {
    public URI: string;
    public windowObj: any;

    constructor() {
        const fakeLocation = {
          location: {
            href: '/#/',
            hash: '#/',
          },
        };

        this.windowObj = (typeof window === 'undefined') ? fakeLocation : window;
        this.URI = this.getURI();
    }

    /**
     * @function getURI
     * @returns {string}
     */
    public getURI = (): string => {
        return this.URI = this.windowObj.location.href.split('#')[1] || '/';
    }

    /**
     * @function    setURI
     * @param route string
     */
    public setURI = (route: string): void => {
        if (typeof window !== 'undefined') {
          window.location.hash = route;
        } else {
          this.windowObj.location.hash = route;
        }
    }

    /**
     * @function    setURI
     * @param route string
     */
    public windowListener = (callback: Function): void => {
      if (typeof window !== 'undefined') {
        window.onpopstate = () => {
          callback();
        };
      }
    }
}

/**
 * @package leafeon
 * @description Client-sided and dependency-free Javascript routing library
 * @license MIT
 */
export class Router extends RouterRequest {
    private notfound: boolean;
    private routeCall: any;
    private params: Array<string>;
    private beforeRouteMiddleware: string;
    private beforeRouteMiddlewareFunc: any;
    private afterRouteCallback: any;
    private notFoundCallback: any;
    public route: object;
    public routes: Array<IRoute>;
    public paramsEnabled: boolean;

    constructor() {
        super();

        this.notfound = false;
        this.routes = [];
        this.paramsEnabled = false;
        this.params = [];
        this.beforeRouteMiddleware = '*';
        this.routeCall = () => {};
        this.beforeRouteMiddlewareFunc = () => {};
        this.afterRouteCallback = () => {};
        this.route = {};
        this.notFoundCallback = () => {};

        this.windowListener(this.run);
    }

    /**
     * @function setErrorCallback
     * @param func
     */
    public setErrorCallback = (func: any): this => {
        this.notFoundCallback = func;

        return this;
    }

    /**
     * @function notFoundException
     */
    public notFoundException = (): void => {
        this.notFoundCallback.apply(null, []);
    }

    /**
     * @function before
     * @description Before route function
     * @param route
     * @param func
     */
    public before = (route: string, func: any): this => {
        this.beforeRouteMiddleware = route;
        this.beforeRouteMiddlewareFunc = func;

        return this;
    }

    /**
     * @function add
     * @param {string} name
     * @param {string} path
     * @param callback
     */
    public add = (name: string, path: string, callback: any): this => {
        const routeArray = path.split('/');

        let paramsEnabled = false;
        const params: Array<string> = [];

        routeArray.forEach(r => {
            if (r.substr(0, 1) === ':') {
                paramsEnabled = true;
                params.push(r.substr(1, r.length));
            }
        });

        this.paramsEnabled = paramsEnabled;

        path = path.split('#')[1] || path;

        this.routes.push({
            name: name,
            path: path,
            callback: callback,
            paramsEnabled: paramsEnabled,
            params: params,
        });

        return this;
    }

    /**
     * @function map
     * @description Mapping routes into a specific path
     * @param name
     * @param mount
     * @param routes
     */
    public map = (name: string, mount: string, routes: any[]): this => {
        routes.forEach((route: IRoute) => {
            this.add(name + route.name, mount + this.formatPath(route.path), route.callback);
        });

        return this;
    }

    /**
     * @function fetchRoute
     * @description Target a given route by name or path
     * @param route
     * @param params
     */
    public fetchRoute = (route: string, params: Array<string>): void => {
        const targetRoute = this.routes.find((targetedRoute: IRoute) => {
            return targetedRoute.name === route || targetedRoute.path === route;
        });

        if (targetRoute === undefined) {
            return this.exception('Route ' + route + ' does not exist.');
        }

        if (!targetRoute.paramsEnabled) {
            this.setURI(targetRoute.path);
            return;
        }

        if (!params) {
          this.exception('Error: route "' + route + '" requires some parameters. None specified.');
        }

        const generatedURI = this.generateURL(targetRoute.path, params);

        this.setURI(generatedURI);
    }

    /**
     * @function generateURL
     * @description Generate URL from route and parameters
     * @param route
     * @param params
     * @returns string
     */
    private generateURL = (route: string, params: Array<string>): string => {
        let generatedURI = route;

        Object.keys(params).forEach(p => {
          const paramInRoute = route.split('/').find(targetParam => {
              return targetParam === ':' + p;
          });

          if (paramInRoute !== undefined) {
              generatedURI = generatedURI.replace(paramInRoute, params[p]);
          }
        });

        return generatedURI;
    }

    /**
     * @function formatPath
     * @description Format given path
     * @param path
     */
    private formatPath = (path: string): string => {
        if (path.match(/^(?:\/)?(?:\#)?(?:\/)?[a-zA-Z\-_\/:]+/)[0] !== path) {
          this.exception('Path is not formated correctly.');
        }

        return path.replace(/^(?:\/)?(?:\#)?(?:\/)/, '/');
    }

    /**
     * @function setRoute
     * @description Set the route callback if it match
     * @param route
     * @param params
     */
    private setRoute = (route: IRoute, params: Array<string> = []): void => {
        this.route = route;
        this.routeCall = route.callback;
        this.params = params;
        this.notfound = false;
    }

    /**
     * @function handle
     * @description Check route
     * @param routes
     */
    private handle = (routes: Array<IRoute>): void => {
        const URI = this.getURI();

        routes.forEach(route => {
            const routeArray = route.path.split('/');
            const uriArray: Array<string> = URI.split('/');

            if (uriArray.length !== routeArray.length) {
                return;
            }

            const routeOptions: any = this.handlingParams(route.path);

            if (routeOptions.RouteString === URI && this.notfound) {
                return this.setRoute(route, routeOptions.params);
            }
        });
    }

    /**
     * @function handlingParams
     * @param {string} route
     * @returns {object}
     */
    private handlingParams = (route: string): object => {
        const uriArray = this.getURI().split('/');
        const routeArray = route.split('/');
        const params: Array<string> = [];

        for (let i = 0; i < routeArray.length; i++) {
            if (routeArray[i].substr(0, 1) === ':') {
                if (uriArray[i] !== '') {
                    params.push(uriArray[i]);
                }

                routeArray[i] = uriArray[i];
            }
        }

        return {
            params: params,
            RouteString: routeArray.join('/'),
        };
    }

    /**
     * @function run
     * @description Run the router and search for a route match
     * @param afterRouteCallback
     */
    public run = (afterRouteCallback?: any): void => {
        const URI = this.getURI();
        const routes: Array<any> = [];

        // While a route has not match the URI, set page as not found
        this.notfound = true;

        // Call before middleware
        this.beforeMiddleware(this.beforeRouteMiddleware, this.beforeRouteMiddlewareFunc);

        this.routes.forEach(route => {
            if (route.paramsEnabled) {
                routes.push(route);
                this.handle(routes);
            } else if (route.path === URI) {
                this.setRoute(route);
            }
        });

        // If there's a route match, execute the callback
        if (this.notfound) {
            this.notFoundException();
        } else {
            this.routeCall.apply(null, this.params);
        }

        // Call after middleware
        if (afterRouteCallback != null) {
            this.afterRouteCallback = afterRouteCallback;
            this.afterRouteCallback.apply(null, []);
        } else if (this.afterRouteCallback != null) {
            this.afterRouteCallback.apply(null, []);
        }
    }

    /**
     * @function beforeMiddleware
     * @param {string} route
     * @param callback
     */
    private beforeMiddleware = (route: string, callback: any) => {
        route = route.split('#')[1] || route;

        if (callback != null) {
            if (route === '*') {
                return callback.apply(null, []);
            } else if (route === this.getURI()) {
                return callback.apply(null, []);
            }
        }
    }

    /**
     * @function exception
     * @param {string} message
     * @returns {never}
     */
    private exception = (message: string): never => {
        throw new TypeError(message);
    }
}
