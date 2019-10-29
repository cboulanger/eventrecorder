/* ************************************************************************

  UI Event Recorder

  Copyright:
    2018 Christian Boulanger

  License:
    MIT license
    See the LICENSE file in the project's top-level directory for details.

  Authors: Christian Boulanger


************************************************************************ */

/**
 * An unsystematic collection of methods that are re-used in more than one class
 * The methods really need to be put into domain-specific mixins or static classes
 * @deprecated
 */
qx.Mixin.define("cboulanger.eventrecorder.MHelperMethods", {

  members: {

    async createQookeryComponent(formUrl) {
      return new Promise((resolve, reject) => {
        qookery.contexts.Qookery.loadResource(formUrl, this, xmlSource => {
          const xmlDocument = qx.xml.Document.fromString(xmlSource);
          const parser = qookery.Qookery.createFormParser();
          try {
            const formComponent = parser.parseXmlDocument(xmlDocument);
            resolve(formComponent);
          } catch (e) {
            reject(e);
          } finally {
            parser.dispose();
          }
        });
      });
    },

    /**
     * Returns a map with object providing persistence
     * @return {{env: qx.core.Environment, storage: qx.bom.storage.Web, uri_params: {}}}
     * @private
     */
    _getPersistenceProviders() {
      return {
        env: qx.core.Environment,
        storage: qx.bom.storage.Web.getSession(),
        uri_params: qx.util.Uri.parseUri(window.location.href)
      };
    },

    /**
     * Get application parameters from from environment, which can be query params,
     * local storage, or qooxdoo environment variables
     * @private
     * @ignore(env)
     * @ignore(storage)
     * @ignore(uri_params)
     */
    _getParamsFromEnvironment() {
      let {env, storage, uri_params} = this._getPersistenceProviders();
      let script = storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.SCRIPT) || "";
      let autoplay = uri_params.queryKey.eventrecorder_autoplay ||
        storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.AUTOPLAY) ||
        env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.AUTOPLAY) ||
        false;
      let reloadBeforeReplay = storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.RELOAD_BEFORE_REPLAY);
      let gistId = uri_params.queryKey.eventrecorder_gist_id || env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.GIST_ID) || null;
      let scriptable = Boolean(uri_params.queryKey.eventrecorder_scriptable) || qx.core.Environment.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.SCRIPTABLE) || false;
      let playerType = uri_params.queryKey.eventrecorder_type || env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_TYPE) || "qooxdoo";
      let playerMode = uri_params.queryKey.eventrecorder_player_mode || storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_MODE) || env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_MODE) || "presentation";
      let info = {script, autoplay, reloadBeforeReplay, gistId, scriptable, scriptUrl : this._getScriptUrl(), playerType, playerMode };
      if (qx.core.Environment.get("qx.debug")) {
        this.log(info);
      }
      return info;
    },

    /**
     * Returns a player instance. Caches the result
     * @param type
     * @private
     * @return {cboulanger.eventrecorder.IPlayer}
     */
    getPlayerByType(type) {
      if (!type) {
        throw new Error("No player type given!");
      }
      if (!this.__players) {
        this.__players = [];
      }
      if (this.__players[type]) {
        return this.__players[type];
      }
      let Clazz = cboulanger.eventrecorder.player[qx.lang.String.firstUp(type)];
      if (!Clazz) {
        throw new Error(`A player of type '${type}' does not exist.`);
      }
      const player = new Clazz();
      this.__players[type] = player;
      return player;
    },

    getApplicationParentDir() {
      let uri = qx.util.Uri.parseUri(location.href);
      return `${uri.protocol}://${uri.authority}${uri.directory.split("/").slice(0, -2).join("/")}`;
    },

    /**
     * Get the content of a gist by its id
     * @param gist_id {String}
     * @return {Promise<*>}
     * @private
     */
    async getRawGist(gist_id) {
      return new Promise((resolve, reject) => {
        let url = `https://api.github.com/gists/${gist_id}`;
        let req = new qx.io.request.Jsonp(url);
        req.addListener("success", e => {
          let response = req.getResponse();
          if (!qx.lang.Type.isObject(response.data.files)) {
            reject(new Error("Unexpected response: " + JSON.stringify(response)));
          }
          let filenames = Object.getOwnPropertyNames(response.data.files);
          let file = response.data.files[filenames[0]];
          if (!file.filename.endsWith(".eventrecorder")) {
            reject(new Error("Gist is not an eventrecorder script"));
          }
          let script = file.content;
          resolve(script);
        });
        req.addListener("statusError", e => reject(new Error(e.getData())));
        req.send();
      });
    },

    /**
     * Add a function to the global event monitor.
     * @param fn {Function}
     */
    addGlobalEventListener(fn) {
      let evtMonitor = qx.event.Manager.getGlobalEventMonitor();
      qx.event.Manager.setGlobalEventMonitor(evtMonitor ? ((target, event) => {
        evtMonitor(target, event);
        fn(target, event);
      }) : fn);
    },

    /**
     * Returns the absolute id of the owned object with that id
     * @param domNode {Element}
     * @param id {String}
     * @returns {String}
     */
    absoluteIdOf: function (domNode, id) {
      return qx.core.Id.getAbsoluteIdOf(qx.ui.core.Widget.getWidgetByElement(domNode).getQxObject(id));
    },

    /**
     * Simple tokenizer which splits expressions separated by whitespace, but keeps
     * expressions in quotes (which can contain whitespace) together. Parses tokens
     * as JSON expressions, but accepts unquoted text as strings.
     * @param line {String}
     * @return {String[]}
     * @private
     */
    tokenize(line) {
      qx.core.Assert.assertString(line);
      let tokens = [];
      let token = "";
      let prevChar = "";
      let insideQuotes = false;
      for (let char of line.trim().split("")) {
        switch (char) {
          case "\"":
            insideQuotes = !insideQuotes;
            token += char;
            break;
          case " ":
            // add whitespace to token if inside quotes
            if (insideQuotes) {
              token += char;
              break;
            }
            // when outside quotes, whitespace is end of token
            if (prevChar !== " ") {
              // parse token as json expression or as a string if that fails
              try {
                token = JSON.parse(token);
              } catch (e) {
              }
              tokens.push(token);
              token = "";
            }
            break;
          default:
            token += char;
        }
        prevChar = char;
      }
      if (token.length) {
        try {
          token = JSON.parse(token);
        } catch (e) {
        }
        tokens.push(token);
      }
      return tokens;
    }
  }
});
