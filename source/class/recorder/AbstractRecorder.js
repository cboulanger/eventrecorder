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
 * @require(qx.bom.Element)
 */
qx.Class.define("recorder.AbstractRecorder",
{
  
  extend : qx.core.Object,
  //include : [ Mixin1, Mixin2 ],

  /**
   * Constructor
   */
  construct : function() {
    this.base(arguments);
    qx.event.Manager.setGlobalEventMonitor((target, event) => {
      if (!this.__running) return;
      let id;
      if (typeof target.getAttribute == "function" ){
        id = target.getAttribute("data-qx-object-id");
      } else if (target instanceof qx.core.Object ){
        id = qx.core.Id.getAbsoluteIdOf(target,true);
      } else {
        return;
      }
      if (id) {
        this._recordEvent(id, event, target);
      }
    });
  },

  /**
   * The methods and simple properties of this class
   */
  members :
  {
    __running : false,
    __lines : null,
    __paused : false,

    start() {
      this.__lines = [];
      this.__running = true;
      this.__paused = false;
    },

    pause() {
      this.__running = false;
      this.__paused = true;
    },

    isPaused() {
      return this.__paused;
    },

    resume() {
      this.__running = true;
      this.__paused = false;
    },

    stop() {
      this.__running = false;
      this.__paused = false;
    },

    _recordEvent(id, event, target){
      this.__lines = this.__lines.concat(this.recordEvent(id, event, target));
    },

    getLines(){
      return this.__lines;
    },

    /**
     * Given an id, the event and (optionally) the even target, return one or more
     * pieces of code that can replay the user action that lead to this event.
     * Return an array, each element is one line of code
     * @param {String} id The id of the DOM node
     * @param {qx.event.Event} event The event that was fired
     * @param {qx.bom.Element} target The event target
     * @return {String[]} An array of script lines
     */
    recordEvent(id, event, target) {
      this.error("recordEvent() must be implemented by subclass.");
    },

    /**
     * Given an array of script lines, return a piece of code that can be
     * pasted into a test suite.
     * @param {String[]} lines Array of script lines
     * @return {String}
     */
    generateScript(lines){
      this.error("generateScript() must be implemented by subclass.");
    }
  }
});