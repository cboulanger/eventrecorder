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
 * The UI Controller for the recorder
 * @asset(cboulanger/eventrecorder/*)
 * @asset(qxl/dialog/*)
 * @require(cboulanger.eventrecorder.player.Testcafe)
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.uicontroller.OnPage", {
  extend: qx.ui.window.Window,
  include: [
    cboulanger.eventrecorder.MHelperMethods,
    cboulanger.eventrecorder.editor.MEditor,
    cboulanger.eventrecorder.uicontroller.MUiController
  ],

  properties: {

    engine: {
      check: "cboulanger.eventrecorder.Engine"
    }

  },

  /**
   * Constructor
   * @param caption {String} The caption of the window. Will be used to create
   * an object id.
   * @param engine {cboulanger.eventrecorder.Engine}
   * @ignore(caption)
   */
  construct: function(caption="Event Recorder", engine) {
    this.base(arguments);
    this.setEngine(engine);
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

    this._setupUi();
  },

  /**
   * The methods and simple properties of this class
   */
  members:
  {

    /**
     * Internal method to create child controls
     * @param id
     * @return {qx.ui.core.Widget}
     * @private
     */
    _createChildControlImpl(id) {
      let control;
      switch (id) {
        /**
         * Load Button
         */
        case "load": {
          const engine = this.getEngine();
          let loadMenu = new qx.ui.menu.Menu();
          let loadUserGistButton = new qx.ui.menu.Button("Load user gist");
          loadUserGistButton.addListener("execute", engine.loadUserGist, engine);
          loadUserGistButton.setQxObjectId("fromUserGist");
          loadMenu.add(loadUserGistButton);
          let loadGistByIdButton = new qx.ui.menu.Button("Load gist by id");
          loadGistByIdButton.addListener("execute", engine.loadGistById, engine);
          loadGistByIdButton.setQxObjectId("fromGistById");
          loadMenu.add(loadGistByIdButton);
          control = new qx.ui.form.SplitButton();
          control.set({
            enabled: false,
            icon:"eventrecorder.icon.load",
            toolTipText: "Load script",
            menu: loadMenu
          });
          control.addOwnedQxObject(loadUserGistButton);
          control.addOwnedQxObject(loadGistByIdButton);
          control.addListener("execute", engine.load, engine);
          // enable load button only if player can replay scripts in the browser
          engine.bind("recorder.running", control, "enabled", {
            converter: v => !v
          });
          break;
        }
        /**
         * Replay button
         */
        case "replay": {
          const engine = this.getEngine();
          control = new cboulanger.eventrecorder.SplitToggleButton();
          let replayMenu = new qx.ui.menu.Menu();
          control.addOwnedQxObject(replayMenu, "menu");
          let macroButton = new qx.ui.menu.Button("Macros");
          replayMenu.add(macroButton);
          replayMenu.addOwnedQxObject(macroButton, "macros");
          let macroMenu = new qx.ui.menu.Menu();
          macroButton.setMenu(macroMenu);
          macroButton.addOwnedQxObject(macroMenu, "menu");
          engine.addListener("changePlayer", () => {
            let player = engine.getPlayer();
            if (!player) {
              return;
            }
            player.addListener("changeMacros", () => {
              this._updateMacroMenu();
              player.getMacros().getNames().addListener("change", this._updateMacroMenu, this);
            });
          });

          replayMenu.addSeparator();
          replayMenu.add(new qx.ui.menu.Button("Options:"));
          let optionReload = new qx.ui.menu.CheckBox("Reload page before replay");
          engine.bind("reloadBeforeReplay", optionReload, "value");
          optionReload.bind("value", engine, "reloadBeforeReplay");
          replayMenu.add(optionReload);
          control.addListener("execute", engine._startReplay, engine);
          control.set({
            enabled: false,
            icon:"eventrecorder.icon.start",
            toolTipText: "Replay script",
            menu: replayMenu
          });
          // show replay button only if player is attached and if it can replay a script in the browser
          engine.bind("player", control, "visibility", {
            converter: player => Boolean(player) && player.getCanReplayInBrowser() ? "visible" : "excluded"
          });
          engine.bind("recorder.running", control, "enabled", {
            converter: v => !v
          });
          engine.bind("player.running", control, "value");
          break;
        }
        /**
         * Record Button
         */
        case "record": {
          const engine = this.getEngine();
          const recorder = engine.getRecorder();
          let recordMenu = new qx.ui.menu.Menu();
          recordMenu.add(new qx.ui.menu.Button("Options:"));
          let debugEvents = new qx.ui.menu.CheckBox("Log event data");
          debugEvents.bind("value", engine, "recorder.logEvents");
          recordMenu.add(debugEvents);
          control = new cboulanger.eventrecorder.SplitToggleButton();
          control.setIcon("eventrecorder.icon.record");
          control.setMenu(recordMenu);
          control.addListener("changeValue", this._toggleRecord, this);
          recorder.bind("running", control, "value");
          recorder.bind("running", control, "enabled", {
            converter: v => !v
          });
          engine.bind("mode", control, "enabled", {
            converter: v => v === "recorder"
          });
          break;
        }
        /**
         * Stop Button
         */
        case "stop": {
          const engine = this.getEngine();
          control = new qx.ui.form.Button();
          control.set({
            enabled: false,
            icon: "eventrecorder.icon.stop",
            toolTipText: "Stop recording"
          });
          control.addListener("execute", engine.stop, engine);
          break;
        }
        /**
         * Edit Button
         */
        case "edit": {
          const engine = this.getEngine();
          let editMenu = new qx.ui.menu.Menu();
          let qxWinBtn = new qx.ui.menu.Button("Open editor in this window");
          qxWinBtn.addListener("execute", () => engine.edit("inside"));
          editMenu.add(qxWinBtn);
          let nativeWinBtn = new qx.ui.menu.Button("Open editor in browser window");
          nativeWinBtn.addListener("execute", () => engine.edit("outside"));
          editMenu.add(nativeWinBtn);
          control = new qx.ui.form.SplitButton();
          control.set({
            enabled: true,
            icon:"eventrecorder.icon.edit",
            toolTipText: "Edit script",
            menu: editMenu
          });
          control.addOwnedQxObject(editMenu,"menu");
          control.addListener("execute", () => engine.edit());
          engine.bind("recorder.running", control, "enabled", {
            converter: v => !v
          });
          // engine.bind("script", editButton, "enabled", {
          //   converter: v => Boolean(v)
          // });
          break;
        }

        /**
         * Save Button
         */
        case "save": {
          const engine = this.getEngine();
          control = new qx.ui.form.Button();
          control.set({
            enabled: false,
            icon:"eventrecorder.icon.save",
            toolTipText: "Save script"
          });
          control.addListener("execute", engine.save, engine);
          engine.bind("recorder.running", control, "enabled", {
            converter: v => !v
          });
          break;
        }
      }
      if (control) {
        // assign object id
        this.addOwnedQxObject(control, id);
      } else {
        control = this.base(arguments, id);
      }
      return control;
    }
  }
});
