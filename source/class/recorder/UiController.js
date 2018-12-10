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
 * This is a qooxdoo class
 */
qx.Class.define("recorder.UiController",
{
  
  extend : qx.ui.window.Window,

  /**
   * Constructor
   */
  construct : function(recorderImplementation) {
    this.base(arguments);
    this.set({
      width: 200,
      height: 400,
      modal: false,
      layout : new qx.ui.layout.VBox(5)
    });

    if (! recorderImplementation instanceof recorder.AbstractRecorder){
      this.error("Argument must be instanceof recorder.AbstractRecorder.");
      return;
    }
    this._recorder = recorderImplementation;

    let startButton = new qx.ui.form.Button("Start",null);
    startButton.addListener("execute", this.start, this);
    this._startButton = startButton;
    this.add(startButton);

    let pauseButton = new qx.ui.form.Button("Pause",null);
    pauseButton.set({ enabled: false });
    pauseButton.addListener("execute", this.pause, this);
    this._pauseButton = pauseButton;
    this.add(pauseButton);

    let stopButton = new qx.ui.form.Button("Stop",null);
    stopButton.set({enabled:false});
    stopButton.addListener("execute", this.stop, this);
    this._stopButton = stopButton;
    this.add(stopButton);

    let codeEditor = new qx.ui.form.TextArea();
    this._codeEditor = codeEditor;
    this.add(codeEditor, {flex:1});
  },


  /**
   * The methods and simple properties of this class
   */
  members :
  {
    _recorder : null,
    _startButton : null,
    _pauseButton : null,
    _stopButton : null,
    _codeEditor : null,

    start() {
      console.log(this);
      this._recorder.start();
      this._startButton.setEnabled(false);
      this._pauseButton.setEnabled(true);
      this._stopButton.setEnabled(true);
    },

    pause() {
      this._recorder.pause();
      this._startButton.setEnabled(true);
      this._pauseButton.setEnabled(false);
    },

    stop() {
      this._recorder.stop();
      this._stopButton.setEnabled(false);
      this._pauseButton.setEnabled(false);
      this._startButton.setEnabled(true);
    }
  }
});