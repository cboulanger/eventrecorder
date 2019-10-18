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
 * An example for a custom recorder that extends the standard
 */
qx.Class.define("cboulanger.eventrecorder.recorder.ExampleCustomRecorder", {
  extend : cboulanger.eventrecorder.recorder.Recorder,
  members: {

    /**
     * This method extends {@link cboulanger.eventrecorder.recorder.Recorder._eventToCode}.
     * @param id {String} The id of the qooxdoo object
     * @param event {qx.event.Event} The event that was fired
     * @param target {qx.bom.Element|qx.core.Object} The event target
     * @return {String[]} An array of script lines
     */
    _eventToCode(id, event, target) {
      const type = event.getType();
      if (type === "someEvent") {
        return ["console.log('some event was fired');"];
      }
      return this.base(arguments, id, event, target);
    }
  }
});
