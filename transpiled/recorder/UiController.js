(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.ui.window.Window": {
        "construct": true,
        "require": true
      },
      "qx.ui.layout.VBox": {
        "construct": true
      },
      "recorder.AbstractRecorder": {
        "construct": true
      },
      "qx.ui.form.ToggleButton": {
        "construct": true
      },
      "qx.ui.form.Button": {
        "construct": true
      },
      "qx.ui.form.TextArea": {
        "construct": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);qx.Class.define("recorder.UiController", {

    extend: qx.ui.window.Window,

    /**
     * Constructor
     */
    construct: function construct(recorderImplementation) {
      qx.ui.window.Window.constructor.call(this);
      this.set({
        width: 200,
        height: 400,
        modal: false,
        showMinimize: false,
        showMaximize: false,
        layout: new qx.ui.layout.VBox(5)
      });

      if (!recorderImplementation instanceof recorder.AbstractRecorder) {
        this.error("Argument must be instanceof recorder.AbstractRecorder.");
        return;
      }
      this._recorder = recorderImplementation;

      var startButton = new qx.ui.form.ToggleButton("Start", null);
      startButton.addListener("changeValue", this.toggle, this);
      this._startButton = startButton;
      this.add(startButton);

      var stopButton = new qx.ui.form.Button("Stop", null);
      stopButton.set({ enabled: false });
      stopButton.addListener("execute", this.stop, this);
      this._stopButton = stopButton;
      this.add(stopButton);

      var codeEditor = new qx.ui.form.TextArea();
      codeEditor.set({
        wrap: false
      });
      this._codeEditor = codeEditor;
      this.add(codeEditor, { flex: 1 });
    },

    /**
     * The methods and simple properties of this class
     */
    members: {
      _recorder: null,
      _startButton: null,
      _stopButton: null,
      _codeEditor: null,

      toggle: function toggle(e) {
        if (e.getData()) {
          if (this._recorder.isPaused()) {
            this._recorder.resume();
          } else {
            this._codeEditor.setValue("");
            this._recorder.start();
          }
          this._startButton.setLabel("Recording, click to pause...");
          this._stopButton.setEnabled(true);
        } else {
          this._recorder.pause();
          this._startButton.setLabel("Continue");
        }
      },
      stop: function stop() {
        this._startButton.set({
          enabled: true,
          value: false,
          label: "Start"
        });
        this._stopButton.setEnabled(false);
        this._recorder.stop();
        var script = this._recorder.generateScript(this._recorder.getLines());
        this._codeEditor.setValue(script);
      }
    }
  });
  recorder.UiController.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=UiController.js.map?dt=1544616853424