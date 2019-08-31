/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2018 The authors

   License:
     MIT: https://opensource.org/licenses/MIT
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Christian Boulanger (cboulanger)

************************************************************************ */

/**
 * A proxy for an application running in a different browser window or tab
 *
 */
qx.Class.define("qx.ui.window.RemoteApplication", {
  extend: qx.core.Object,
  implement: qx.data.IProxy,
  include: [qx.data.MRemoteBinding],

  /**
   * Constructor
   * @param uri {String}
   *    The uri of the remote web application, usually a URL, can also be the
   *    name of a subdirectory of the parent directory of the running
   *    application.
   * @param config {Object}
   *    Window configuration, see {@link  qx.bom.Window#open}.
   * @param name {String}
   *    An option name/id of thw window, which must be unique
   */
  construct: function(uri, config, name) {
    this.base(arguments);
    this.__uri = uri;
    var url = this._computeApplicationUrl(uri);
    qx.util.Validate.checkUrl(url);
    var window_name = name || "window-" + this._createUuid();
    config = this._computeWindowConfig(config);
    this.__window = qx.bom.Window.open(url, window_name, config);
    // close popup window when main application unloads
    window.addEventListener("beforeunload", () => {
      if (!this.isClosed()) {
        this.close();
      }
      this.stopPropertySync();
      this.__window = null;
    });
    var transport = new qx.io.channel.transport.PostMessage(this.__window, window_name);
    this.__channel = new qx.io.channel.Channel(transport);
  },

  members: {
    __channel: null,
    __window: null,

    /**
     * Returns the map that is passed into {@link qx.bom.Window#open}, using
     * default values and overriding them with values in the map.
     * @param config {Object|undefined}
     * @return {Object}
     */
    _computeWindowConfig(config={}) {
      var defaultConfig = this._getWindowDefaultConfig();
      for (var key in defaultConfig) {
        if (config[key] === undefined) {
          config[key] = defaultConfig[key];
        }
      }
      return config;
    },

    /**
     * Exposes the internal window object
     * @return {Window}
     */
    _getWindow: function() {
      return this.__window;
    },

    /**
     * Returns default values for {@link qx.bom.Window#open}. Can be overridden
     * to set other values.
     * @return {Object}
     */
    _getWindowDefaultConfig() {
      return {
        width: 800,
        height: 600,
        dependent: true,
        menubar: false,
        status: false,
        scrollbars: false,
        toolbar: false
      };
    },

    /**
     * Given an identifier (either a complete URL or an application name as stated
     * in compile.json), return the URL to the application.
     * @param uri
     * @return {String}
     * @private
     */
    _computeApplicationUrl(uri) {
      if (!uri.startsWith("http")) {
        // if this isn't a valid URL, prepend parente directory
        var appUrl = qx.util.Uri.parseUri(location.href);
        var parentDir = appUrl.protocol + "://" + appUrl.authority + appUrl.directory.split("/").slice(0, -2).join("/");
        uri = parentDir + "/" + uri;
      }
      return uri;
    },

    /**
     * Interface method, see {@link qx.data.IProxy#startPropertySync}
     * @param options see {@link qx.data.IProxy#_syncProperties}
     */
    startPropertySync: function(options) {
      this._syncProperties(this.__channel, options);
    },

    /**
     * Returns the uri of the remote application
     * @return {String}
     */
    getUri: function() {
      return this.__uri;
    },

    open: function() {
      this.__window.focus();
    },

    close: function () {
      this.__window.close();
    },

    isClosed: function () {
      return qx.bom.Window.isClosed(this.__window);
    }
  },

  destruct: function () {
    this.base(arguments);
    if (!qx.bom.Window.isClosed(this.__window)) {
      this.__window.close();
    }
    this._disposeObjects("__window", "__channel");
  }
});
