/* ************************************************************************

  UI Event Recorder

  Copyright:
    2019 Christian Boulanger

  License:
    MIT license
    See the LICENSE file in the project's top-level directory for details.

  Authors:
    Christian Boulanger (cboulanger) info@bibliograph.org

************************************************************************ */

/**
 * This interface defines the events and methods a player must implement
 */
qx.Interface.define("cboulanger.eventrecorder.IPlayer", {

  /**
   * Events that must be declared by this interface
   */
  events: {
    /**
     * Fired with each step of the replayed script. The event data is an array
     * containing the number of the step and the number of steps
     */
    "progress" : "qx.event.type.Data"
  },

  /**
   * Methonds that must be declared by this interface
   */
  members :
  {

    /**
     * Starts the player
     */
    start() {},

    /**
     * Stops the recording.
     */
    stop() {},

    /**
     * Replays the given script of intermediate code
     * @param script {String} The script to replay
     * @return {Promise} Promise which resolves when the script has been replayed, or
     * rejecdts with an error
     */
    async replay(script) {},

    /**
     * Translates the intermediate code into the target language
     * @param script
     * @return {string} Javasc
     */
    translate(script) {},

    /**
     * Returns the file extension of the downloaded file in the target language
     * @return {string}
     */
    getExportFileExtension() {},


    /***** COMMANDS ******/

    /**
     * Generates code that causes the given delay (in milliseconds).
     * The delay is capped by the {@link cboulanger.eventrecorder.player.Abstract#maxDelay} property
     * @param delayInMs {Number}
     * @return {string}
     */
    cmd_delay(delayInMs) {},

    /**
     * Generates code that waits the given time in milliseconds, regardless of player mode
     * @param timeInMs {Number}
     * @return {string}
     */
    cmd_wait(timeInMs) {},


    /**
     * Generates code that returns a promise with resolves when the object with the given id becomes visible and rejects
     * if the timeout is reached before that happens.
     * @param id {String}
     * @return {String}
     */
    cmd_check_appear(id) {},

    /**
     * Generates code that returns a promise with resolves when the object with the given id disappears and rejects
     * if the timeout is reached before that happens.
     * @param id {String}
     * @return {String}
     */
    cmd_check_disappear(id) {},


    /**
     * Generates code that fires an `execute` event on the object with the given id (Button, Command)
     * @param id {String}
     * @return {String}
     */
    cmd_execute(id) {},

    /**
     * Generates code that sets the `value` property of the object with the given id
     * @param id {String}
     * @param data {String} A JSON expression
     * @return {string}
     */
    cmd_set_value(id, data) {},

    /**
     * Generates code that opens a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
     * @param id {String} The id of the {@link qx.ui.tree.VirtualTree}
     * @param nodeIndex {String|Number} The index of the node in the tree data model
     * @return {String}
     */
    cmd_open_tree_node(id, nodeIndex) {},

    /**
     * Generates code that closes a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
     * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
     * @param nodeIndex {String|Number} The index of the node in the tree data model
     * @return {String}
     */
    cmd_close_tree_node(id, nodeIndex) {},

    /**
     * Generates code that opens a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
     * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
     * @param nodeIndex {String|Number} The index of the node in the tree data model
     * @return {String}
     */
    cmd_open_tree_node_treevirtual(id, nodeIndex) {},

    /**
     * Generates code that closes a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
     * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
     * @param nodeIndex {String|Number} The index of the node in the tree data model
     * @return {String}
     */
    cmd_close_tree_node_treevirtual(id, nodeIndex) {},

    /**
     * Generates code that sets a selection for all objects which have a `setSelection` command that
     * takes an array of qooxdoo widgets that should be selected.
     * @param id {String} Id of the object ón which the selection is set
     * @param selectedId {String} The id of the widget that is selected. Only one widget can be selected at this time
     * @return {String}
     */
    cmd_set_selection(id, selectedId) {},

    /**
     * Generates code that sets a selection for all (virtual) widgets that have a data model
     * @param id {String} The id of the widget on which the selection is set
     * @param indexArray {String} An array literal containing the indexes of the models
     * @return {String}
     */
    cmd_set_model_selection(id, indexArray) {},

    /**
     * Generates code that sets a selection on widgets that have a `getSelectables()` method
     * @param id {String} The id of the widget on which the selection is set
     * @param index {String|Number}
     * @return {String}
     */
    cmd_set_from_selectables(id, index) {},

    /**
     * Resets the selection of a widget that has a `selection` property or a `resetSelection` method.
     * @param id {String} The id of the widget
     * @return {string}
     */
    cmd_reset_selection(id) {},

    /**
     * Generates code that sets an selection interval on a {@link qx.ui.table.Table}
     * @param id {String} The id of a {@link qx.ui.table.Table}
     * @param interval {String} The first and the last row to be selected, separated by comma.
     * @return {String}
     */
    cmd_set_table_selection(id, interval) {},

    /**
     * Generates code that set the selection on a {@link qx.ui.virtual.selection.Row} object
     * @param id {String} The id of a qx.ui.virtual.selection.Row object
     * @param rowIndex {String|Number} The index of the row to be selected
     * @return {String}
     */
    cmd_set_row_selection(id, rowIndex) {}
  }
});
