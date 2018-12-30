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
qx.Class.define("contrib.cboulanger.eventrecorder.AbstractRecorder",
{
  
  extend : qx.core.Object,
  include : [contrib.cboulanger.eventrecorder.MHelperMethods],

  /**
   * Constructor
   */
  construct : function() {
    this.base(arguments);
    this.__excludeIds = [];
    this.addGlobalEventListener((target, event) => {
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
    __excludeIds : null,

    /**
     * Exclude the given id(s) from recording
     * @param ids {Array|String}
     */
    excludeIds(ids){
      // normalize to array
      ids = qx.lang.Type.isArray(ids)? ids: [ids];
      // add ids that are not yet included by path
      for (let id of ids) {
        let found=false;
        for (let excluded of this.__excludeIds){
          if (id.substr(0, excluded.length) === excluded) found = true;
        }
        if (!found) {
          this.debug(`Excluding ${id} from event recording.`);
          this.__excludeIds.push(id);
        }
      }
    },

    /**
     * Starts the recorder, overwriting any recorded events
     */
    start() {
      this.__lines = [];
      this.__running = true;
      this.__paused = false;
    },

    /**
     * Pause the recorder
     */
    pause() {
      this.__running = false;
      this.__paused = true;
    },

    /**
     * Returns true if the recorder is paused
     * @return {boolean}
     */
    isPaused() {
      return this.__paused;
    },

    /**
     * Resumes recording.
     */
    resume() {
      this.__running = true;
      this.__paused = false;
    },

    /**
     * Stops the recording.
     */
    stop() {
      this.__running = false;
      this.__paused = false;
    },

    /**
     * Called by the global event listener
     * @param id {String}
     * @param event {qx.event.type.Event}
     * @param target {qx.bom.Element}
     * @private
     * @return {boolean} returns true if the event was recorded, false if
     * it was ignored because of the list of excluded ids.
     */
    _recordEvent(id, event, target){
      for (let excluded of this.__excludeIds){
        if (id.substr(0, excluded.length) === excluded) return false;
      }
      this.__lines = this.__lines.concat(this.recordEvent(id, event, target));
      return true;
    },

    /**
     * Returns the script as an array of lines
     * @return {Array|null}
     */
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
      throw new Error("Method recordEvent() must be implemented by subclass.");
    },

    /**
     * Given an array of script lines, return a piece of code that can be
     * pasted into a test suite.
     * @param {String[]} lines Array of script lines
     * @return {String}
     */
    generateScript(lines){
      throw new Error("Method generateScript() must be implemented by subclass.");
    },

    /**
     * If the recorder is able to replay the generated script, override this
     * method and return true
     * @return {boolean}
     */
    canReplay() {
      return false;
    },

    /**
     * Implement in subclass if the recorder can replay the given script
     * @param script {Array} The script to replay, as an array of self-contained lines
     * @param delay {Number} The delay in miliseconds, defaults to 500
     * @return {Promise} Promise which resolves when the script has been replayed, or
     * rejects with an error
     */
    async replay(script, delay=500) {
      if (! this.canReplay()) throw new Error("This recorder cannot replay the event log");
      throw new Error("Method replay() must be implemented by subclass");
    }
  }
});