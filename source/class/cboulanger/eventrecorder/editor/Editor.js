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
 * The editor class
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.editor.Editor", {
  extend: qx.core.Object,

  /**
   * @param {qx.application.Standalone} app
   */
  construct: function(app) {
    this.base(arguments);
    this.__app = app;
  },

  members: {

    __app: null,
    __formComponent: null,

    /**
     * Initializes the editor, this waits for all needed components to be
     * loaded
     * @return {Promise<void>}
     */
    async init() {
      await cboulanger.eventrecorder.Utils.conditionalTimeout(() => window.ace && ace.require("ace/ext/language_tools"));
    },

    /**
     * create the editor and add it to the given container with a flex of 1.
     * @return {qx.ui.core.Widget}
     * @private
     */
    async createWidget() {
      let control;
      const formUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml");
      const formComponent = this.__formComponent = await cboulanger.eventrecorder.Utils.createQookeryComponent(formUrl);
      const editorWidget = formComponent.getMainWidget();
      editorWidget.addListener("appear", () => this.update());
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
     * Updates the editor content with the recorded script
     * @private
     */
    update() {
      this.getModel().setLeftEditorContent(this.getState().getScript());
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
    },

    /**
     * Proxy method to get the state of the app
     * @return {cboulanger.eventrecorder.State}
     */
    getState() {
      return this.__app.getState();
    },

    /**
     * Returns the editor component
     * @return {qookery.IFormComponent}
     */
    getEditorObject() {
      return this.__formComponent;
    },

    /**
     * Returns the qookery form model
     * @return {qx.core.Object}
     */
    getModel() {
      return this.__formComponent.getModel();
    },

    async __translate() {
      const formModel = this.getModel();
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
      const model = this.getModel();
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
      let translatedScript = this.getModel().getRightEditorContent();
      if (!translatedScript) {
        if (!this.getState().getScript()) {
          qxl.dialog.Dialog.error("No script to export!");
          return false;
        }
        translatedScript = await this.translateTo(playerType);
      }
      qx.event.Timer.once(() => {
        let filename = this.getState().getApplicationName();
        cboulanger.eventrecorder.Utils.download(`${filename}.${exporter.getExportFileExtension()}`, translatedScript);
      }, null, 0);
      return true;
    },

    __initializedEditor: false,



    /**
     * Configures the autocomplete feature in the editor
     * @private
     */
    async setupAutocomplete() {
      let langTools = ace.require("ace/ext/language_tools");
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
