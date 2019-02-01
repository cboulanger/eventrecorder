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
 */
qx.Class.define("cboulanger.eventrecorder.UiController", {
  extend: qx.ui.window.Window,
  include: [cboulanger.eventrecorder.MLoadingPopup],

  statics: {
    LOCAL_STORAGE_KEY: "eventrecorder-script",
    FILE_INPUT_ID : "eventrecorder-fileupload",
    aliases: {
      "eventrecorder.icon.record":  "cboulanger/eventrecorder/media-record.png",
      "eventrecorder.icon.start":   "cboulanger/eventrecorder/media-playback-start.png",
      "eventrecorder.icon.pause":   "cboulanger/eventrecorder/media-playback-pause.png",
      "eventrecorder.icon.stop":    "cboulanger/eventrecorder/media-playback-stop.png",
      "eventrecorder.icon.save":    "cboulanger/eventrecorder/document-save.png",
      "eventrecorder.icon.load":    "cboulanger/eventrecorder/document-open.png",
      "eventrecorder.icon.export":  "cboulanger/eventrecorder/emblem-symbolic-link.png"
    }
  },

  properties: {
    /**
     * Current mode
     */
    mode: {
      check: ["player", "recorder"],
      event: "changeMode",
      init: "recorder",
      apply: "_applyMode"
    },

    /**
     * The recorder instance
     */
    recorder: {
      check: "cboulanger.eventrecorder.Recorder",
      event: "changeRecorder",
      nullable: true
    },

    /**
     * The player instance
     */
    player: {
      check: "cboulanger.eventrecorder.player.Abstract",
      event: "changePlayer",
      nullable: true
    },

    /**
     * The recorded script
     */
    script: {
      check: "String",
      nullable: true,
      event: "changeScript",
      apply: "_applyScript"
    }
  },

  /**
   * Constructor
   */
  construct: function(caption="Event Recorder") {
    this.base(arguments);

    // workaround until icon theme can be mixed into application theme
    const aliasMgr = qx.util.AliasManager.getInstance();
    const aliases = aliasMgr.getAliases();
    for (let [alias, base] of Object.entries(cboulanger.eventrecorder.UiController.aliases)) {
      if (!aliases[alias]) {
        aliasMgr.add(alias, base);
      }
    }

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

    const recorder = new cboulanger.eventrecorder.Recorder();
    this.setRecorder(recorder);

    // do not record events for this widget
    const objectId = this.toHashCode();
    this.setQxObjectId(objectId);
    recorder.excludeIds(objectId);

    // caption
    this.bind("recorder.running", this, "caption", {
      converter: v => v ? "Recording ..." : caption
    });
    this.bind("player.running", this, "caption", {
      converter: v => v ? "Replaying ..." : caption
    });

    // record button
    let recordButton = new qx.ui.form.ToggleButton();
    recordButton.setIcon("eventrecorder.icon.record");
    recordButton.addListener("changeValue", this._toggleRecord, this);
    recorder.bind("running", recordButton, "value");
    recorder.bind("running", recordButton, "enabled", {
      converter: v => !v
    });
    this.bind("mode", recordButton, "enabled", {
      converter: v => v === "recorder"
    });

    // stop button
    let stopButton = new qx.ui.form.Button();
    stopButton.set({
      enabled: false,
      icon: "eventrecorder.icon.stop",
      toolTipText: "Stop recording"
    });
    const stopButtonState = () => {
      stopButton.setEnabled(
        recorder.isRunning() || (Boolean(this.getPlayer()) && this.getPlayer().isRunning())
      );
    };
    recorder.addListener("changeRunning", stopButtonState);
    stopButton.addListener("execute", this._stop, this);

    // replay
    let replayButton = new qx.ui.form.ToggleButton();
    replayButton.addListener("changeValue", this._toggleReplay, this);
    replayButton.set({
      enabled: false,
      icon:"eventrecorder.icon.start",
      toolTipText: "Replay script"
    });
    // show replay button only if player is attached and if it can replay a script in the browser
    this.bind("player", replayButton, "visibility", {
      converter: player => Boolean(player) && player.getCanReplayInBrowser() ? "visible" : "excluded"
    });
    // enable replay button only if we have a script
    this.bind("script", replayButton, "enabled", {
      converter: script => Boolean(script)
    });

    // save button
    let saveButton = new qx.ui.form.Button();
    saveButton.set({
      enabled: false,
      icon:"eventrecorder.icon.save",
      toolTipText: "Save script"
    });
    saveButton.addListener("execute", this._save, this);
    // enable export button only if we have a script
    this.bind("script", saveButton, "enabled", {
      converter: v => Boolean(v)
    });

    // export button
    let exportButton = new qx.ui.form.Button();
    exportButton.set({
      enabled: false,
      visibility: "hidden",
      icon:"eventrecorder.icon.export",
      toolTipText: "Export script in the target format (such as JavaScript)"
    });
    exportButton.addListener("execute", this._export, this);
    // show export button only if a player is attached and if it can export code that runs outside of this app
    this.bind("player", exportButton, "visibility", {
      converter: player => Boolean(player) && player.getCanExportExecutableCode() ? "visible" : "excluded"
    });
    // enable export button only if we have a script
    this.bind("script", exportButton, "enabled", {
      converter: v => Boolean(v)
    });

    // load button
    let loadButton = new qx.ui.form.Button();
    loadButton.set({
      enabled: false,
      icon:"eventrecorder.icon.load",
      toolTipText: "Load script"
    });
    loadButton.addListener("execute", this._load, this);
    // enable load button only if player can replay scripts in the browser
    this.bind("player.canReplayInBrowser", loadButton, "enabled");

    // add button to parent
    this.add(loadButton);
    this.add(replayButton);
    this.add(recordButton);
    this.add(stopButton);
    this.add(saveButton);
    this.add(exportButton);

    // add events for new players
    this.addListener("changePlayer", e => {
      if (e.getData()) {
        this.getPlayer().addListener("changeRunning", stopButtonState);
      }
    });

    // form for file uploads
    var form = document.createElement("form");
    form.setAttribute("visibility", "hidden");
    document.body.appendChild(form);
    let input = document.createElement("input");
    input.setAttribute("id", cboulanger.eventrecorder.UiController.FILE_INPUT_ID);
    input.setAttribute("type", "file");
    input.setAttribute("name", "file");
    input.setAttribute("visibility", "hidden");
    form.appendChild(input);
  },

  /**
   * The methods and simple properties of this class
   */
  members:
  {

    _applyMode(value, old) {
      if (!this.getPlayer()) {
        throw new Error("Cannot switch to player mode: no player has been set");
      }
    },

    _applyScript(value, old) {
      this.debug(value);
    },

    _getStoredScript() {
      return qx.bom.storage.Web.getLocal().getItem(cboulanger.eventrecorder.UiController.LOCAL_STORAGE_KEY);
    },

    _storeScript() {
      qx.bom.storage.Web.getLocal().setItem(cboulanger.eventrecorder.UiController.LOCAL_STORAGE_KEY, this.getScript());
    },

    _hasStoredScript() {
      return Boolean(this._getStoredScript());
    },

    /**
     * Event handler
     * @param e
     */
    _toggleRecord(e) {
      if (e.getData()) {
        this.resetScript();
        this.getRecorder().start();
      }
    },

    _stop() {
      if (this.getRecorder().isRunning()) {
        this.getRecorder().stop();
        let script = this.getRecorder().getScript();
        this.setScript(script);
      }
      if (this.getPlayer() && this.getPlayer().isRunning()) {
        this.getPlayer().stop();
      }
    },

    _toggleReplay(e) {
      if (e.getData()) {
        // start
        if (this.getScript()) {
          // reload
          this._storeScript();
          window.location.reload();
        }
      }
    },

    _save() {
      let filename = prompt("Please enter the name of the file to save");
      if (!filename) {
       return;
      }
      this._download(filename + ".eventrecorder", this.getScript());
    },

    _export() {
      let filename = prompt("Please enter the name of the file to export");
      if (!filename) {
        return;
      }
      this._download(`${filename}.${this.getPlayer().getExportFileExtension()}`, this.getPlayer().translate(this.getScript()));
    },

    async _load() {
      try {
        let script = await this._upload();
        this.setScript(script);
      } catch (e) {
        alert(e.message);
      }
    },

    _download(filename, text) {
      var element = document.createElement("a");
      element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
      element.setAttribute("download", filename);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },

    async _upload() {
      return new Promise((resolve, reject) => {
        let input = document.getElementById(cboulanger.eventrecorder.UiController.FILE_INPUT_ID);
        input.addEventListener("change", e => {
          let file = e.target.files[0];
          if (!file.name.endsWith(".eventrecorder")) {
            reject(new Error("Not an eventrecorder script"));
          }
          let reader = new FileReader();
          reader.addEventListener("loadend", () => {
            resolve(reader.result);
          });
          reader.addEventListener("error", reject);
          reader.readAsText(file);
        });
        input.click();
      });
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function() {
    if (!qx.core.Environment.get("module.objectid") || !qx.core.Environment.get("eventrecorder.enabled")) {
     return;
    }
    qx.bom.Lifecycle.onReady(() => {
      let controller = new cboulanger.eventrecorder.UiController();
      controller.createPopup();
      controller.showPopup("Initializing Event Recorder, please wait...");
      const objIdGen = cboulanger.eventrecorder.ObjectIdGenerator.getInstance();
      objIdGen.addListenerOnce("done", async () => {
        controller.hidePopup();
        // show controller
        qx.core.Init.getApplication().getRoot().add(controller, {top:0, right:10});
        // add a player
        let player = new cboulanger.eventrecorder.player.Qooxdoo();
        controller.setPlayer(player);
        controller.show();

        let storedScript = qx.bom.storage.Web.getLocal().getItem(cboulanger.eventrecorder.UiController.LOCAL_STORAGE_KEY);
        if (!storedScript || storedScript.length===0) {
          return;
        }
        // replay
        controller.setScript(storedScript);
        controller.setMode("player");
        player.addListener("progress", e => {
          let [step, steps] = e.getData();
          controller.showPopup(`Replaying ... (${step}/${steps})`);
        });
        try {
          await player.replay(storedScript);
        } catch (e) {
          qx.core.Init.getApplication().error(e);
        }
        controller.hidePopup();
        qx.bom.storage.Web.getLocal().removeItem(cboulanger.eventrecorder.UiController.LOCAL_STORAGE_KEY);
        controller.setMode("recorder");
      });
    });
  }
});
