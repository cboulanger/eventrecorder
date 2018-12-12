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
qx.Class.define("recorder.type.Qooxdoo",
{
  
  extend : recorder.AbstractRecorder,

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
        case "execute":
          line = `id.getObject("${id}").fireEvent('execute');`;
          break;
        case "appear":
          line = `qx.core.Assert.assertTrue(id.getObject("${id}").isVisible());`;
          break;
        case "disappear":
          line = `qx.core.Assert.assertFalse(id.getObject("${id}").isVisible());`;
          break;
        default:
          return [];
        //console.log(`//${id}: ${event.getType()}`);
      }
      return [line];
    },

    /**
     * Given an array of script lines, return a piece of code that can be
     * pasted into a test suite.
     * @param {String[]} lines Array of script lines
     * @return {String}
     */
    generateScript(lines) {
      lines.unshift("let id = qx.core.Id;");
      return lines.join("\n");
    }
  }
});