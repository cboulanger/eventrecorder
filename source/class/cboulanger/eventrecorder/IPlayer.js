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
     * Returns the player type
     * @return {String}
     */
    getType() {},

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


    /*
    ============================================================================
       COMMANDS
    ============================================================================
    */

    /**
     * Asserts that the current url matches the given value (RegExp)
     * @param uri {String}
     */
    cmd_assert_uri(uri) {},

    /**
     * Asserts that the current url matches the given value (RegExp)
     * @param uri_regexp {String} A string containing a regular expression
     */
    cmd_assert_match_uri(uri_regexp) {},

    /**
     * Sets the player mode
     * @param mode
     * @return {string}
     */
    cmd_config_set_mode(mode) {},

    /**
     * Starts a block of statements that return promises. The player will wait for
     * all of the promises to resolve before proceeding.
     */
    cmd_await_all() {},

    /**
     * Starts the definition of a macro
     * @param macro_name
     * @return {null}
     */
    cmd_define(macro_name) {},

    /**
     * Ends the definition of a macro or a block of awaitable statements
     * @return {null}
     */
    cmd_end() {},

    /**
     * Generates code that displays an informational text centered on the screen
     * @param text {String} The text to display
     * @return {String}
     */
    cmd_info(text) {},

    /**
     * Generates code that hides the info pane
     * @return {String}
     */
    cmd_hide_info(text) {},

    /**
     * Generates code that displays an informational text placed next to the widget with the given id.
     * @param id {String} The id of the widget
     * @param text {String} The text to display
     * @return {String}
     */
    cmd_widget_info(id, text) {},

    /**
     * Generates code that returns a promise which resolves when the given
     * property of the object with the given id is assigned the given value.
     * This works also with properties without a change event because the
     * value is periodically checked.
     * @param id {String} The id of the object
     * @param property {String} The name of the property
     * @param value {*} The value, must be serializable to JSON
     * @return {*|string}
     */
    cmd_await_property_value(id, property, value) {},

    /**
     * Generates code that returns a promise which resolves when the following
     * condition is met: the property with the given name of the object with the
     * given id changes to a value that, if serialized to json, matches the given
     * json literal. The json can contain regular expressions enclosed in
     * <! and !> as placeholders (and validators) for unknown values
     * (See {@link cboulanger.eventrecorder.player.Abstract#createRegexpForJsonComparison}
     *
     * @param id {String} The id of the object
     * @param property {String} The name of the property
     * @param json {String} A json expression
     * @return {*|string}
     */
    cmd_await_property_match_json(id, property, json) {},

    /**
     * Generates code that causes the given delay (in milliseconds).
     * The delay is capped by the {@link cboulanger.eventrecorder.player.Abstract#maxDelay} property
     * and will only be caused in presentation mode
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
     * Generates code that returns a promise which resolves when the object with
     * the given id fires an event with the given name.
     * @param id {String} The id of the object
     * @param type {String} The type of the event
     * @return {*|string}
     */
    cmd_await_event(id, type) {},

    /**
     * Generates code that returns a promise which resolves when the object with
     * the given id fires an event with the given name.
     * @param id {String} The id of the object
     * @param type {String} The type of the event
     * @param data {*} The data to expect. Must be serializable to JSON
     * @return {*|string}
     */
    cmd_await_event_data(id, type, data) {},

    /**
     * Generates code that returns a promise which resolves when the object with
     * the given id fires an event with the given name with event data that
     * matches, if serialized to JSON, the given json string, which can contain
     * regular expressions embedded in <! and !>
     * @param id {String} The id of the object
     * @param type {String} The type of the event
     * @param json {*} A JSON expression that can contain regular expressions
     * embedded in <! and !>
     * @return {*|string}
     */
    cmd_await_event_match_json(id, type, json) {},

    /**
     * Generates code that returns a promise with resolves when the object with the given id becomes visible and rejects
     * if the timeout is reached before that happens.
     * @param id {String}
     * @return {String}
     */
    cmd_assert_appeared(id) {},

    /**
     * Generates code that returns a promise with resolves when the object with the given id disappears and rejects
     * if the timeout is reached before that happens.
     * @param id {String}
     * @return {String}
     */
    cmd_assert_disappeared(id) {},

    /**
     * Generates code that fires an `execute` event on the object with the given id (Button, Command)
     * @param id {String}
     * @return {String}
     */
    cmd_execute(id) {},

    /**
     * Generates code that fires an event with the given payload on the object with the given id (Button, Command)
     * @param id {String}
     * @param event {String}
     * @param json {*}
     * @return {String}
     */
    cmd_fire(id,event,json) {},/**

    /**
    * Generates code that fires an `tap` event on the object with the given id (Button, Command)
    * @param id {String}
    * @return {String}
    */
    cmd_tap(id) {},

    /**
    * Generates code that fires an `dbltap` event on the object with the given id (Button, Command)
    * @param id {String}
    * @return {String}
    */
    cmd_dbltap(id) {},

    /**
     * Generates code that sets the `value` property of the object with the given id
     * @param id {String}
     * @param data {String} A JSON expression
     * @return {string}
     */
    cmd_set_value(id, data) {},

    /**
     * Generates code that returns a promise which resolves when the value
     * property of the object with the given id is assigned the given value.
     * The value must be given in JSON format, i.e. strings must be quoted.
     * @param id {String} The id of the object
     * @param value {String} The value, must be serializable to JSON
     * @return {*|string}
     */
    cmd_await_value(id, value) {},

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
     * Generates code that sets a selection for all objects which have a `setSelection` method that
     * takes an array of qooxdoo widgets that should be selected.
     * @param id {String} Id of the object ón which the selection is set
     * @param selectedId {String} The id of the widget that is selected. Only one widget can be selected at this time
     * @return {String}
     */
    cmd_set_selection(id, selectedId) {},

    /**
     * Generates code that awaits a selection for all objects which have a `setSelection` method that
     * takes an array of qooxdoo widgets that should be selected within the timeout
     * @param id {String} Id of the object ón which the selection is set
     * @param selectedId {String} The id of the widget that should be selected
     * @return {String}
     */
    cmd_await_selection(id, selectedId) {},


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
     * @param index {String|Number} The index of the selection in the selectables
     * @return {String}
     */
    cmd_set_selection_from_selectables(id, index) {},

    /**
     * Generates code that awaits a selection on widgets that have a `getSelectables()` method
     * @param id {String} The id of the widget on which the selection is set
     * @param index {String|Number} The index of the selection in the selectables
     * @return {String}
     */
    cmd_await_selection_from_selectables(id, index) {},

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
