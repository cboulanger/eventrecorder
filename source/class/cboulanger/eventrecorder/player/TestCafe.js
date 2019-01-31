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
qx.Class.define("cboulanger.eventrecorder.player.TestCafe", {

  extend : cboulanger.eventrecorder.player.Abstract,

  members :
  {
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
      let line;
      switch (event.getType()) {
        case "pointerup":
          line = `.click(IdSelector("${id}"))`;
          break;
        case "appear":
          line = `.expect(IdSelector("${id}").visible).ok()`;
          break;
        case "disappear":
          line = `.expect(IdSelector("${id}").visible).notOk()`;
          break;
        default:
          return [];
        //console.log(`//${id}: ${event.getType()}`);
      }
      return [line];
    }
  }
});
