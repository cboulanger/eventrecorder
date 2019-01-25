/* ************************************************************************

  UI Event Recorder

  Copyright:
    2018 Christian Boulanger

  License:
    MIT license
    See the LICENSE file in the project's top-level directory for details.

  Authors: Christian Boulanger


************************************************************************ */

qx.Mixin.define("cboulanger.eventrecorder.MHelperMethods", {
  members :
  {
    /**
     * Add a function to the global event monitor
     * @param fn {Function}
     */
    addGlobalEventListener: function(fn) {
      let evtMonitor = qx.event.Manager.getGlobalEventMonitor();
      qx.event.Manager.setGlobalEventMonitor(
        evtMonitor ? (target, event) => evtMonitor(target, event) || fn(target, event) : fn
      );
    },

    /**
     * Returns the absolute id of the owned object with that id
     * @param domNode {Element}
     * @param id {String}
     * @returns {String}
     */
    absoluteIdOf : function(domNode, id) {
      return qx.core.Id.getAbsoluteIdOf(qx.ui.core.Widget.getWidgetByElement(domNode).getQxObject(id));
    }
  }
});
