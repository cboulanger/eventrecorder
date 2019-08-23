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
 */
qx.Mixin.define("cboulanger.eventrecorder.MEditor", {
  members: {

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
        this._download(`${filename}.${exporter.getExportFileExtension()}`, translatedScript);
      }, null, 0);
      return true;
    },

    /**
     * Returns the editor component
     * @return {qookery.IFormComponent}
     */
    getEditor() {
      return this.getQxObject("editor");
    },

    _applyPlayerType(playerType, old) {
      if (old) {
        old = this.getPlayerByType(old);
      }
      const player = this.getPlayerByType(playerType);
      this._applyPlayer(player, old);
    },

    _applyPlayer(player, old){
      if (!this.getEditor()) {
        // editor hasn't been loaded and rendered yet
        return;
      }
      const formModel = this.getEditor().getModel();
      if (old) {
        old.removeAllBindings();
        formModel.removeAllBindings();
      }
      formModel.bind("targetMode", player, "mode");
      player.bind("mode", formModel, "targetMode");
      formModel.setTargetScriptType(playerType);
      console.warn("window.ace :" + window.ace);
      if (window.ace) {
        this._setupAutocomplete(player);
      }
    },

    _onEditorAppear() {
      if (this.getPlayer()){
        this._setupAutocomplete(this.getPlayer());
      }
      this.getEditor().getModel().setLeftEditorContent(this.getScript());
    },

    /**
     * Configures the autocomplete feature in the editor(s) for the given
     * player. This will only be done once for each player.
     * The question is if we allow a different set of commands for each player
     * or if the definitive list of commands should be defined by the player
     * interface.
     * @param player {cboulanger.eventrecorder.IPlayer}
     * @private
     */
    _setupAutocomplete(player) {
      if (player._autocomplete) {
        // autocomplete has already been set up for this player
        return;
      }
      if (window.ace === undefined) {
        return qx.event.Timer.once(() => this._setupAutocomplete(player), this, 1000);
      }
      const langTools = ace.require("ace/ext/language_tools");
      let tokens = [];
      let iface = qx.Interface.getByName("cboulanger.eventrecorder.IPlayer").$$members;
      for (let key of Object.getOwnPropertyNames(iface)) {
        if (key.startsWith("cmd_") && typeof iface[key] == "function") {
          let code = iface[key].toString();
          let params = code.slice(code.indexOf("(") + 1, code.indexOf(")")).split(/,/).map(p => p.trim());
          let caption = key.substr(4).replace(/_/g, "-");
          let snippet = caption + " " + params.map((p, i) => `\${${i + 1}:${p}}`).join(" ") + "\$0";
          let meta = params.join(" ");
          let value = null;
          tokens.push({caption, type: "command", snippet, meta, value});
        }
      }
      let ids = [];
      let traverseObjectTree = function (obj) {
        if (typeof obj.getQxObjectId !== "function") {
          return;
        }
        let id = obj.getQxObjectId();
        if (id) {
          ids.push(qx.core.Id.getAbsoluteIdOf(obj));
        }
        for (let owned of obj.getOwnedQxObjects()) {
          traverseObjectTree(owned);
        }
      };
      let registeredObjects = Object.values(qx.core.Id.getInstance().getRegisteredObjects());
      for (let obj of registeredObjects) {
        traverseObjectTree(obj);
      }
      for (let id of ids) {
        tokens.push({caption: id, type: "id", value: id});
      }
      const completer = {
        getCompletions: function (editor, session, pos, prefix, callback) {
          if (prefix.length === 0) {
            callback(null, []);
            return;
          }
          let line = editor.session.getLine(pos.row).substr(0, pos.column);
          let numberOfTokens = player._tokenize(line).length;
          let options = tokens
          // filter on positional argument
            .filter(token => (token.type === "command" && numberOfTokens === 1) || (token.type === "id" && numberOfTokens === 2))
            // filter on word match
            .filter(token => token.caption.toLocaleLowerCase().substr(0, prefix.length) === prefix.toLocaleLowerCase())
            // create popup data
            .map(token => {
              token.score = 100 - (token.caption.length - prefix.length);
              return token;
            });
          callback(null, options);
        }
      };
      langTools.addCompleter(completer);
      player._autocomplete = true;
    }
  }
});
