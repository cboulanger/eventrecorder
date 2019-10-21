(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "cboulanger.eventrecorder.player.Abstract": {
        "require": true
      },
      "cboulanger.eventrecorder.IPlayer": {
        "require": true
      },
      "qx.lang.String": {},
      "qx.lang.Type": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

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
    implement: [cboulanger.eventrecorder.IPlayer],
    properties: {
      canReplayInBrowser: {
        refine: true,
        init: true
      }
    },
    members: {
      /**
       * Returns the player type
       * @return {String}
       */
      getType() {
        return "qooxdoo";
      },

      /**
       * @inheritDoc
       */
      getExportFileExtension() {
        return "js";
      },

      /**
       * Translates the intermediate code into the target language
       * @param script
       * @return {string} executable code
       */
      async translate(script) {
        let lines = (await this._translate(script)).split(/\n/).map(line => line.startsWith("(") ? "await ".concat(line, ";") : line).filter(line => Boolean(line)).map(line => "  " + line);
        lines.unshift("async function test() {");
        lines.push("}");
        return lines.join("\n");
      },

      /*
      ============================================================================
         COMMANDS
      ============================================================================
      */

      /**
       * @inheritDoc
       */
      cmd_info(text) {
        text = text.replace(/"/g, "");

        if (this.getMode() === "presentation") {
          return "cboulanger.eventrecorder.InfoPane.getInstance().useIcon(\"info\").display(\"".concat(text, "\");");
        }

        return "console.log(\"".concat(text, "\");");
      },

      /**
       * @inheritDoc
       */
      cmd_hide_info(text) {
        if (this.getMode() === "presentation") {
          return "cboulanger.eventrecorder.InfoPane.getInstance().hide();";
        }

        return "";
      },

      /**
       * @inheritDoc
       */
      cmd_widget_info(id, text) {
        text = text.replace(/"/g, "");

        if (this.getMode() === "presentation") {
          return "cboulanger.eventrecorder.InfoPane.getInstance().useIcon(\"info\").display(\"".concat(text, "\",qx.core.Id.getQxObject(\"").concat(id, "\"));");
        }

        return "";
      },

      /**
       * Generates code that causes the given delay (in milliseconds).
       * The delay is capped by the {@link #cboulanger.eventrecorder.player.Abstract#maxDelay} property
       * and will only be caused in presentation mode
       * @param delayInMs {Number}
       * @return {string}
       */
      cmd_delay(delayInMs) {
        delayInMs = Math.min(delayInMs, this.getMaxDelay());
        return this.getMode() === "presentation" && delayInMs > 0 ? "(new Promise(resolve => setTimeout(resolve,".concat(delayInMs, ")))") : "";
      },

      /**
       * Generates code that waits the given time in milliseconds, regardless of player mode
       * @param timeInMs {Number}
       * @return {string}
       */
      cmd_wait(timeInMs) {
        return "(new Promise(resolve => setTimeout(resolve,".concat(timeInMs, ")))");
      },

      /**
       * @inheritDoc
       */
      cmd_await_property_value(id, property, value) {
        return this.generateWaitForConditionCode("JSON.stringify(qx.core.Id.getQxObject(\"".concat(id, "\").get").concat(qx.lang.String.firstUp(property), "())==='").concat(JSON.stringify(value).replace(/'/, "\\'"), "'"));
      },

      /**
       * @inheritDoc
       */
      cmd_await_property_match_json(id, property, json) {
        if (!qx.lang.Type.isString(json)) {
          json = JSON.stringify(json);
        }

        let regExLiteral = this.createRegexpForJsonComparison(json);
        let timeoutmsg = "Timeout waiting for ID(".concat(id, ").").concat(property, " to match /").concat(regExLiteral.replace(/\\/, "\\\\").replace(/"/g, "\\\""), "/.");
        let type = "change" + qx.lang.String.firstUp(property);
        return this.generateWaitForEventCode(id, type, "{verbatim}/".concat(regExLiteral, "/"), timeoutmsg);
      },

      /**
       * Generates code that returns a promise which resolves when the object with
       * the given id fires an event with the given name.
       * @param id {String} The id of the object
       * @param type {String} The type of the event
       * @return {*|string}
       */
      cmd_await_event(id, type) {
        if (this.getMode() === "presentation") {
          return this.generateWaitForEventTimoutFunction(id, type, undefined, "if (window[\"".concat(this._globalRef, "\"].isRunning()) cboulanger.eventrecorder.InfoPane.getInstance().show().animate(); else return resolve(false)"));
        }

        return this.generateWaitForEventCode(id, type);
      },

      /**
       * @inheritDoc
       */
      cmd_await_event_data(id, type, data) {
        if (data !== undefined) {
          try {
            JSON.stringify(data);
          } catch (e) {
            throw new Error("Data must be serializable to JSON");
          }
        }

        if (this.getMode() === "presentation") {
          return this.generateWaitForEventTimoutFunction(id, type, data, "if (window[\"".concat(this._globalRef, "\"].isRunning()) cboulanger.eventrecorder.InfoPane.getInstance().show().animate(); else return resolve();"));
        }

        return this.generateWaitForEventCode(id, type, data);
      },

      /**
       * @inheritDoc
       */
      cmd_await_event_match_json(id, type, json) {
        if (this.getMode() === "presentation") {
          return this.generateWaitForEventTimoutFunction(id, type, json, "if (window[\"".concat(this._globalRef, "\"].isRunning()) cboulanger.eventrecorder.InfoPane.getInstance().show().animate(); else return resolve();"));
        }

        return this.generateWaitForEventCode(id, type, json);
      },

      /**
       * Generates code that returns a promise with resolves when the object with the given id becomes visible and rejects
       * if the timeout is reached before that happens.
       * @param id {String}
       * @return {String}
       */
      cmd_assert_appeared(id) {
        return "if(!qx.core.Id.getQxObject(\"".concat(id, "\").isVisible()) throw new Error(\"Failed: Object with id ").concat(id, " is not visible.\")");
      },

      /**
       * @deprecated
       */
      cmd_check_appear: this.cmd_assert_appeared,

      /**
       * Generates code that returns a promise with resolves when the object with the given id disappears and rejects
       * if the timeout is reached before that happens.
       * @param id {String}
       * @return {String}
       */
      cmd_assert_disappeared(id) {
        return "if (qx.core.Id.getQxObject(\"".concat(id, "\").isVisible()) throw new Error(\"Failed: Object with id ").concat(id, " is visible.\")");
      },

      /**
       * @deprecated
       */
      cmd_check_disappear: this.cmd_assert_disappeared,

      /**
       * @inheritDoc
       * @return {String}
       */
      cmd_execute(id) {
        return "if(!qx.core.Id.getQxObject(\"".concat(id, "\").isEnabled()) throw new Error(\"Failed: Object with id ").concat(id, " is not enabled.\"); qx.core.Id.getQxObject(\"").concat(id, "\").fireEvent(\"execute\");");
      },

      /**
       * @inheritDoc
       * @return {String}
       */
      cmd_contextmenu(id) {
        return "if(!qx.core.Id.getQxObject(\"".concat(id, "\").isEnabled()) throw new Error(\"Failed: Object with id ").concat(id, " is not enabled.\"); let tgt = qx.core.Id.getQxObject(\"").concat(id, "\").getContentElement().getDomElement(); let r = tgt.getBoundingClientRect(), clientX=parseInt((r.right+r.left)/2), clientY=parseInt((r.bottom+r.top)/2); qx.event.Registration.fireEvent(tgt, \"contextmenu\", qx.event.type.Mouse, [new MouseEvent(\"contextmenu\", {clientX,clientY}),tgt,null,true,true]);");
      },

      /**
       * Generates code that fires an event with the given payload on the object with the given id (Button, Command)
       * @param id {String}
       * @param event {String}
       * @param json {*}
       * @return {String}
       */
      cmd_fire(id, event, json) {
        if (json) {
          if (!qx.lang.Type.isString(json)) {
            json = JSON.stringify(json);
          }

          return "qx.core.Id.getQxObject(\"".concat(id, "\").fireDataEvent(\"").concat(event, "\",").concat(json, ");");
        }

        return "qx.core.Id.getQxObject(\"".concat(id, "\").fireEvent(\"").concat(event, "\");");
      },

      /**
       * Generates code that fires an `tap` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_tap(id) {
        // doesn't work yet because it needs mouse data etc.
        return ""; //return `qx.core.Id.getQxObject("${id}").fireEvent("tap", qx.event.type.Tap);`;
      },

      /**
       * Generates code that fires an `dbltap` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_dbltap(id) {
        // doesn't work yet because it needs mouse data etc.
        return ""; //return `qx.core.Id.getQxObject("${id}").fireEvent("dbltap", qx.event.type.Tap);`;
      },

      /**
       * @inheritDoc
       */
      cmd_set_value(id, data) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").setValue(").concat(JSON.stringify(data), ");");
      },

      /**
       * @inheritDoc
       */
      cmd_await_value(id, value) {
        return this.cmd_await_property_value(id, "value", value);
      },

      /**
       * Generates code that opens a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
       * @param id {String} The id of the {@link qx.ui.tree.VirtualTree}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_open_tree_node(id, nodeIndex) {
        return "let t = qx.core.Id.getQxObject(\"".concat(id, "\"); t.openNode(t.getLookupTable().getItem(").concat(nodeIndex, "));");
      },

      /**
       * Generates code that closes a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_close_tree_node(id, nodeIndex) {
        return "let t = qx.core.Id.getQxObject(\"".concat(id, "\"); t.closeNode(t.getLookupTable().getItem(").concat(nodeIndex, "));");
      },

      /**
       * Generates code that opens a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_open_tree_node_treevirtual(id, nodeIndex) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").getDataModel().setState(").concat(nodeIndex, ",{bOpened:true});");
      },

      /**
       * Generates code that closes a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_close_tree_node_treevirtual(id, nodeIndex) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").getDataModel().setState(").concat(nodeIndex, ",{bOpened:false});");
      },

      /**
       * Generates code that sets a selection for all objects which have a `setSelection` method that
       * takes an array of qooxdoo widgets that should be selected.
       * @param id {String} Id of the object ón which the selection is set
       * @param selectedId {String} The id of the widget that is selected. Only one widget can be selected at this time
       * @return {String}
       */
      cmd_set_selection(id, selectedId) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").setSelection([qx.core.Id.getQxObject(\"").concat(selectedId, "\")]);");
      },

      /**
       * Generates code that awaits a selection for all objects which have a `setSelection` method that
       * takes an array of qooxdoo widgets that should be selected within the timeout
       * @param id {String} Id of the object ón which the selection is set
       * @param selectedId {String} The id of the widget that should be selected
       * @return {String}
       */
      cmd_await_selection(id, selectedId) {
        let timeoutmsg = "Timeout when waiting for selection of object '".concat(selectedId, "' on '").concat(id, "'.");
        return this.generateWaitForEventCode(id, "changeSelection", "{verbatim}[qx.core.Id.getQxObject(\"".concat(selectedId, "\")]"), timeoutmsg);
      },

      /**
       * Generates code that sets a selection for all (virtual) widgets that have a data model
       * @param id {String} The id of the widget on which the selection is set
       * @param indexArray {Array} An array containing the indexes of the models
       * @return {String}
       */
      cmd_set_model_selection(id, indexArray) {
        return "let o = qx.core.Id.getQxObject(\"".concat(id, "\"); o.setSelection(new qx.data.Array(").concat(JSON.stringify(indexArray), ".map(i => o.getModel().getItem(i))));");
      },

      /**
       * Generates code that awaits a selection for all (virtual) widgets that have a data model
       * @param id {String} The id of the widget on which the selection is set
       * @param indexArray {Array} An array containing the indexes of the models
       * @return {String}
       */
      // cmd_await_model_selection(id, indexArray) {
      //
      //   return `let o = qx.core.Id.getQxObject("${id}"); o.setSelection(new qx.data.Array(${JSON.stringify(indexArray)}.map(i => o.getModel().getItem(i))))`;
      //   return `(waitForEvent(qx.core.Id.getQxObject("${id}").getSelection(), "change",${data}, ${this.getTimeout()}, "${timeoutmsg||"Timeout waiting for event '"+type+"'"}"))`;
      // },

      /**
       * @inheritDoc
       */
      cmd_set_selection_from_selectables(id, index) {
        return "let o = qx.core.Id.getQxObject(\"".concat(id, "\"); o.setSelection([o.getSelectables()[").concat(index, "]]);");
      },

      /**
       * @inheritDoc
       */
      cmd_await_selection_from_selectables(id, index) {
        return this.generateWaitForEventCode(id, "changeSelection", "{verbatim}[qx.core.Id.getQxObject(\"".concat(id, "\").getSelectables()[").concat(index, "]]"));
      },

      /**
       * Resets the selection of a widget that has a `selection` property or a `resetSelection` method.
       * @param id {String} The id of the widget
       * @return {string}
       */
      cmd_reset_selection(id) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").resetSelection();");
      },

      /**
       * Generates code that sets an selection interval on a {@link qx.ui.table.Table}
       * @param id {String} The id of a {@link qx.ui.table.Table}
       * @param interval {String} The first and the last row to be selected, separated by comma.
       * @return {String}
       */
      cmd_set_table_selection(id, interval) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").addSelectionInterval(").concat(interval, ");");
      },

      /**
       * Generates code that set the selection on a {@link qx.ui.virtual.selection.Row} object
       * @param id {String} The id of a qx.ui.virtual.selection.Row object
       * @param rowIndex {String|Number} The index of the row to be selected
       * @return {String}
       */
      cmd_set_row_selection(id, rowIndex) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").selectItem(").concat(rowIndex, ");");
      }

    }
  });
  cboulanger.eventrecorder.player.Qooxdoo.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=Qooxdoo.js.map?dt=1571643379484