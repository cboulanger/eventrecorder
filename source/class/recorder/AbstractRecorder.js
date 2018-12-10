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
qx.Class.define("recorder.AbstractRecorder",
{
  
  extend : qx.core.Object,
  //include : [ Mixin1, Mixin2 ],

  /**
   * Constructor
   */
  // construct : function() {
  //   this.base(arguments);
  // },


  /**
   * The methods and simple properties of this class
   */
  members :
  {
    _running : false,
    _script : null,

    start() {
      this._running = true;
    },

    pause() {
      this._running = false;
    },

    stop() {
      this.pause();
      let script = this.generateScript();
      this.
    },

    generateScript(){
      this.error("writeScript() must be implemented in subclass.");
    }
  }
});