(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.util.ValueManager": {
        "construct": true,
        "require": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);qx.Class.define("qx.util.AliasManager", {
    type: "singleton",
    extend: qx.util.ValueManager,

    /*
    *****************************************************************************
       CONSTRUCTOR
    *****************************************************************************
    */

    construct: function construct() {
      qx.util.ValueManager.constructor.call(this);

      // Contains defined aliases (like icons/, widgets/, application/, ...)
      this.__aliases = {};

      // Define static alias from setting
      this.add("static", "qx/static");
    },

    /*
    *****************************************************************************
       MEMBERS
    *****************************************************************************
    */

    members: {

      __aliases: null,

      /**
       * pre-process incoming dynamic value
       *
       * @param value {String} incoming value
       * @return {String} pre processed value
       */
      _preprocess: function _preprocess(value) {
        var dynamics = this._getDynamic();

        if (dynamics[value] === false) {
          return value;
        } else if (dynamics[value] === undefined) {
          if (value.charAt(0) === "/" || value.charAt(0) === "." || value.indexOf("http://") === 0 || value.indexOf("https://") === "0" || value.indexOf("file://") === 0) {
            dynamics[value] = false;
            return value;
          }

          if (this.__aliases[value]) {
            return this.__aliases[value];
          }

          var alias = value.substring(0, value.indexOf("/"));
          var resolved = this.__aliases[alias];

          if (resolved !== undefined) {
            dynamics[value] = resolved + value.substring(alias.length);
          }
        }

        return value;
      },

      /**
       * Define an alias to a resource path
       *
       * @param alias {String} alias name for the resource path/url
       * @param base {String} first part of URI for all images which use this alias
       */
      add: function add(alias, base) {
        // Store new alias value
        this.__aliases[alias] = base;

        // Localify stores
        var dynamics = this._getDynamic();

        // Update old entries which use this alias
        for (var path in dynamics) {
          if (path.substring(0, path.indexOf("/")) === alias) {
            dynamics[path] = base + path.substring(alias.length);
          }
        }
      },

      /**
       * Remove a previously defined alias
       *
       * @param alias {String} alias name for the resource path/url
       */
      remove: function remove(alias) {
        delete this.__aliases[alias];

        // No signal for depending objects here. These
        // will informed with the new value using add().
      },

      /**
       * Resolves a given path
       *
       * @param path {String} input path
       * @return {String} resulting path (with interpreted aliases)
       */
      resolve: function resolve(path) {
        var dynamic = this._getDynamic();

        if (path != null) {
          path = this._preprocess(path);
        }

        return dynamic[path] || path;
      },

      /**
       * Get registered aliases
       *
       * @return {Map} the map of the currently registered alias:resolution pairs
       */
      getAliases: function getAliases() {
        var res = {};
        for (var key in this.__aliases) {
          res[key] = this.__aliases[key];
        }
        return res;
      }
    }
  });
  qx.util.AliasManager.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=AliasManager.js.map?dt=1544616859536