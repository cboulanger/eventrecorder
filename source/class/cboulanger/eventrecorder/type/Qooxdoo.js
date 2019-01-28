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
      const type = event.getType();
      let data = typeof event.getData == "function" ? event.getData() : null;
      let owner = typeof target.getQxOwner == "function" ? target.getQxOwner() : null;
      switch (type) {
        case "execute":
          switch (true) {
            case owner instanceof qx.ui.form.DateField:
            case target instanceof qx.ui.tree.core.FolderOpenButton:
              return [];
          }
          line = `qx.core.Id.getQxObject("${id}").fireEvent('execute');`;
          break;
        case "appear":
        case "disappear":
          if (qx.ui.core.FocusHandler.getInstance().isFocusRoot(qx.core.Id.getQxObject(id))) {
            line = `qx.core.Assert.assert${type==="appear"?"True":"False"}(qx.core.Id.getQxObject("${id}").isVisible());`;
            break;
          }
          return [];
        case "change": {
          const isModelSelection =
            target instanceof qx.data.Array &&
            target.getQxOwner() &&
            typeof target.getQxOwner().getModel == "function";
          if (isModelSelection) {
            const owner = target.getQxOwner();
            const ownerId = qx.core.Id.getAbsoluteIdOf(owner);
            const model = target.getQxOwner().getModel();
            const indexes = target.toArray().map(item => model.indexOf(item));
            line = `let obj = qx.core.Id.getQxObject("${ownerId}"); obj.setSelection(new qx.data.Array(${JSON.stringify(indexes)}.map(i => obj.getModel().getItem(i))));`;
            break;
          }
          // other form fields
          if (typeof data === "string") {
            data = "\"" + data + "\"";
          }
          line = `qx.core.Id.getQxObject("${id}").setValue(${data});`;
          break;
        }
        case "open":
        case "close": {
          if (target instanceof qx.ui.tree.VirtualTree) {
            let row = target.getLookupTable().indexOf(data);
            line = `let tree = qx.core.Id.getQxObject("${id}"); tree.${type}Node(tree.getLookupTable().getItem(${row}));`;
            break;
          }
          return [];
        }
        // qx.ui.treevirtual.TreeVirtual
        case "treeClose":
        case "treeOpenWithContent":
        case "treeOpenWhileEmpty":
          line = `qx.core.Id.getQxObject("${id}").getDataModel().setState(${Number(data.nodeId)},{bOpened:${type==="treeClose"?"false":"true"}});`;
          break;
        case "changeSelection": {
          if (target instanceof qx.ui.virtual.selection.Row) {
            line = `qx.core.Id.getQxObject("${id}").selectItem(${Number(data)});`;
            break;
          }
          if (target instanceof qx.ui.table.selection.Model) {
            line = `let sm = qx.core.Id.getQxObject("${id}"); sm.resetSelection();`;
            let ranges = target.getSelectedRanges();
            if (ranges.length) {
              line += `sm.addSelectionInterval(${ranges[0].minIndex}, ${ranges[0].maxIndex});`;
            }
            break;
          }
          if (data && data.length && qx.lang.Type.isArray(data)) {
            let selected = data[0];
            if (selected instanceof qx.core.Object && selected.getQxObjectId()) {
              let selectedId = qx.core.Id.getAbsoluteIdOf(selected);
              line = `qx.core.Id.getQxObject("${id}").setSelection([qx.core.Id.getQxObject("${selectedId}")]);`;
              break;
            } else if (typeof target.getSelectables == "function") {
              let index = target.getSelectables().indexOf(selected);
              line = `let obj = qx.core.Id.getQxObject("${id}"); obj.setSelection([obj.getSelectables()[${index}]]);`;
              break;
            }
          }
          return [];
        }
        default:
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
