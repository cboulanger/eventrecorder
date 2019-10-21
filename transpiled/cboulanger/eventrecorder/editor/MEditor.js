(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Mixin": {
        "usage": "dynamic",
        "require": true
      },
      "qxl.dialog.Dialog": {},
      "qx.event.Timer": {},
      "qx.Interface": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

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
   * This mixin contains methods that are used by script editor widgets
   * @ignore(ace)
   */
  qx.Mixin.define("cboulanger.eventrecorder.editor.MEditor", {
    members: {
      __players: null,

      /**
       * Returns the editor component
       * @return {qookery.IFormComponent}
       */
      getEditorObject() {
        return this.getQxObject("editor");
      },

      /**
       * Translates the text in the left editor into the language produced by the
       * given player type. Alerts any errors that occur.
       * @param playerType {String}
       * @param mode {String}
       * @return {String|false}
       */
      async translateTo(playerType, mode) {
        const exporter = this.getPlayerByType(playerType);
        const model = this.getQxObject("editor").getModel();

        if (mode) {
          exporter.setMode(mode);
        }

        let editedScript = model.getLeftEditorContent();

        try {
          let translatedText = await exporter.translate(editedScript);
          model.setRightEditorContent(translatedText);
          return translatedText;
        } catch (e) {
          this.error(e);
          qxl.dialog.Dialog.error(e.message);
        }

        return false;
      },

      /**
       * Export the script in the given format
       * @param playerType {String}
       * @param mode {String}
       * @return {Boolean}
       */
      async exportTo(playerType, mode) {
        const exporter = this.getPlayerByType(playerType);

        if (mode) {
          exporter.setMode(mode);
        }

        let translatedScript = this.getQxObject("editor").getModel().getRightEditorContent();

        if (!translatedScript) {
          if (!this.getScript()) {
            qxl.dialog.Dialog.error("No script to export!");
            return false;
          }

          translatedScript = await this.translateTo(playerType);
        }

        qx.event.Timer.once(() => {
          let filename = this._getApplicationName();

          this._download("".concat(filename, ".").concat(exporter.getExportFileExtension()), translatedScript);
        }, null, 0);
        return true;
      },

      _applyPlayerType(playerType, old) {
        if (old) {
          old = this.getPlayerByType(old);
        }

        this.setPlayer(this.getPlayerByType(playerType));
      },

      _applyPlayer(player, old) {
        if (old) {
          old.removeAllBindings();
          formModel.removeAllBindings();
        }

        if (!player) {
          return;
        }

        if (!this.getEditorObject()) {
          console.debug("Cannot apply player since editor is not ready..."); // editor hasn't been loaded and rendered yet

          return;
        }

        const formModel = this.getEditorObject().getModel();
        formModel.bind("targetMode", player, "mode");
        player.bind("mode", formModel, "targetMode");
        formModel.setTargetScriptType(player.getType());
      },

      __initializedEditor: false,

      _updateEditor() {
        try {
          this.getEditorObject().getModel().setLeftEditorContent(this.getScript());
          const leftEditor = this.getEditorObject().getComponent("leftEditor").getEditor();
          leftEditor.resize(); // the following should not be necessary

          if (!this.__initializedEditor) {
            leftEditor.getSession().on("change", () => {
              if (leftEditor.getValue() !== this.getScript()) {
                this.setScript(leftEditor.getValue());
              }
            });
            this.__initializedEditor = true;
          }
        } catch (e) {
          //console.warn(e.message);
          console.debug("Waiting for ACE editor to become available...");
          qx.event.Timer.once(() => this._updateEditor(), this, 500);
        }
      },

      /**
       * Configures the autocomplete feature in the editor(s)
       * @private
       */
      _setupAutocomplete() {
        let langTools;

        try {
          langTools = ace.require("ace/ext/language_tools");

          if (!langTools) {
            throw new Error("language_tools not available");
          }
        } catch (e) {
          console.log("Deferring setup of autocomplete...");
          qx.event.Timer.once(() => this._setupAutocomplete(), this, 1000);
          return;
        }

        let tokens = [];
        let iface = qx.Interface.getByName("cboulanger.eventrecorder.IPlayer").$$members;

        for (let key of Object.getOwnPropertyNames(iface)) {
          if (key.startsWith("cmd_") && typeof iface[key] == "function") {
            let code = iface[key].toString();
            let params = code.slice(code.indexOf("(") + 1, code.indexOf(")")).split(/,/).map(p => p.trim());
            let caption = key.substr(4).replace(/_/g, "-");
            let snippet = caption + " " + params.map((p, i) => "${".concat(i + 1, ":").concat(p, "}")).join(" ") + "\$0";
            let meta = params.join(" ");
            let value = null;
            tokens.push({
              caption,
              type: "command",
              snippet,
              meta,
              value
            });
          }
        }

        for (let id of this.getObjectIds()) {
          tokens.push({
            caption: id,
            type: "id",
            value: id
          });
        }

        const completer = {
          getCompletions: (editor, session, pos, prefix, callback) => {
            if (prefix.length === 0) {
              callback(null, []);
              return;
            }

            let line = editor.session.getLine(pos.row).substr(0, pos.column);
            let numberOfTokens = this.tokenize(line).length;
            let options = tokens // filter on positional argument
            .filter(token => token.type === "command" && numberOfTokens === 1 || token.type === "id" && numberOfTokens === 2) // filter on word match
            .filter(token => token.caption.toLocaleLowerCase().substr(0, prefix.length) === prefix.toLocaleLowerCase()) // create popup data
            .map(token => {
              token.score = 100 - (token.caption.length - prefix.length);
              return token;
            });
            callback(null, options);
          }
        };
        langTools.addCompleter(completer);
      }

    }
  });
  cboulanger.eventrecorder.editor.MEditor.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=MEditor.js.map?dt=1571643406018