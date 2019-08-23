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
     * The recorded script
     */
    script: {
      check: "String",
      event: "changeScript",
      apply: "_applyScript",
      init: ""
    },

    playerType: {
      check: "String",
      event: "changePlayerType",
      init: "qooxdoo",
      apply: "_applyPlayerType"
    },

    /**
     * The window with the UI controller
     */
    controllerWindow: {
      check: "Window",
      event: "changeControllerWindow",
    },
  },

  members: {

    main() {
      this.base(arguments);
      if (qx.core.Environment.get("qx.debug")) {
        qx.log.appender.Native;
      }
      // establish communication with the window
      this.setControllerWindow(window.opener);
      window.addEventListener("message", e => {
        if (e.source === this.getControllerWindow()) {
          this.set(e.data);
        } else {
          throw new Error("Wrong message source!");
        }
      });
      const container = new qx.ui.container.Composite(new qx.ui.layout.Grow());
      this.getRoot().add(container);

      const formUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml");
      qookery.contexts.Qookery.loadResource(formUrl, this, xmlSource => {
        let xmlDocument = qx.xml.Document.fromString(xmlSource);
        let parser = qookery.Qookery.createFormParser();
        const formComponent = parser.parseXmlDocument(xmlDocument);
        this.addOwnedQxObject(formComponent, "editor");
        const editorWidget = formComponent.getMainWidget();
        editorWidget.addListener("appear", this._onEditorAppear, this);
        container.add(editorWidget);
        const formModel = formComponent.getModel();
        this.bind("script", formModel, "leftEditorContent");
        formModel.bind("leftEditorContent", this, "script");
        formModel.addListener("changeTargetScriptType", this.__translate, this);
        formModel.addListener("changeTargetMode", this.__translate, this);
        parser.dispose();
      });
    },

    getPlayer() {
      return this.getPlayerByType(this.getPlayerType());
    },

    _applyScript(script, old) {
      this.getControllerWindow().postMessage({script});
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
