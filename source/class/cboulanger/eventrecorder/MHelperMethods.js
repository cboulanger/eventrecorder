/* ************************************************************************

  UI Event Recorder

  Copyright:
    2018 Christian Boulanger

  License:
    MIT license
    See the LICENSE file in the project's top-level directory for details.

  Authors: Christian Boulanger


************************************************************************ */


qx.Mixin.define("cboulanger.eventrecorder.MHelperMethods", {
  members: {

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
      let prevChar="";
      let insideQuotes = false;
      for (let char of line.trim().split("")) {
        switch (char) {
          case "\"":
            insideQuotes=!insideQuotes;
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
              } catch (e) {}
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
        } catch (e) {}
        tokens.push(token);
      }
      return tokens;
    }
  }
});
