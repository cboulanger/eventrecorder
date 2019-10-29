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
 * The Engine is responsible for recording and replaying events, using
 * pluggable recorder and player instances
 * @require(cboulanger.eventrecorder.player.Testcafe)
 */
qx.Class.define("cboulanger.eventrecorder.Engine", {
  extend: qx.core.Object,
  include: [
    cboulanger.eventrecorder.MState
  ],
  statics: {
    CONFIG_KEY: {
      SCRIPT:       "eventrecorder.script",
      PLAYER_TYPE:  "eventrecorder.player_type",
      PLAYER_MODE:  "eventrecorder.player_mode",
      GIST_ID:      "eventrecorder.gist_id",
      AUTOPLAY:     "eventrecorder.autoplay",
      SHOW_PROGRESS:"eventrecorder.show_progress",
      SCRIPTABLE:   "eventrecorder.editor.scriptable",
      RELOAD_BEFORE_REPLAY: "eventrecorder.reload_before_replay",
      SCRIPT_URL:   "eventrecorder.script_url"
    }
  },

  properties: {
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
     * The id of a gist to replay a script from, if any
     */
    gistId: {
      check: "String",
      nullable: true,
      event: "changeGistId"
    }
  },

  /**
   * @param {cboulanger.eventrecorder.State} state
   * @ignore(env)
   * @ignore(storage)
   * @ignore(uri_params)
   */
  construct: function(state) {
    this.base(arguments);

    // state
    this.setState(state);
    this._initAndPersistState();

    const recorder = new cboulanger.eventrecorder.recorder.Recorder();
    this.setRecorder(recorder);

    // Player configuration
    let player = cboulanger.eventrecorder.Utils.getPlayerByType(state.getPlayerType());
    player.setMode(state.getPlayerMode());
    this.setPlayer(player);

    // Autoplay
    let script = state.getScript();
    let autoplay = state.getAutoplay();
    if (script && !this._scriptUrlMatches()) {
      script = null;
      state.setScript("");
      state.setAutoplay(false);
    }
    let gistId = this.getGistId();
    if (gistId && !script) {
      cboulanger.eventrecorder.Utils.getRawGist(gistId)
        .then(gist => {
          // if the eventrecorder itself is scriptable, run the gist in a separate player without GUI
          if (state.getScriptable()) {
            let gistplayer = new cboulanger.eventrecorder.player.Qooxdoo();
            gistplayer.setMode(this.getState().getPlayerMode());
            if (autoplay) {
              state.setAutoplay(false);
              gistplayer.replay(gist);
            }
          } else {
            state.setScript(gist);
            if (autoplay) {
              state.setAutoplay(false);
              this.replay();
            }
          }
        })
        .catch(e => {
          throw new Error(`Gist ${gistId} cannot be loaded: ${e.message}.`);
        });
    } else if (script && autoplay) {
      state.setAutoplay(false);
      this.replay();
    }
  },

  /**
   * The methods and simple properties of this class
   */
  members:
  {

    /**
     * Set the application state from environment and persist changes
     * @private
     */
    _initAndPersistState() {
      const Utils = cboulanger.eventrecorder.Utils;
      // initialize application parameters
      let {script, reloadBeforeReplay, autoplay, gistId, scriptable, playerType, playerMode} = Utils.getParamsFromEnvironment();
      // set state
      const state = this.getState().set({
        script,
        reloadBeforeReplay,
        autoplay,
        scriptable,
        playerMode,
        playerType,
        applicationName: Utils.getApplicationName(),
        objectIds: Utils.getObjectIds()
      });
      this.setGistId(gistId);

      // persist values
      const {storage} = Utils.getPersistenceProviders();
      state.addListener("changeScript", e => this._applyScript(e.getData(), e.getOldData()));
      state.addListener("changePlayerMode", e => storage.setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.PLAYER_MODE, e.getData()));
      state.addListener("changeAutoplay", e => storage.setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.AUTOPLAY, e.getData()));
      state.addListener("changeReloadBeforeReplay", e => storage.setItem(cboulanger.eventrecorder.Engine.CONFIG_KEY.RELOAD_BEFORE_REPLAY, e.getData()));
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


    /*
     ===========================================================================
       PUBLIC API
     ===========================================================================
     */

    /**
     * Starts recording
     */
    async record() {
      let recorder = this.getRecorder();
      if (this.getState().getScript().trim() !== "" && !this.getState().getScriptable()) {
        let mode = await qxl.dialog.Dialog.select(
          "Do you want to overwrite your script or append new events?",
          [
            {label: "Append", value: "append"},
            {label: "Overwrite", value: "overwrite"}
          ]
        ).promise();
        if (!mode) {
          this.getState().setRecord(false);
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
        this.getState().setScript(script);
      }
      if (this.getPlayer() && this.getPlayer().isRunning()) {
        this.getPlayer().stop();
      }
    },

    /**
     * Plays the current script
     * @return {Promise<void>}
     */
    async replay() {
      let player = this.getPlayer();
      if (!player) {
        throw new Error("No player has been set");
      }

      let script = this.getState().getScript();

      // auto-play a gist
      if (this.getGistId()) {
        if (this.getState().getReloadBeforeReplay()) {
          // reload
          this.getState().setAutoplay(true);
          window.location.reload();
          return;
        }
      }

      if (!script) {
        this.warn("No script to replay");
        return;
      }

      let infoPane = cboulanger.eventrecorder.InfoPane.getInstance();
      infoPane.useIcon("waiting");
      if (qx.core.Environment.get("eventrecorder.show_progress")) { // turn into state var
        player.addListener("progress", e => {
          let [step, steps] = e.getData();
          infoPane.display(`Replaying ... (${step}/${steps})`);
        });
      }
      let error = null;
      try {
        await player.replay(script);
      } catch (e) {
        error = e;
      }
      infoPane.hide();
      if (error) {
        throw error;
      }
    }
  }
});
