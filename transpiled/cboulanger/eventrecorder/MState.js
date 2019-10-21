(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Mixin": {
        "usage": "dynamic",
        "require": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);
  qx.Mixin.define("cboulanger.eventrecorder.MState", {
    properties: {
      /**
       * Whether the recorder/player is recording/playing
       */
      running: {
        check: "Boolean",
        nullable: false,
        init: false,
        event: "changeRunning"
      },

      /**
       * Whether the recorder/player is put in paused mode
       */
      paused: {
        check: "Boolean",
        nullable: false,
        init: false,
        event: "changePaused"
      }
    },
    members: {
      /**
       * Starts the recorder/player
       */
      start() {
        if (typeof this.beforeStart == "function") {
          this.beforeStart();
        }

        this.setRunning(true);
        this.setPaused(false);
      },

      /**
       * Pauses the recorder/player
       */
      pause() {
        this.setRunning(false);
        this.setPaused(true);
      },

      /**
       * Resumes recording/playing.
       */
      resume() {
        if (!this.getPaused()) {
          throw new Error("Cannot resume if not paused");
        }

        this.setRunning(true);
        this.setPaused(false);
      },

      /**
       * Stops the recording.
       */
      stop() {
        this.setRunning(false);
        this.setPaused(false);

        if (typeof this.afterStop == "function") {
          this.afterStop();
        }
      }

    }
  });
  cboulanger.eventrecorder.MState.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=MState.js.map?dt=1571643406210