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
 * The base class of all recorder types
 * @require(qx.bom.Element)
 */
qx.Class.define("cboulanger.eventrecorder.Recorder", {
  extend : qx.core.Object,
  include : [cboulanger.eventrecorder.MHelperMethods, cboulanger.eventrecorder.MState],

  /**
   * Constructor
   */
  construct : function() {
    this.base(arguments);
    this.__excludeIds = [];
    this.__lines = [];
    this.addGlobalEventListener((target, event) => {
      if (!this.isRunning()) {
        return;
      }
      let id;
      if (typeof target.getAttribute == "function") {
        id = target.getAttribute("data-qx-object-id");
      } else if (target instanceof qx.core.Object) {
        id = qx.core.Id.getAbsoluteIdOf(target, true);
      } else {
        return;
      }
      if (id) {
        this.recordEvent(id, event, target);
      }
    });
  },

  /**
   * The methods and simple properties of this class
   */
  members :
  {
    __lines: null,
    __excludeIds: null,
    __lastEventTimestamp: null,

    /**
     * Exclude the given id(s) from recording
     * @param ids {Array|String}
     */
    excludeIds(ids) {
      // normalize to array
      ids = qx.lang.Type.isArray(ids)? ids: [ids];
      // add ids that are not yet included by path
      for (let id of ids) {
        let found=false;
        for (let excluded of this.__excludeIds) {
          if (id.substr(0, excluded.length) === excluded) {
            found = true;
          }
        }
        if (!found) {
          this.debug(`Excluding ${id} from event recording.`);
          this.__excludeIds.push(id);
        }
      }
    },

    /**
     * Called by start()
     */
    beforeStart() {
      this.__lines = [];
      this.__lastEventTimestamp = 0;
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
    recordEvent(id, event, target) {
      for (let excluded of this.__excludeIds) {
        if (id.substr(0, excluded.length) === excluded) {
          return false;
        }
      }
      this.__lines = this.__lines.concat(this.createIntermediateCodeFromEvent(id, event, target));
      return true;
    },

    afterStop() {
      this.__lastEventTimestamp = 0;
    },

    /**
     * Given an object id, the event name and the even target, return one or more
     * pieces of intermediate code from which a player can replay the user action
     * that lead to this event. Return an array, each element is one line of code
     * @param {String} id The id of the qooxdoo object
     * @param {qx.event.Event} event The event that was fired
     * @param {qx.bom.Element} target The event target
     * @return {String[]} An array of script lines
     */
    createIntermediateCodeFromEvent(id, event, target) {
      let lines = [];
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
          lines.push(`execute ${id}`);
          break;
        case "appear":
        case "disappear":
          if (qx.ui.core.FocusHandler.getInstance().isFocusRoot(qx.core.Id.getQxObject(id))) {
            return [`check-${type} ${id}`];
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
            const model = owner.getModel();
            const indexes = target.toArray().map(item => model.indexOf(item));
            lines.push(`set-model-selection ${ownerId} ${JSON.stringify(indexes)}`);
            break;
          }
          // other form fields
          if (typeof data === "string") {
            data = "\"" + data + "\"";
          }
          lines.push(`set-value ${id} ${data}`);
          break;
        }
        case "open":
        case "close": {
          if (target instanceof qx.ui.tree.VirtualTree) {
            let row = target.getLookupTable().indexOf(data);
            lines.push(`${type}-tree-node ${id} ${row}`);
          }
          return [];
        }
        // qx.ui.treevirtual.TreeVirtual
        case "treeClose":
        case "treeOpenWithContent":
        case "treeOpenWhileEmpty":
          lines.push(`${type==="treeClose"?"close-tree-node-treevirtual":"open-tree-node-treevirtual"} ${id} ${data.nodeId}`);
          break;

        case "changeSelection": {
          if (target instanceof qx.ui.virtual.selection.Row) {
            lines.push(`set-row-selection ${id} [${data}]`);
            break;
          }
          if (target instanceof qx.ui.table.selection.Model) {
            lines.push(`reset-table-selection ${id}`);
            let ranges = target.getSelectedRanges();
            if (ranges.length) {
              lines.push(`set-table-selection ${id} ${ranges[0].minIndex}, ${ranges[0].maxIndex}`);
            }
            break;
          }
          if (data && data.length && qx.lang.Type.isArray(data)) {
            let selected = data[0];
            if (selected instanceof qx.core.Object && selected.getQxObjectId()) {
              let selectedId = qx.core.Id.getAbsoluteIdOf(selected);
              lines.push(`set-selection ${id} ${selectedId}`);
            } else if (typeof target.getSelectables == "function") {
              let index = target.getSelectables().indexOf(selected);
              lines.push(`set-from-selectables ${id} ${index}`);
            }
            break;
          }
          return [];
        }
        default:
          return [];
      }
      // prepend a wait command to replay delays in user action
      let now = Date.now();
      let msSinceLastEvent = now - (this.__lastEventTimestamp || now);
      this.__lastEventTimestamp = now;
      if (msSinceLastEvent) {
        lines.unshift(`wait ${msSinceLastEvent}`);
      }
      return lines;
    },

    /**
     * Returns the recorded script
     * @return {String}
     */
    getScript() {
      return this.__lines.join("\n");
    }
  }
});
