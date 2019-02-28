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
 * @require(cboulanger.eventrecorder.player.Testcafe)
 */
qx.Class.define("cboulanger.eventrecorder.UiController", {
  extend: qx.ui.window.Window,
  statics: {
    CONFIG_KEY : {
      SCRIPT:       "eventrecorder.script",
      PLAYER_TYPE:  "eventrecorder.player_type",
      PLAYER_MODE:  "eventrecorder.player_mode",
      GIST_ID:      "eventrecorder.gist_id",
      AUTOPLAY:     "eventrecorder.autoplay",
      SHOW_PROGRESS:"eventrecorder.show_progress"
    },
    FILE_INPUT_ID : "eventrecorder-fileupload",
    aliases: {
      "eventrecorder.icon.record":  "cboulanger/eventrecorder/media-record.png",
      "eventrecorder.icon.start":   "cboulanger/eventrecorder/media-playback-start.png",
      "eventrecorder.icon.pause":   "cboulanger/eventrecorder/media-playback-pause.png",
      "eventrecorder.icon.stop":    "cboulanger/eventrecorder/media-playback-stop.png",
      "eventrecorder.icon.edit":    "cboulanger/eventrecorder/document-properties.png",
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
      check: "cboulanger.eventrecorder.IPlayer",
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
    },

    /**
     * Whether the stored script should start playing after the
     * application loads
     */
    autoplay: {
      check: "Boolean",
      nullable: false,
      init: false,
      event: "changeAutoplay",
      apply: "_applyAutoplay"
    }
  },

  /**
   * Constructor
   * @param caption {String} The caption of the window. Will be used to create
   * an object id.
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

    this.__players = {};

    const uri_info = qx.util.Uri.parseUri(window.location.href);
    const recorder = new cboulanger.eventrecorder.Recorder();
    this.setRecorder(recorder);

    // assign id to this widget from caption
    const objectId = caption.replace(/ /g, "").toLocaleLowerCase();
    this.setQxObjectId(objectId);
    qx.core.Id.getInstance().register(this, objectId);

    // do not record events for this widget unless explicitly requested
    let scriptable = uri_info.queryKey.eventrecorder_scriptable || qx.core.Environment.get("eventrecorder.scriptable");
    if (!scriptable) {
      recorder.excludeIds(objectId);
    }

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
    stopButton.addListener("execute", this.stop, this);

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


    // edit button
    let editButton = new qx.ui.form.Button();
    editButton.set({
      enabled: true,
      icon:"eventrecorder.icon.edit",
      toolTipText: "Edit script"
    });
    editButton.addListener("execute", this.edit, this);
    // this.bind("script", editButton, "enabled", {
    //   converter: v => Boolean(v)
    // });

    // save button
    let saveButton = new qx.ui.form.Button();
    saveButton.set({
      enabled: false,
      icon:"eventrecorder.icon.save",
      toolTipText: "Save script"
    });
    saveButton.addListener("execute", this.save, this);
    this.bind("script", saveButton, "enabled", {
      converter: v => Boolean(v)
    });

    // load button
    let loadButton = new qx.ui.form.Button();
    loadButton.set({
      enabled: false,
      icon:"eventrecorder.icon.load",
      toolTipText: "Load script"
    });
    loadButton.addListener("execute", this.load, this);
    // enable load button only if player can replay scripts in the browser
    this.bind("player.canReplayInBrowser", loadButton, "enabled");

    // add button to parent
    this.add(loadButton);
    this.addOwnedQxObject(loadButton, "load");
    this.add(replayButton);
    this.addOwnedQxObject(replayButton, "replay");
    this.add(recordButton);
    this.addOwnedQxObject(recordButton, "record");
    this.add(stopButton);
    this.addOwnedQxObject(stopButton, "stop");
    this.add(editButton);
    this.addOwnedQxObject(editButton, "edit");
    this.add(saveButton);
    this.addOwnedQxObject(saveButton, "save");

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

    const env = qx.core.Environment;
    const storage = qx.bom.storage.Web.getSession();

    // player configuration
    let playerType = uri_info.queryKey.eventrecorder_type
      || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_TYPE)
      || "qooxdoo";
    let mode = uri_info.queryKey.eventrecorder_player_mode
      || storage.getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_MODE)
      || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_MODE)
      || "presentation";
    let player = this.getPlayerByType(playerType);
    player.setMode(mode);
    player.addListener("changeMode", e => {
      storage.setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_MODE, e.getData());
    });
    this.setPlayer(player);

    // autoplay
    const autoplay = uri_info.queryKey.eventrecorder_autoplay
      || storage.getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.AUTOPLAY)
      || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.AUTOPLAY);
    this.setAutoplay(autoplay);

    // external script source
    let gist_id = uri_info.queryKey.eventrecorder_gist_id
      || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.GIST_ID);

    if (gist_id) {
      this._getRawGist(gist_id)
        .then(gist => {
          // if the eventrecorder itself is scriptable, run the gist in a separate player without GUI
          if (autoplay && scriptable) {
            let gistplayer = new cboulanger.eventrecorder.player.Qooxdoo();
            gistplayer.setMode(mode);
            gistplayer.replay(gist);
          } else {
            this.setScript(gist);
            if (autoplay) {
              this.replay();
            }
          }
        })
        .catch(e => {
          throw new Error(`Gist ${gist_id} cannot be loaded: ${e.message}.`);
        });
    } else {
      let script = storage.getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.SCRIPT);
      if (script) {
        this.setScript(script);
        if (autoplay) {
          this.replay();
        }
      }
    }
  },

  /**
   * The methods and simple properties of this class
   */
  members:
  {
    /**
     * @var {qx.ui.window.Window}
     */
    __editorWindow : null,
    __players : null,

    _applyMode(value, old) {
      if (value === "player" && !this.getPlayer()) {
        throw new Error("Cannot switch to player mode: no player has been set");
      }
    },

    /**
     * When setting the script property, store it in the browser
     * @param value
     * @param old
     * @private
     */
    _applyScript(value, old) {
      qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.SCRIPT, value);
    },

    /**
     * Apply the "autoplay" property and store it in local storage
     * @param value
     * @param old
     * @private
     */
    _applyAutoplay(value, old) {
      qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.AUTOPLAY, value);
    },

    /**
     * Event handler for record toggle button
     * @param e
     */
    _toggleRecord(e) {
      if (e.getData()) {
        this.record();
      }
    },

    /**
     * Event handler for replay toggle button
     * @param e
     * @private
     */
    _toggleReplay(e) {
      if (e.getData()) {
        // start
        if (this.getScript()) {
          // reload
          this.setAutoplay(true);
          window.location.reload();
        }
      }
    },

    /**
     * Upload content
     * @return {Promise<*>}
     * @private
     */
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
    },

    /**
     * Donwload content
     * @param filename
     * @param text
     * @private
     */
    _download(filename, text) {
      var element = document.createElement("a");
      element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
      element.setAttribute("download", filename);
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },

    /**
     * Get the content of a gist by its id
     * @param gist_id {String}
     * @return {Promise<*>}
     * @private
     */
    _getRawGist: async function (gist_id) {
      return new Promise((resolve, reject) => {
        let url = `https://api.github.com/gists/${gist_id}`;
        let req = new qx.io.request.Jsonp(url);
        req.addListener("success", e => {
          let response = req.getResponse();
          let filenames = Object.getOwnPropertyNames(response.data.files);
          let file = response.data.files[filenames[0]];
          if (!file.filename.endsWith(".eventrecorder")) {
            reject(new Error("Gist is not an eventrecorder script"));
          }
          let script = file.content;
          resolve(script);
        });
        req.addListener("statusError", reject);
        req.send();
      });
    },

    /**
     * Returns a player instance. Caches the result
     * @param type
     * @private
     * @return {cboulanger.eventrecorder.IPlayer}
     */
    getPlayerByType(type) {
      if (!type) {
        throw new Error("No player type given!");
      }
      if (this.__players[type]) {
        return this.__players[type];
      }
      let clazz = cboulanger.eventrecorder.player[qx.lang.String.firstUp(type)];
      if (!clazz) {
        throw new Error(`A player of type '${type}' does not exist.`);
      }
      const player = new clazz();
      this.__players[type] = player;
      return player;
    },

    /********* PUBLIC API **********/

    /**
     * Starts recording
     */
    record() {
      this.resetScript();
      this.getRecorder().start();
    },

    /**
     * Stops recording/replaying
     */
    stop() {
      if (this.getRecorder().isRunning()) {
        this.getRecorder().stop();
        let script = this.getRecorder().getScript();
        this.setScript(script);
      }
      if (this.getPlayer() && this.getPlayer().isRunning()) {
        this.getPlayer().stop();
      }
    },

    /**
     * Replays the current script
     * @return {Promise<void>}
     */
    async replay() {
      if (!this.getScript()) {
        throw new Error("No script to replay");
      }
      let player = this.getPlayer();
      if (!player) {
        throw new Error("No player has been set");
      }
      this.setMode("player");
      let infoPane = cboulanger.eventrecorder.InfoPane.getInstance();
      infoPane.useIcon("waiting");
      if (qx.core.Environment.get("eventrecorder.show_progress")) {
        player.addListener("progress", e => {
          let [step, steps] = e.getData();
          infoPane.display(`Replaying ... (${step}/${steps})`);
        });
      }
      let error = null;
      try {
        await player.replay(this.getScript());
      } catch (e) {
        error = e;
      }
      infoPane.hide();
      this.setMode("recorder");
      if (error) {
        throw error;
      }
    },

    /**
     * Edits the current script
     */
    edit() {
      if (this.__editorWindow) {
        this.__editorWindow.open();
        return;
      }
      let win = new qx.ui.window.Window("Edit script");
      win.set({
        layout: new qx.ui.layout.VBox(5),
        showMinimize: false,
        width: 800,
        height: 600
      });
      win.addListener("appear", () => {
        win.center();
      });
      this.__editorWindow = win;

      qookery.contexts.Qookery.loadResource(
        qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml"), this,
          xmlSource => {
        let xmlDocument = qx.xml.Document.fromString(xmlSource);
        let parser = qookery.Qookery.createFormParser();
        let formComponent = parser.parseXmlDocument(xmlDocument);
        formComponent.setQxObjectId("editor");
        this.addOwnedQxObject(formComponent);
        let editorWidget = formComponent.getMainWidget();
        win.add(editorWidget);
        this.bind("script", formComponent.getModel(), "leftEditorContent");
        let formModel = formComponent.getModel();
        formModel.bind("leftEditorContent", this, "script");
        formModel.addListener("changeTargetScriptType", e => this.translateTo(formModel.getTargetScriptType(), formModel.getTargetMode()));
        formModel.addListener("changeTargetMode", e => this.translateTo(formModel.getTargetScriptType(), formModel.getTargetMode()));
        parser.dispose();
        this.edit();
      });
    },

    /**
     * Save the current script to the local machine
     */
    save() {
      qx.event.Timer.once(() => {
        let filename = prompt("Please enter the name of the file to save");
        if (!filename) {
          return;
        }
        this._download(filename + ".eventrecorder", this.getScript());
      }, null, 0);
    },

    /**
     * Translates the text in the left editor into the language produced by the
     * given player type. Alerts any errors that occur.
     * @param playerType {String}
     * @param mode {String}
     * @return {String|false}
     */
    translateTo(playerType, mode) {
      const exporter = this.getPlayerByType(playerType);
      const model = this.getQxObject("editor").getModel();
      if (mode) {
        exporter.setMode(mode);
      }
      let editedScript = model.getLeftEditorContent();
      try {
        let translatedText = exporter.translate(editedScript);
        model.setRightEditorContent(translatedText);
        return translatedText;
      } catch (e) {
        alert(e.message);
      }
      return false;
    },

    /**
     * Export the script in the given format
     * @param playerType {String}
     * @param mode {String}
     * @return {Boolean}
     */
    exportTo(playerType, mode) {
      const exporter = this.getPlayerByType(playerType);
      if (mode) {
        exporter.setMode(mode);
      }
      let translatedScript = this.getQxObject("editor").getModel().getRightEditorContent();
      if (!translatedScript) {
        if (!this.getScript()) {
          alert("No script to export!");
          return false;
        }
        translatedScript = this.translateTo(playerType);
      }
      qx.event.Timer.once(() => {
        let filename = prompt("Please enter the name of the file to export");
        if (!filename) {
          return;
        }
        this._download(`${filename}.${exporter.getExportFileExtension()}`, translatedScript);
      }, null, 0);
      return true;
    },

    /**
     * Load a script from the local machine
     * @return {Promise<void>}
     */
    async load() {
      try {
        let script = await this._upload();
        this.setScript(script);
      } catch (e) {
        alert(e.message);
      }
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function() {
    if (!qx.core.Environment.get("module.objectid") || !qx.core.Environment.get("eventrecorder.enabled")) {
     return;
    }
    qookery.Qookery.setOption(
      qookery.Qookery.OPTION_EXTERNAL_LIBRARIES,
      qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/js"));
    // called when application is ready
    qx.bom.Lifecycle.onReady(() => {
      let infoPane = cboulanger.eventrecorder.InfoPane.getInstance();
      infoPane.useIcon("waiting");
      infoPane.display("Initializing Event Recorder, please wait...");
      let dispayedText = infoPane.getDisplayedText();
      // assign object ids
      const objIdGen = cboulanger.eventrecorder.ObjectIdGenerator.getInstance();
      objIdGen.addListenerOnce("done", async () => {
        // hide splash screen if it hasn't used by other code yet
        if (infoPane.getDisplayedText() === dispayedText) {
          infoPane.hide();
        }
        // create controller
        let controller = new cboulanger.eventrecorder.UiController();
        qx.core.Init.getApplication().getRoot().add(controller, {top:0, right:10});
        if (!qx.core.Environment.get("eventrecorder.hidden")) {
          controller.show();
        }
      });
    });
  }
});
