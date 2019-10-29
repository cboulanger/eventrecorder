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
 * Displays the eventrecorder UI in a native window external to the app
 * @asset(cboulanger/eventrecorder/*)
 * @asset(qxl/dialog/*)
 * @require(qx.io.persistence)
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.connector.NativeWindow", {
  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function() {
    if (!qx.core.Environment.get("module.objectid") || !qx.core.Environment.get("eventrecorder.enabled")) {
      console.info("Event recorder is disabled.");
      return;
    }
    // called when application is ready
    qx.bom.Lifecycle.onReady(async () => {
      let infoPane = cboulanger.eventrecorder.InfoPane.getInstance();
      infoPane.useIcon("waiting");
      infoPane.display("Initializing Event Recorder, please wait...");
      let displayedText = infoPane.getDisplayedText();
      // assign object ids if object id generator has been included
      if (qx.Class.isDefined("cboulanger.eventrecorder.ObjectIdGenerator")) {
        await new Promise(resolve => {
          const objIdGen = qx.Class.getByName("cboulanger.eventrecorder.ObjectIdGenerator").getInstance();
          objIdGen.addListenerOnce("done", resolve);
        });
      }

      // hide splash screen if it hasn't used by other code yet
      if (infoPane.getDisplayedText() === displayedText) {
        infoPane.hide();
      }
      // create ui controller
      let recorderWindow = new cboulanger.eventrecorder.window.NativeWindow("eventrecorder_application", {
        width: 500,
        height: 500
      });

      // Data source represents the transport (but is transport agnostic)
      let datasource = new qx.io.remote.NetworkDataSource();
      // Controller manages the objects and their serialisation across the DataSource
      let ctlr = new qx.io.remote.NetworkController(datasource);
      // Listener is specific to a given platform (postMessage, Xhr, etc)
      new qx.io.remote.WindowListener(ctlr);

      // create engine and initialize state
      const state = new cboulanger.eventrecorder.State();
      new cboulanger.eventrecorder.Engine(state);

      // make state sychronizable
      ctlr.putUriMapping("state", state);

    });
  }
});
