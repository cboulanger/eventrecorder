/**
 * When added to the `applications[x].include` section of `compile.json`,
 * this class will automatically create a small popup with the id of the widget
 * when hovering over it.
 */
qx.Class.define("contrib.cboulanger.eventrecorder.ObjectIdTooltip",
{
  type: "singleton",
  extend: qx.core.Object,
  include : [contrib.cboulanger.eventrecorder.MHelperMethods],
  members: {

    /**
     * Start automatically displaying the popups
     */
    init: function(){
      const tooltip = new qx.ui.tooltip.ToolTip();
      this.addGlobalEventListener((target, event) => {
        let type=event.getType();
        switch (type) {
          case "pointerover":
            let id = target.getAttribute("data-qx-object-id");
            if (id) {
              tooltip.setLabel(id);
              tooltip.placeToElement(target);
              tooltip.show();
            }
            break;
          case "pointerout":
            tooltip.hide();
            break;
        }
      });
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function(){
    qx.bom.Lifecycle.onReady(() => contrib.cboulanger.eventrecorder.ObjectIdTooltip.getInstance().init());
  }
});