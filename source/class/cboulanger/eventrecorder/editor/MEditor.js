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

    /**
     * create the editor and add it to the given container with a flex of 1.
     * @return {qx.ui.core.Widget}
     * @private
     */
    async _createEditor() {
      let control;
      const formUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml");
      const formComponent = await cboulanger.eventrecorder.Utils.createQookeryComponent(formUrl);
      this.addOwnedQxObject(formComponent, "editor");
      const editorWidget = formComponent.getMainWidget();
      editorWidget.addListener("appear", this._updateEditor, this);
      editorWidget.set({allowStretchX: true, allowStretchY: true});
      // bind to state
      const formModel = formComponent.getModel();
      this.getState().bind("script", formModel, "leftEditorContent");
      formModel.bind("leftEditorContent", this.getState(), "script");
      // re-translate when parameters change
      formModel.addListener("changeTargetScriptType", () => this.__translate());
      formModel.addListener("changeTargetMode", () => this.__translate());
      return editorWidget;
    },

    /**
     * Returns the editor component
     * @return {qookery.IFormComponent}
     */
    getEditorObject() {
      return this.getQxObject("editor");
    },

    async __translate() {
      const formModel = this.getEditorObject().getModel();
      const playerType = formModel.getTargetScriptType();
      const targetMode = formModel.getTargetMode();
      this.translateTo(playerType, targetMode);
    },

    /**
     * Translates the text in the left editor into the language produced by the
     * given player type. Alerts any errors that occur.
     * @param playerType {String}
     * @param mode {String}
     * @return {String|false}
     */
    async translateTo(playerType, mode) {
      const exporter = cboulanger.eventrecorder.Utils.getPlayerByType(playerType);
      const model = this.getEditorObject().getModel();
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
      const exporter = cboulanger.eventrecorder.Utils.getPlayerByType(playerType);
      if (mode) {
        exporter.setMode(mode);
      }
      let translatedScript = this.getEditorObject().getModel().getRightEditorContent();
      if (!translatedScript) {
        if (!this.getState().getScript()) {
          qxl.dialog.Dialog.error("No script to export!");
          return false;
        }
        translatedScript = await this.translateTo(playerType);
      }
      qx.event.Timer.once(() => {
        let filename = this.getApplicationName();
        this._download(`${filename}.${exporter.getExportFileExtension()}`, translatedScript);
      }, null, 0);
      return true;
    },

    __initializedEditor: false,

    /**
     * Updates the editor content with the recorded script
     * @private
     */
    _updateEditor() {
      try {
        this.getEditorObject().getModel().setLeftEditorContent(this.getState().getScript());
        const leftEditor = this.getEditorObject().getComponent("leftEditor").getEditor();
        leftEditor.resize();
        // the following should not be necessary
        if (!this.__initializedEditor) {
          leftEditor.getSession().on("change", () => {
            if (leftEditor.getValue() !== this.getState().getScript()) {
              this.getState().setScript(leftEditor.getValue());
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
     * Configures the autocomplete feature in the editor
     * @private
     */
    _setupAutocomplete() {
      let  langTools = ace.require("ace/ext/language_tools");
      if (!langTools) {
        throw new Error("language_tools not available");
      }

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
      for (let id of this.getState().getObjectIds()) {
        tokens.push({caption: id, type: "id", value: id});
      }
      const completer = {
        getCompletions:  (editor, session, pos, prefix, callback) => {
          if (prefix.length === 0) {
            callback(null, []);
            return;
          }
          let line = editor.session.getLine(pos.row).substr(0, pos.column);
          let numberOfTokens = this.tokenize(line).length;
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
    }
  }
});
