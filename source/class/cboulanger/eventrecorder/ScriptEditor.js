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
 * The Script Editor running in a separate browser window
 * @asset(cboulanger/eventrecorder/*)
 * @asset(dialog/*)
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.ScriptEditor", {
  extend: qx.application.Standalone,
  include: [
    cboulanger.eventrecorder.MHelperMethods,
    cboulanger.eventrecorder.MEditor
  ],

  properties: {

    /**
     * The window with the UI controller
     */
    controllerWindow: {
      check: "Window",
      event: "changeControllerWindow",
    },

    /**
     * The script in the editor
     */
    script: {
      check: "String",
      event: "changeScript",
      nullable: true,
      apply: "_applyScript",
      init: null
    },

    /**
     * The type of the script player
     */
    playerType: {
      check: "String",
      event: "changePlayerType",
      init: "qooxdoo",
      apply: "_applyPlayerType"
    },

    /**
     * The object ids defined in the recorded application
     */
    objectIds: {
      check: "Array",
      event: "changeObjectIds"
    }
  },

  members: {

    __lastData: null,

    main() {
      this.base(arguments);
      if (qx.core.Environment.get("qx.debug")) {
        qx.log.appender.Native;
      }

      this.set({
        objectIds: []
      });
      this.__lastData = {};

      // establish communication with the window
      if (!window.opener) {
        alert("This application works only if opened from the main application.");
        return;
      }
      this.setControllerWindow(window.opener);
      window.addEventListener("message", e => {
        console.debug(">>> Message received:");
        console.debug(e.data);
        this.__lastData = e.data;
        if (e.source !== this.getControllerWindow()) {
          this.warn("Ignoring message from unknown source!");
          return;
        }
        this.set(e.data);
      });

      this.addListenerOnce("changeObjectIds", this._setupAutocomplete, this);

      const formUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml");
      this.createQookeryComponent(formUrl)
      .then(formComponent => {
        this.addOwnedQxObject(formComponent, "editor");
        const editorWidget = formComponent.getMainWidget();
        editorWidget.addListener("appear", this._updateEditor, this);
        editorWidget.set({allowStretchX:true, allowStretchY:true});
        this.getRoot().add(editorWidget, {edge: 0});
        const formModel = formComponent.getModel();
        this.bind("script", formModel, "leftEditorContent");
        formModel.bind("leftEditorContent", this, "script");
        formModel.addListener("changeTargetScriptType", this.__translate, this);
        formModel.addListener("changeTargetMode", this.__translate, this);
      });
    },

    getPlayer() {
      return this.getPlayerByType(this.getPlayerType());
    },

    _applyScript(script, old) {
      if (old === null && script !== null)  {
        // do not re-transmit initial state
        return;
      }
      if ( this.__lastData.script === script) {
        // do not retransmit received script data
        return;
      }
      const data = {script};
      this.getControllerWindow().postMessage(data, "*");
      console.debug(">>> Message sent:");
      console.debug(data);
    },

    async __translate() {
      const formModel = this.getQxObject("editor").getModel();
      const playerType = formModel.getTargetScriptType();
      const targetMode = formModel.getTargetMode();
      this.translateTo(playerType, targetMode);
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function () {
    if (!qx.core.Environment.get("module.objectid") || !qx.core.Environment.get("eventrecorder.enabled")) {
      return;
    }
    const externalLibraries = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/js");
    qookery.Qookery.setOption(qookery.Qookery.OPTION_EXTERNAL_LIBRARIES, externalLibraries);
  }
});
