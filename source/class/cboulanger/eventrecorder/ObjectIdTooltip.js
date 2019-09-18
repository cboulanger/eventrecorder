/**
 * When added to the `applications[x].include` section of `compile.json`,
 * this class will automatically create a small popup with the id of the widget
 * when hovering over it.
 */
qx.Class.define("cboulanger.eventrecorder.ObjectIdTooltip", {
  type: "singleton",
  extend: qx.core.Object,
  include : [cboulanger.eventrecorder.MHelperMethods],

  properties: {
    includeNodesWithoutQxId: {
      check: "Boolean",
      nullable: false,
      init: false
    }
  },

  members: {

    /**
     * The last widget for which a tooltip was displayed
     */
    __lastTarget: null,

    /**
     * Start automatically displaying the tooltips
     * @ignore(HTMLElement)
     */
    init: function() {
      const tooltip = new qx.ui.tooltip.ToolTip();
      this.addGlobalEventListener((target, event) => {
        if (target === tooltip.getContentElement().getDomElement()) {
         return;
        }
        const type = event.getType();
        let id;
        if (typeof target.getAttribute == "function") {
          id = target.getAttribute("data-qx-object-id") || target.toString() + " (no qx id attribute)";
        } else if (target instanceof qx.core.Object) {
          id = qx.core.Id.getAbsoluteIdOf(target, true) || (target.toString()+" (no qx id)");
        } else {
          id = target.toString();
        }
        if (!this.isIncludeNodesWithoutQxId() && id.includes("no qx id")) {
          return;
        }

        // data
        let data = (typeof event.getData == "function") ? event.getData() : null;
        // selections are arrays
        if (data instanceof qx.data.Array) {
          data = data.getItem(0);
        } else if (data instanceof Array && data.length) {
          data = data[0];
        }
        switch (true) {
          case data instanceof HTMLElement:
            data = target.getAttribute("data-qx-object-id") || target.toString() + " (no qx id attribute)";
            break;
          case data instanceof qx.core.Object:
            data = qx.core.Id.getAbsoluteIdOf(data, true) || data.toString() + " (no qx id)";
            break;
          case qx.lang.Type.isObject(data):
            data = JSON.stringify(data);
            if (data.length > 100) {
              data = data.substr(0, 100) + " [...]";
            }
            break;
          case qx.lang.Type.isString(data):
            data = `'${data}'`;
            break;
        }
        let msg = data !== null ?
          `==> ID ${id}: event '${type}' was fired with data ${data}` :
          `==> ID ${id}: event ${type} was fired.`;
        switch (type) {
          case "pointerover": {
            if (id) {
              tooltip.setLabel(id);
              tooltip.placeToElement(target);
              tooltip.show();
              this.__lastTarget = target;
            }
            break;
          }
          case "pointerout":
            tooltip.hide();
            break;
          default:
            if (id.startsWith("eventrecorder")) {
              return;
            }
            // log all events that relate to the widget for which a toolip was just displayed
            if (target === this.__lastTarget) {
              switch (true) {
                // don't ignore virtual cell events
                case type.startsWith("cell"):
                  break;
                // ignore the following event types
                case type.startsWith("mouse"):
                case type.startsWith("pointer"):
                case type.startsWith("touch"):
                case type.includes("track"):
                case type.includes("activate"):
                case type.includes("capture"):
                case type.includes("focus"):
                case type.includes("key"):
                case type.includes("click"):
                case type.includes("tap"):
                case type === "press":
                case type === "blur":
                case type === "roll":
                case type === "loaded":
                case type === "swipe":
                case type === "release":
                case type === "resize":
                case type === "changeVisibility":
                case type === "input":
                  return;
              }
              console.info(msg);
            } else {
              switch (true) {
                case type !== "change" && type.startsWith("change") && !type.includes("Visibility"):
                case type === "execute":
                case type.startsWith("tree"):
                  console.info(msg);
              }
            }
        }
      });
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function() {
    if (qx.core.Environment.get("module.objectid")) {
      qx.bom.Lifecycle.onReady(() => cboulanger.eventrecorder.ObjectIdTooltip.getInstance().init());
    }
  }
});
