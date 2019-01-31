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
 * This is an event player that works in the client
 */
qx.Class.define("cboulanger.eventrecorder.player.Qooxdoo", {

  extend: cboulanger.eventrecorder.player.Abstract,

  include: [cboulanger.eventrecorder.MState],

  properties: {
    canReplay: {
      refine: true,
      init: true
    }
  },

  members:
  {

    /**
     * Given a line of intermediate code, return a line of javascript code that
     * can replay the corresponding user action.
     * @param code {String} A line of intermediate code
     * @return {String} A line of javascript code
     */
    generateReplayCode(code) {
      let [command, id, data] = code.split(/ /);
      switch (command) {
        /**
         * wait <ms>
         */
        case "wait":
          return `(new Promise(resolve => setTimeout(resolve,${id})))`;

        /** CHECKS */

        /**
         * check-(dis)appear <id>
         */
        case "check-appear":
        case "check-disappear":
          return this.generateWaitForCode(`${command==="check-appear"?"":"!"}qx.core.Id.getQxObject("${id}").isVisible()`);

        /** COMMANDS */

        /**
         * execute <id>
         */
        case "execute":
          return `qx.core.Id.getQxObject("${id}").fireEvent('execute')`;
        /**
         * set-value <id> <json value>
         */
        case "set-value":
          return `qx.core.Id.getQxObject("${id}").setValue(${data});`;
        /**
         * (open|close)-tree-node-treevirtual <id> <node id>
         * (qx.ui.treevirtual.TreeVirtual)
         */
        case "open-tree-node-treevirtual":
        case "close-tree-node-treevirtual": {
          let type = command.startsWith("open") ? "open" : "close";
          return `let t = qx.core.Id.getQxObject("${id}"); t.${type}Node(t.getLookupTable().getItem(${data}))`;
        }
        /**
         * set-selection <id> <id of selected object>
         */
        case "set-selection":
          return `qx.core.Id.getQxObject("${id}").setSelection([qx.core.Id.getQxObject("${data}")])`;
        /**
         * set-model-selection <id> <array of integer ids>
         */
        case "set-model-selection":
          return `let o = qx.core.Id.getQxObject("${id}"); o.setSelection(new qx.data.Array(${data}.map(i => o.getModel().getItem(i))))`;
        /**
         * set-from-selectables <id> <index>
         */
        case "set-from-selectables":
          return `let o = qx.core.Id.getQxObject("${id}"); o.setSelection([o.getSelectables()[${data}]])`;
        /**
         * reset-table-selection <id>
         * set-table-selection <id> <array of row ids>
         * (qx.ui.table.Table)
         */
        case "reset-table-selection":
          return `qx.core.Id.getQxObject("${id}").resetSelection();`;
        case "set-table-selection":
          return `qx.core.Id.getQxObject("${id}").addSelectionInterval(${data}`;
        /**
         * set-row-selection <id> <row index>
         * (qx.ui.virtual.selection.Row)
         */
        case "set-row-selection":
          return `qx.core.Id.getQxObject("${id}").selectItem(${data})`;
        /**
         * Unknown command
         */
        default:
          throw new Error(`Invalid command: ${code}`);
      }
    }
  }
});
