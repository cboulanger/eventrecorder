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
 * @require(cboulanger.eventrecorder.player.*)
 * @require(cboulanger.eventrecorder.InfoPane)
 * @require(qookery.ace.internal.AceComponent)
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.uicontroller.Application", {
  extend: qx.application.Standalone,
  include: [
    cboulanger.eventrecorder.MState,
    cboulanger.eventrecorder.uicontroller.MUiController,
    cboulanger.eventrecorder.editor.MEditor
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
      let datasource = new qx.io.remote.NetworkDataSource();
      let ctlr = new qx.io.remote.NetworkController(datasource);
      let endpoint = new qx.io.remote.WindowEndPoint(ctlr, window.opener);
      datasource.addEndPoint(endpoint);
      endpoint.open()
        .then( async ()=> {
          let state = ctlr.getUriMapping("state");
          this.setState(state);
          console.warn("Initiated connection with the main window!");
          console.log(state);

          this._setupAliases();
          await this._setupUi();
          await this._setupAutocomplete();
          state.addListener("changeObjectIds", () => this._setupAutocomplete());
        });
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
      vbox.add(await this._createEditor(), {flex:1});
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
