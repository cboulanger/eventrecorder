/* ************************************************************************

  UI Event Recorder

  Copyright:
    2019 Christian Boulanger

  License:
    MIT license
    See the LICENSE file in the project's top-level directory for details.

  Authors: Christian Boulanger


************************************************************************ */

/**
 * The UI Controller for the recorder in its own window, including the script editor
 * @asset(cboulanger/eventrecorder/*)
 * @asset(qxl/dialog/*)
 * @require(cboulanger.eventrecorder.InfoPane)
 * @require(cboulanger.eventrecorder.player.*)
 * @require(qookery.ace.internal.AceComponent)
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.uicontroller.Application", {
  extend: qx.application.Standalone,
  include: [
    cboulanger.eventrecorder.MState,
    cboulanger.eventrecorder.uicontroller.MUiController,
  ],

  members:
  {
    /**
     * Application startup method
     */
    main() {
      this.base(arguments);
      if (qx.core.Environment.get("qx.debug")) {
        qx.log.appender.Native;
      }

      if (!window.opener) {
        let msg = "The event recorder cannot be used as a standalone application yet. Please add \"cboulanger.eventrecorder.uicontroller.NativeWindow\" in your compile.json's application \"include\" config.";
        this.alert(msg);
        return;
      }
      const debug = true;
      if (debug) {
        let btn = new qx.ui.form.Button("Start");
        btn.addListener("execute", () => {
          this.getRoot().remove(btn);
          this._main();
        });
        this.getRoot().add(btn, {left:10, top: 10});
      } else {
        this._main();
      }
    },

    async _main() {
      let datasource = new qx.io.remote.NetworkDataSource();
      let ctlr = new qx.io.remote.NetworkController(datasource);
      let endpoint = new qx.io.remote.WindowEndPoint(ctlr, window.opener);
      datasource.addEndPoint(endpoint);
      await endpoint.open();
      let state = ctlr.getUriMapping("state");
      this.setState(state);
      this.info("Initiated connection with the main window!");
      this._setupAliases();
      await this._setupUi();
      this.info("Created UI");
      await this._setupAutocomplete();
      this.info("Autocomplete setup done.");
      state.addListener("changeObjectIds", () => this._setupAutocomplete());
    },

    async _setupUi() {
      let vbox = new qx.ui.container.Composite(new qx.ui.layout.VBox());
      let toolBar = new qx.ui.toolbar.ToolBar();
      toolBar.set({
        spacing: 5
      });
      toolBar.add(this._createChildControlImpl("load"));
      toolBar.add(this._createChildControlImpl("play"));
      toolBar.add(this._createChildControlImpl("record"));
      toolBar.add(this._createChildControlImpl("stop"));
      toolBar.add(this._createChildControlImpl("save"));
      vbox.add(toolBar);
      const editor = new cboulanger.eventrecorder.editor.Editor(this);
      this.addOwnedQxObject(editor, "editor");
      await editor.init();
      vbox.add(await editor.createWidget(), {flex:1});
      this.getRoot().add(vbox, {edge:0});
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function() {
    let qookeryExternalLibsUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/js");
    qookery.Qookery.setOption(qookery.Qookery.OPTION_EXTERNAL_LIBRARIES, qookeryExternalLibsUrl);
  }

});
