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
qx.Class.define("cboulanger.eventrecorder.type.Qooxdoo", {

  extend : cboulanger.eventrecorder.AbstractRecorder,

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
        case "mouseover":
        case "pointerover":
        case "mousemove":
        case "pointermove":
        case "mouseout":
        case "pointerout":
        case "pointerup":
        case "mouseup":
        case "pointerdown":
        case "mousedown":
        case "tap":
        case "press":
        case "dbltap":
        case "track":
        case "trackstart":
        case "trackend":
        case "focus":
        case "focusin":
        case "focusout":
        case "blur":
        case "activate":
        case "deactivate":
        case "roll":
        case "capture":
        case "losecapture":
        case "click":
        case "dblclick":
        case "loaded":
        case "swipe":
        case "release":
        case "resize":
        case "changeVisibility":
        case "input":
        case "keypress":
        case "keyup":
        case "keydown":
        case "keyinput":
          return [];
        case "execute":
          switch (true) {
            case (target.getQxOwner() instanceof qx.ui.form.DateField):
              return [];
          }
          line = `qx.core.Id.getQxObject("${id}").fireEvent('execute');`;
          break;
        case "appear":
          line = `qx.core.Assert.assertTrue(qx.core.Id.getQxObject("${id}").isVisible());`;
          break;
        case "disappear":
          line = `qx.core.Assert.assertFalse(qx.core.Id.getQxObject("${id}").isVisible());`;
          break;
        case "changeValue":
        case "change": {
          let data = event.getData();
          switch (true) {
            // selection of virtual select box
            case (target.getQxOwner() instanceof qx.ui.form.VirtualSelectBox): {
              let index = target.getQxOwner().getModel().indexOf(data.added[0]);
              line = `let obj = qx.core.Id.getQxObject("${id}"); obj.getQxOwner().setSelection(new qx.data.Array([obj.getQxOwner().getModel().getItem(${index})]));`;
              break;
            }
            // other form fields
            default:
              if (typeof data === "string") {
                data = "\"" + data + "\"";
              }
              line = `qx.core.Id.getQxObject("${id}").setValue(${data});`;
          }
          break;
        }
        case "changeSelection": {
          let selected = event.getData()[0];
          if (typeof target.getSelectables == "function") {
            let index = target.getSelectables().indexOf(selected);
            line = `let obj = qx.core.Id.getQxObject("${id}"); obj.setSelection([obj.getSelectables()[${index}]]);`;
            break;
          }
          return [];
        }
        default:
          console.log(`${id}: ${event.getType()}`);
          return [];
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
      return lines.join("\n");
    },

    /**
     * Returns true to indicate that the recorder can replay its self-generated script
     * @return {boolean}
     */
    canReplay() {
      return true;
    },

    /**
     * Replays the given script
     * @param script {Array} The script to replay, as an array of self-contained lines
     * @param delay {Number} The delay in miliseconds, defaults to 500
     * @return {Promise} Promise which resolves when the script has been replayed, or
     * rejects with an error
     */
    async replay(script, delay=500) {
      if (!(script instanceof Array)) {
        throw new TypeError("Script must be an array of strings");
      }
      for (let line of script) {
        eval(line); // evil!!
        await new Promise(resolve => qx.event.Timer.once(resolve, null, delay));
      }
    }
  }
});
