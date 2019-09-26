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
 * @require(cboulanger.eventrecorder.player.Testcafe)
 */
qx.Class.define("cboulanger.eventrecorder.Engine", {
  extend: qx.core.Object,
  include: [
    cboulanger.eventrecorder.MHelperMethods,
    cboulanger.eventrecorder.editor.MEditor /* needs to be removed once the OnPage editor is factored out into its own class */
  ],
  statics: {
    CONFIG_KEY: {
      SCRIPT:       "eventrecorder.script",
      PLAYER_TYPE:  "eventrecorder.player_type",
      PLAYER_MODE:  "eventrecorder.player_mode",
      GIST_ID:      "eventrecorder.gist_id",
      AUTOPLAY:     "eventrecorder.autoplay",
      SHOW_PROGRESS:"eventrecorder.show_progress",
      SCRIPTABLE:   "eventrecorder.scriptable",
      RELOAD_BEFORE_REPLAY: "eventrecorder.reload_before_replay",
      SCRIPT_URL:   "eventrecorder.script_url"
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
      check: "cboulanger.eventrecorder.recorder.Recorder",
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
     * The UI controller instance, either an on-page MDI-style window or
     * an external browser window
     */
    uiController: {
      check: "Object",
      nullable: true
    },

    /**
     * The script editor instance, either an on-page MDI-style window or
     * an external browser window
     */
    scriptEditor: {
      check: "Object",
      nullable: true
    },

    /**
     * The recorded script
     */
    script: {
      check: "String",
      nullable: true,
      deferredInit: true,
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
      deferredInit: true,
      event: "changeAutoplay",
      apply: "_applyAutoplay"
    },

    /**
     * Whether the application is reloaded before the script is replayed
     */
    reloadBeforeReplay: {
      check: "Boolean",
      nullable: false,
      deferredInit: true,
      event: "changeReloadBeforeReplay",
      apply: "_applyReloadBeforeReplay"
    },

    /**
     * The id of a gist to replay a script from, if any
     */
    gistId: {
      check: "String",
      nullable: true,
      deferredInit: true,
      event: "changeGistId",
      apply: "_applyGistId"
    },

    /**
     * Whether the event recorder is scriptable
     * (only useful for demos of the eventrecorder itself)
     */
    scriptable: {
      check: "Boolean",
      nullable: false,
      deferredInit: true,
      event: "changeScriptable"
    }
  },

  /**
   * @ignore(env)
   * @ignore(storage)
   * @ignore(uri_params)
   */
  construct: function() {
    this.base(arguments);
    const recorder = new cboulanger.eventrecorder.recorder.Recorder();
    this.setRecorder(recorder);

    // initialize application parameters
    let {script, reloadBeforeReplay, autoplay, gistId, scriptable, playerType, playerMode} = this._getParamsFromEnvironment();
    this.initScript(script);
    this.initReloadBeforeReplay(reloadBeforeReplay === null ? false : reloadBeforeReplay);
    this.initAutoplay(autoplay);
    this.initGistId(gistId);
    this.initScriptable(scriptable);

    // form for file uploads
    var form = document.createElement("form");
    form.setAttribute("visibility", "hidden");
    document.body.appendChild(form);
    let input = document.createElement("input");
    input.setAttribute("id", cboulanger.eventrecorder.Engine.FILE_INPUT_ID);
    input.setAttribute("type", "file");
    input.setAttribute("name", "file");
    input.setAttribute("visibility", "hidden");
    form.appendChild(input);

    // Player configuration
    let player = this.getPlayerByType(playerType);
    player.setMode(playerMode);
    const {storage} = this._getPersistenceProviders();
    player.addListener("changeMode", e => {
      storage.setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_MODE, e.getData());
    });
    this.setPlayer(player);

    // Autoplay
    if (script && !this._scriptUrlMatches()) {
      script = null;
      this.setScript("");
      this.setAutoplay(false);
    }
    if (gistId && !script) {
      this.getRawGist(gistId)
        .then(gist => {
          // if the eventrecorder itself is scriptable, run the gist in a separate player without GUI
          if (this.getScriptable()) {
            let gistplayer = new cboulanger.eventrecorder.player.Qooxdoo();
            gistplayer.setMode(playerMode);
            if (autoplay) {
              this.setAutoplay(false);
              gistplayer.replay(gist);
            }
          } else {
            this.setScript(gist);
            if (autoplay) {
              this.setAutoplay(false);
              this.replay();
            }
          }
        })
        .catch(e => {
          throw new Error(`Gist ${gistId} cannot be loaded: ${e.message}.`);
        });
    } else if (script && autoplay) {
      this.setAutoplay(false);
      this.replay();
    }
  },

  /**
   * The methods and simple properties of this class
   */
  members:
  {

    /**
     * The mode of the script editor "inside"/"outside"
     * @var {String}
     */
    __lastMode : null,

    /**
     * Returns a map with object providing persistence
     * @return {{env: qx.core.Environment, storage: qx.bom.storage.Web, uri_params: {}}}
     * @private
     */
    _getPersistenceProviders() {
      return {
        env: qx.core.Environment,
        storage: qx.bom.storage.Web.getSession(),
        uri_params: qx.util.Uri.parseUri(window.location.href)
      };
    },

    /**
     * Get application parameters from from environment, which can be query params,
     * local storage, or qooxdoo environment variables
     * @private
     * @ignore(env)
     * @ignore(storage)
     * @ignore(uri_params)
     */
    _getParamsFromEnvironment() {
      let {env, storage, uri_params} = this._getPersistenceProviders();
      let script = storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.SCRIPT) || "";
      let autoplay = uri_params.queryKey.eventrecorder_autoplay ||
        storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.AUTOPLAY) ||
        env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.AUTOPLAY) ||
        false;
      let reloadBeforeReplay = storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.RELOAD_BEFORE_REPLAY);
      let gistId = uri_params.queryKey.eventrecorder_gist_id || env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.GIST_ID) || null;
      let scriptable = Boolean(uri_params.queryKey.eventrecorder_scriptable) || qx.core.Environment.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.SCRIPTABLE) || false;
      let playerType = uri_params.queryKey.eventrecorder_type || env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_TYPE) || "qooxdoo";
      let playerMode = uri_params.queryKey.eventrecorder_player_mode || storage.getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_MODE) || env.get(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_MODE) || "presentation";
      let info = {script, autoplay, reloadBeforeReplay, gistId, scriptable, scriptUrl : this._getScriptUrl(), playerType, playerMode };
      console.log(info);
      return info;
    },

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
      qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.SCRIPT, value);
      this.getRecorder().setScript(value);
      if (!this._getScriptUrl()) {
        this._saveScriptUrl();
      }
      if (!this.getPlayer()) {
        this.addListenerOnce("changePlayer", async () => {
          await this.getPlayer().translate(value);
        });
      }
    },

    _getScriptUrl() {
      return qx.bom.storage.Web.getSession().getItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.SCRIPT_URL);
    },

    _saveScriptUrl() {
      qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.SCRIPT_URL, document.location.href);
    },

    _scriptUrlMatches() {
      return this._getScriptUrl() === document.location.href;
    },

    _applyGistId(value, old) {
      // to do: add to URI
    },

    /**
     * Apply the "autoplay" property and store it in local storage
     * @param value
     * @param old
     * @private
     */
    _applyAutoplay(value, old) {
      qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.AUTOPLAY, value);
    },

    /**
     * Apply the "reloadBeforeReplay" property and storeit in local storage
     * @param value
     * @param old
     * @private
     */
    _applyReloadBeforeReplay(value, old) {
      qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.RELOAD_BEFORE_REPLAY, value);
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
     * Event handler for replay button
     * @private
     */
    _startReplay() {
      // start
      if (this.getScript() || this.getGistId()) {
        if (this.getReloadBeforeReplay()) {
          // reload
          this.setAutoplay(true);
          window.location.reload();
        } else if (this.getScript()) {
          this.replay();
        } else {
          this.getQxObject("replay").setValue(false);
        }
      }
    },

    /**
     * Uploads content to the browser. Returns the content of the file.
     * @return {Promise<String>}
     * @private
     */
    async _upload() {
      return new Promise((resolve, reject) => {
        let input = document.getElementById(cboulanger.eventrecorder.Engine.FILE_INPUT_ID);
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
     * Returns the name of the application by using the parent directory of the
     * index.html script
     * @return {string}
     * @private
     */
    _getApplicationName() {
      return window.document.location.pathname.split("/").slice(-2, -1).join("");
    },



    /*
     ===========================================================================
       PUBLIC API
     ===========================================================================
     */

    /**
     * Return an array of object ids that have been assigned in the recorded application
     * @return {[]}
     */
    getObjectIds() {
      return this.getRecorder().getObjectIds();
    },

    /**
     * Starts recording
     */
    async record() {
      let recorder = this.getRecorder();
      if (this.getScript().trim()!=="" && !this.getScriptable()) {
        let mode = await qxl.dialog.Dialog.select(
          "Do you want to overwrite your script or append new events?",
          [
            {label: "Append", value: "append"},
            {label: "Overwrite", value: "overwrite"}
          ]
        ).promise();
        if (!mode) {
          this.getQxObject("record").setValue(false);
          return;
        }
        recorder.setMode(mode);
      }
      recorder.start();
    },

    /**
     * Stops recording/replaying
     */
    stop() {
      if (this.getRecorder().isRunning()) {
        this.getRecorder().stop();
        let script = this.getRecorder().getScript();
        this._saveScriptUrl();
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
     * Edits the current script, either using the in-window editor or the
     * external editor window.
     * NOTE: This will be completely rewritten
     * @param mode {String|undefined}
     */
    async edit(mode) {
      const defaultMode = qx.core.Environment.get("eventrecorder.editor.placement");
      if (mode === undefined && (this.__lastMode || defaultMode)) {
        mode = this.__lastMode || defaultMode;
      }
      if (this.getScriptEditor()) {
        console.debug({mode, lastMode:this.__lastMode});
        if (mode === this.__lastMode) {
          if (mode === "inside") {
            console.debug("Opening existing qooxdoo window.");
            this.getScriptEditor().open();
            return;
          } else if (qx.bom.Window.isClosed(this.getScriptEditor())) {
            console.debug("Destroying existing closed native window and recreating it.");
            this.setScriptEditor(null);
          } else {
            console.debug("Bringing existing native window to front.");
            this.getScriptEditor().focus();
            return;
          }
        } else {
          console.debug("Windows mode has changed, creating new window...");
          try {
            this.removeOwnedQxObject("editor");
          } catch (e) {}
          if (this.__lastMode === "inside") {
            console.debug("Destroying existing qooxdoo native window.");
            this.getScriptEditor().close();
            this.getScriptEditor().dispose();
          } else if (qx.bom.Window.isClosed(this.getScriptEditor())) {
              console.debug("Destroying existing closed native window.");
              this.setScriptEditor(null);
            } else {
              console.debug("Closing existing open native window...");
              this.getScriptEditor().close();
            }
        }
      }
      switch (mode) {
        case "outside":
          this.setScriptEditor(await this.__createBrowserEditorWindow());
          break;
        case "inside":
        default:
          this.setScriptEditor(await this.__createpQxEditorWindow());
          break;
      }
      this.__lastMode = mode;
    },

    __lastData: null,
    __listenersAttached: false,

    async __createBrowserEditorWindow() {
      let popup = qx.bom.Window.open(
        this.getApplicationParentDir() + "/eventrecorder_scripteditor",
        Math.random(),
        {
          width: 800,
          height: 600,
          dependent: true,
          menubar: false,
          status: false,
          scrollbars: false,
          toolbar: false
        }
      );
      window.addEventListener("beforeunload", () => {
        popup.close();
        popup = null;
      });
      const sendMessage = data => {
        if (qx.bom.Window.isClosed(popup)) {
          // remove listeners instead!!
          return;
        }
        popup.postMessage(data, "*");
        console.debug(">>> Message sent:");
        console.debug(data);
      };
      window.addEventListener("message", e => {
        if (e.source !== popup) {
          this.warn("Ignoring message from unknown source...");
          return;
        }
        const data = e.data;
        this.__lastData = data;
        console.debug(">>> Message received:");
        console.debug(data);
        if (data.script === null) {
          console.debug("Received initialization message from external editor.");
          // initialization message
          sendMessage({
            script: this.getScript(),
            playerType: this.getPlayer().getType(),
            objectIds: this.getObjectIds()
          });
          this.__lastData = {};
          if (!this.__listenersAttached) {
            this.addListener("changeScript", e => {
              const script = e.getData();
              if (this.__lastData.script !== script) {
                sendMessage({script});
              }
            });
            this.addListener("changePlayer", e => {
              sendMessage({playerType: e.getData().getType()});
            });
            this.__listenersAttached = true;
          }
          return;
        }
        this.set(e.data);
      });
      return popup;
    },

    /**
     * Sets up an editor in the given window itself
     * @private
     */
    async __createpQxEditorWindow() {
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
      const formUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml");
      const formComponent = await this.createQookeryComponent(formUrl);
      this.addOwnedQxObject(formComponent, "editor");
      const editorWidget = formComponent.getMainWidget();
      win.add(editorWidget);
      formComponent.addOwnedQxObject(win, "window");
      editorWidget.addListener("appear", this._updateEditor, this);
      this.bind("script", formComponent.getModel(), "leftEditorContent");
      let formModel = formComponent.getModel();
      formModel.bind("leftEditorContent", this, "script");
      formModel.addListener("changeTargetScriptType", e => this.translateTo(formModel.getTargetScriptType(), formModel.getTargetMode()));
      formModel.addListener("changeTargetMode", e => this.translateTo(formModel.getTargetScriptType(), formModel.getTargetMode()));
      win.open();
      qx.event.Timer.once(this._setupAutocomplete, this, 2000);
      return win;
    },


    /**
     * Save the current script to the local machine
     */
    save() {
      qx.event.Timer.once(() => {
        let filename = this._getApplicationName() + ".eventrecorder";
        this._download(filename, this.getScript());
      }, null, 0);
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
        qxl.dialog.Dialog.error(e.message);
      }
    },

    /**
     * Loads a gist selected from a github user's gists
     * @return {Promise<void>}
     */
    loadUserGist: async function () {
      let formData = {
        username: {
          type: "Textfield",
          label: "Username"
        },
        show_all: {
          type: "Checkbox",
          value: false,
          label: "Show all scripts (even if URL does not match)"
        }
      };
      let answer = await qxl.dialog.Dialog.form("Please enter the GitHub username", formData).promise();
      if (!answer || !answer.username.trim()) {
        return;
      }
      let username = answer.username;
      cboulanger.eventrecorder.InfoPane.getInstance().useIcon("waiting").display("Retrieving data from GitHub...");
      let gist_data = await new Promise((resolve, reject) => {
        let url = `https://api.github.com/users/${username}/gists`;
        let req = new qx.io.request.Jsonp(url);
        req.addListener("success", e => {
          cboulanger.eventrecorder.InfoPane.getInstance().hide();
          let response = req.getResponse();
          if (response.data && response.message) {
            reject(response.message);
          } else if (response.data) {
            resolve(response.data);
          }
          reject(new Error("Invalid response."));
        });
        req.addListener("statusError", reject);
        req.send();
      });

      let suffix = `.eventrecorder`;
      if (!answer.show_all) {
        suffix = "." + this._getApplicationName() + suffix;
      }
      let options = gist_data
        .filter(entry => entry.description && Object.values(entry.files).some(file => file.filename.endsWith(suffix)))
        .map(entry => ({
          label: entry.description,
          value: entry.id
        }));
      if (options.length===0) {
        qxl.dialog.Dialog.error("No matching gists were found.");
        return;
      }
      formData = {
        id: {
          type: "SelectBox",
          label: "Script",
          options
        }
      };
      answer = await qxl.dialog.Dialog.form("Please select from the following scripts:", formData).promise();

      if (!answer || !answer.id) {
        return;
      }
      this.setScript(await this.getRawGist(answer.id));
    },

    /**
     * Loads a gist by its id.
     * @return {Promise<void>}
     */
    async loadGistById() {
      let answer = await qxl.dialog.Dialog.prompt("Please enter the id of the gist to replay");
      if (!answer || !answer.id) {
        return;
      }
      this.setScript(await this.getRawGist(answer.id));
      this.setGistId(answer.id);
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
    qx.bom.Lifecycle.onReady(async () => {
      let infoPane = cboulanger.eventrecorder.InfoPane.getInstance();
      infoPane.useIcon("waiting");
      infoPane.display("Initializing Event Recorder, please wait...");
      let dispayedText = infoPane.getDisplayedText();
      // assign object ids if object id generator has been included
      if (qx.Class.isDefined("cboulanger.eventrecorder.ObjectIdGenerator")) {
        await new Promise(resolve => {
          const objIdGen = qx.Class.getByName("cboulanger.eventrecorder.ObjectIdGenerator").getInstance();
          objIdGen.addListenerOnce("done", resolve);
        });
      }

      // hide splash screen if it hasn't used by other code yet
      if (infoPane.getDisplayedText() === dispayedText) {
        infoPane.hide();
      }
      // create engine
      let engine = new cboulanger.eventrecorder.Engine();
      // create ui controller
      let uicontroller;
      if (qx.core.Environment.get("eventrecorder.uicontroller.placement") === "outside") {
        throw new Error("Controller in own window not implemented yet");
      } else {
        uicontroller = new cboulanger.eventrecorder.uicontroller.OnPage("Event Recorder", engine);
      }
      engine.setUiController(uicontroller);
      if (!qx.core.Environment.get("eventrecorder.hidden")) {
        uicontroller.show();
      }
    });
  }
});
