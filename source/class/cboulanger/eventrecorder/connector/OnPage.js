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
 * Displays the eventrecorder UI in the app itself
 * @asset(cboulanger/eventrecorder/*)
 * @asset(qxl/dialog/*)
 * @require(cboulanger.eventrecorder.player.Testcafe)
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.connector.OnPage", {
  extend: qx.ui.window.Window,
  include: [
    cboulanger.eventrecorder.State,
    cboulanger.eventrecorder.editor.MEditor,
    cboulanger.eventrecorder.uicontroller.MUiController,
    cboulanger.eventrecorder.MHelperMethods
  ],

  properties: {
    /**
     * The recording/playback engine
     */
    engine: {
      check: "cboulanger.eventrecorder.Engine"
    }
  },

  /**
   * Constructor
   * @param caption {String} The caption of the window. Will be used to create
   * an object id.
   * @ignore(caption)
   */
  construct: function(caption="Event Recorder") {
    this.base(arguments);

    this._setupAliases();
    this.set({
      caption,
      modal: false,
      showMinimize: false,
      showMaximize: false,
      height: 90,
      layout: new qx.ui.layout.HBox(5),
      allowGrowX: false,
      allowGrowY: false
    });

    // assign id to this widget from caption
    const objectId = caption.replace(/ /g, "").toLocaleLowerCase();
    this.setQxObjectId(objectId);
    qx.core.Id.getInstance().register(this, objectId);

    // do not record events for this widget unless explicitly requested
    if (!engine.getScriptable()) {
      engine.getRecorder().excludeIds(objectId);
    }
    engine.addListener("changePlayer", e => {
      this._applyPlayer(e.getData(), e.getOldData());
    });

    this._setupControllerUi();
  },

  /**
   * The methods and simple properties of this class
   */
  members:
  {
    _setupControllerUi () {
      // this creates the buttons in this order and adds them to the window
      this.add(this.getChildControl("load"))
      .add(this.getChildControl("replay"))
      .add(this.getChildControl("record"))
      .add(this.getChildControl("stop"))
      .add(this.getChildControl("edit"))
      .add(this.getChildControl("save"));

      // create bindings to engine
      const engine = this.getEngine();
      // caption
      engine.bind("recorder.running", this, "caption", {
        converter: v => v ? "Recording ..." : this.getCaption()
      });
      engine.bind("player.running", this, "caption", {
        converter: v => v ? "Replaying ..." : this.getCaption()
      });
/*
      // show replay button only if player is attached and if it can replay a script in the browser
      engine.bind("player", control, "visibility", {
        converter: player => Boolean(player) && player.getCanReplayInBrowser() ? "visible" : "excluded"
      });
      engine.bind("recorder.running", control, "enabled", {
        converter: v => !v
      });
      engine.bind("player.running", control, "value");

      // record button
      const recorder = engine.getRecorder();
      engine.bind("mode", control, "enabled", {
        converter: v => v === "recorder"
      });
 */
    }

  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function() {
    if (!qx.core.Environment.get("module.objectid") || !qx.core.Environment.get("eventrecorder.enabled")) {
      console.info("Event recorder is disabled.");
      return;
    }
    qookery.Qookery.setOption(
      qookery.Qookery.OPTION_EXTERNAL_LIBRARIES,
      qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/js"));
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
      let uicontroller = new cboulanger.eventrecorder.connector.OnPage("Event Recorder");
      if (!qx.core.Environment.get("eventrecorder.hidden")) {
        uicontroller.show();
      }
    });
  }
});
