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
      "eventrecorder.icon.export":  "cboulanger/eventrecorder/emblem-symbolic-link.png",
      // need a way to automatically include this
      "qxl.dialog.icon.cancel" : "qxl/dialog/icon/IcoMoonFree/272-cross.svg",
      "qxl.dialog.icon.ok"     : "qxl/dialog/icon/IcoMoonFree/273-checkmark.svg",
      "qxl.dialog.icon.info"   : "qxl/dialog/icon/IcoMoonFree/269-info.svg",
      "qxl.dialog.icon.error"  : "qxl/dialog/icon/IcoMoonFree/270-cancel-circle.svg",
      "qxl.dialog.icon.warning" : "qxl/dialog/icon/IcoMoonFree/264-warning.svg"
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

    _setupUi () {
      const engine = this.getEngine();
      // caption
      engine.bind("recorder.running", this, "caption", {
        converter: v => v ? "Recording ..." : this.getCaption()
      });
      engine.bind("player.running", this, "caption", {
        converter: v => v ? "Replaying ..." : this.getCaption()
      });
      // this creates the buttons in this order and adds them to the window
      this.add(this.getChildControl("load"));
      this.add(this.getChildControl("replay"));
      this.add(this.getChildControl("record"));
      this.add(this.getChildControl("stop"));
      this.add(this.getChildControl("edit"));
      this.add(this.getChildControl("save"));
      this._manageStopButtonState();
    },

    _manageStopButtonState() {
      const stopButton = this.getChildControl("stop");
      const engine = this.getEngine();
      const recorder = engine.getRecorder();
      const stopButtonState = () => {
        stopButton.setEnabled(
          recorder.isRunning() || (Boolean(engine.getPlayer()) && engine.getPlayer().isRunning())
        );
      };
      recorder.addListener("changeRunning", stopButtonState);
      engine.addListener("changePlayer", e => {
        if (e.getData()) {
          engine.getPlayer().addListener("changeRunning", stopButtonState);
        }
      });
    },

    async _updateMacroMenu() {
      const macroMenu = this.getQxObject("replay/menu/macros/menu");
      const player = this.getEngine.getPlayer();
      macroMenu.removeAll();
      for (let name of player.getMacroNames().toArray()) {
        let description = player.getMacroDescription(name);
        let label = description.trim() ? (name + ": " + description) : name;
        let menuButton = new qx.ui.menu.Button(label);
        menuButton.addListener("execute", async () => {
          let lines = player.getMacroDefinition(name);
          await player.replay(lines);
          cboulanger.eventrecorder.InfoPane.getInstance().hide();
        });
        macroMenu.add(menuButton);
      }
    },

    /**
     * Event handler for record toggle button
     * @param e
     */
    _toggleRecord(e) {
      if (e.getData()) {
        this.getEngine().record();
      }
    }
  }
});
