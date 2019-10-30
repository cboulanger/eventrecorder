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
 * This mixin contains methods that are used by the controller widgets
 * @ignore(ace)
 */
qx.Mixin.define("cboulanger.eventrecorder.uicontroller.MUiController", {

  statics: {

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

  members: {

    /**
     * workaround until icon theme can be mixed into application theme
     * @private
     */
    _setupAliases() {
      const aliasMgr = qx.util.AliasManager.getInstance();
      const aliases = aliasMgr.getAliases();
      for (let [alias, base] of Object.entries(this.self(arguments).aliases)) {
        if (!aliases[alias]) {
          aliasMgr.add(alias, base);
        }
      }
    },


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
          let loadMenu = new qx.ui.menu.Menu();
          let loadUserGistButton = new qx.ui.menu.Button("Load user gist");
          loadUserGistButton.addListener("execute", () => this.loadUserGist());
          loadUserGistButton.setQxObjectId("fromUserGist");
          loadMenu.add(loadUserGistButton);
          let loadGistByIdButton = new qx.ui.menu.Button("Load gist by id");
          loadGistByIdButton.addListener("execute", () => this.loadGistById());
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
          control.addListener("execute", this.load, this);
          // disable load button during records
          this.getState().bind("record", control, "enabled", {
            converter: v => !v
          });
          break;
        }

        /**
         * Replay button
         */
        case "play": {
          control = new cboulanger.eventrecorder.SplitToggleButton();
          let replayMenu = new qx.ui.menu.Menu();
          control.addOwnedQxObject(replayMenu, "menu");
          let macroButton = new qx.ui.menu.Button("Macros");
          replayMenu.add(macroButton);
          replayMenu.addOwnedQxObject(macroButton, "macros");
          let macroMenu = new qx.ui.menu.Menu();
          macroButton.setMenu(macroMenu);
          macroButton.addOwnedQxObject(macroMenu, "menu");
          this.getState().addListener("changeMacros", () => this._updateMacroMenu());
          replayMenu.addSeparator();
          replayMenu.add(new qx.ui.menu.Button("Options:"));
          let optionReload = new qx.ui.menu.CheckBox("Reload page before replay");
          this.getState().bind("reloadBeforeReplay", optionReload, "value");
          optionReload.bind("value", this.getState(), "reloadBeforeReplay");
          replayMenu.add(optionReload);
          control.set({
            enabled: false,
            icon:"eventrecorder.icon.start",
            toolTipText: "Replay script",
            menu: replayMenu
          });
          // bind to state
          this.getState().bind("play", control, "value", {
            converter: v => v === true
          });
          control.bind("value", this.getState(), "play");
          // enable only when the state is "false"
          this.getState().bind("play", control, "enabled", {
            converter: v => v === false
          });
          break;
        }

        /**
         * Record Button
         */
        case "record": {
          let recordMenu = new qx.ui.menu.Menu();
          recordMenu.add(new qx.ui.menu.Button("Options:"));
          let debugEvents = new qx.ui.menu.CheckBox("Log event data");
          debugEvents.bind("value", this.getState(), "logEvents");
          recordMenu.add(debugEvents);
          control = new cboulanger.eventrecorder.SplitToggleButton();
          control.setIcon("eventrecorder.icon.record");
          control.setMenu(recordMenu);
          // bind to state
          this.getState().bind("record", control, "value", {
            converter: v => v === true
          });
          control.bind("value", this.getState(), "record");
          // enable only when the state is "false" (not pressed)
          this.getState().bind("record", control, "enabled", {
            converter: v => v === false
          });
          break;
        }

        /**
         * Stop Button
         */
        case "stop": {
          control = new qx.ui.form.Button();
          control.set({
            enabled: false,
            icon: "eventrecorder.icon.stop",
            toolTipText: "Stop recording"
          });
          control.addListener("execute", () => this.stop());
          break;
        }

        /**
         * Edit Button
         */
        case "edit": {
          control = new qx.ui.form.Button();
          control.set({
            enabled: true,
            icon:"eventrecorder.icon.edit",
            toolTipText: "Edit script"
          });
          control.addListener("execute", () => this.edit());
          // enable only if no recording
          this.getState().bind("record", control, "enabled", {
            converter: v => v === false
          });
          break;
        }

        /**
         * Save Button
         */
        case "save": {
          control = new qx.ui.form.Button();
          control.set({
            enabled: false,
            icon:"eventrecorder.icon.save",
            toolTipText: "Save script"
          });
          control.addListener("execute", () => this.save());
          this.getState().bind("record", control, "enabled", {
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
    },

    _updateMacroMenu() {
      const macroMenu = this.getQxObject("play/menu/macros/menu");
      macroMenu.removeAll();
      for (let {label, value} of this.getState().getMacros().toArray()) {
        let menuButton = new qx.ui.menu.Button(label);
        menuButton.addListener("execute", () => {
          this.getState().setMacroToPlay(value);
        });
        macroMenu.add(menuButton);
      }
    },

    /**
     * Stops recording/replaying
     */
    stop() {
      this.getState().set({
        play: false,
        record: false
      });
    },

    /**
     * Save the current script to the local machine
     */
    save() {
      qx.event.Timer.once(() => {
        let filename = this.getState().getApplicationName() + ".eventrecorder";
        cboulanger.eventrecorder.Utils.download(filename, this.getState().getScript());
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
      this.getState().setScript(await this.getRawGist(answer.id));
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
      this.getState().setScript(await this.getRawGist(answer.id));
    }
  }
});
