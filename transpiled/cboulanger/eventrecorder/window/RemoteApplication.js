(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "cboulanger.eventrecorder.window.MRemoteBinding": {
        "require": true
      },
      "qx.bom.Window": {
        "construct": true
      },
      "qx.util.Uri": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

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
  qx.Class.define("cboulanger.eventrecorder.window.RemoteApplication", {
    extend: qx.core.Object,
    include: [cboulanger.eventrecorder.window.MRemoteBinding],

    /**
     * Constructor
     * @param uri {String}
     * @param config {Object}
     */
    construct: function construct(uri, config) {
      qx.core.Object.constructor.call(this);

      var url = this._computeApplicationUrl(uri);

      var window_name = "window-" + this.createUuid();
      config = this._computeWindowConfig(config);
      this.__window = qx.bom.Window.open(url, window_name, config);
      window.addEventListener("beforeunload", () => {
        if (!this.isClosed()) {
          this.close();
        }

        this.__window = null;
      });
    },
    members: {
      __window: null,

      /**
       * Returns the map that is passed into {@link qx.bom.Window#open}, using
       * default values and overriding them with values in the map.
       * @param config {Object|undefined}
       * @return {Object}
       */
      _computeWindowConfig(config = {}) {
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
      _getWindow: function _getWindow() {
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

      open: function open() {
        this.__window.focus();
      },
      close: function close() {
        this.__window.close();
      },
      isClosed: function isClosed() {
        return qx.bom.Window.isClosed(this.__window);
      }
    },
    destruct: function destruct() {
      cboulanger.eventrecorder.window.RemoteApplication.prototype.$$destructor.base.call(this);

      if (!qx.bom.Window.isClosed(this.__window)) {
        this.__window.close();
      }

      this.__window = null;
    }
  });
  cboulanger.eventrecorder.window.RemoteApplication.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=RemoteApplication.js.map?dt=1571643405925