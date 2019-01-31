/**
 * A mixin that provides a "Loading..." popup
 */
qx.Mixin.define("cboulanger.eventrecorder.MLoadingPopup", {
  members: {
    __popup: null,
    __popupAtom: null,
    __target: null,

    /**
     * Creates the popup
     * @param options {Map}
     * @return {qx.ui.popup.Popup}
     */
    createPopup: function(options) {
      if (options === undefined) {
        options = {};
      } else if (!qx.lang.Type.isObject(options)) {
        throw new Error("Invalid argument.");
      }
      if (this.__popup instanceof qx.ui.popup.Popup) {
        this.warn("Popup already created.");
      } else {
        this.__popup = new qx.ui.popup.Popup(new qx.ui.layout.Canvas()).set({
          decorator: "main",
          minWidth: 100,
          minHeight: 30,
          padding: 10
        });
        this.__popupAtom = new qx.ui.basic.Atom().set({
          label: options.label !== undefined ? options.label : "Loading ...",
          icon: options.icon !== undefined ? options.icon : "cboulanger/eventrecorder/ajax-loader.gif",
          rich: options.rich !== undefined ? options.rich : true,
          iconPosition:
            options.iconPosition !== undefined ? options.iconPosition : "left",
          show: options.show !== undefined ? options.show : "both",
          height: options.height || null,
          width: options.width || null
        });
        this.__popup.add(this.__popupAtom);
        this.__popup.addListener("appear", this._centerPopup, this);
      }
      return this.__popup;
    },

    /**
      * Centers the popup
      */
    _centerPopup: function() {
      var bounds = this.__popup.getBounds();
      if (this.__target && "left" in this.__target.getLayoutProperties()) {
        var l = this.__target.getLayoutProperties();
        this.__popup.placeToPoint({
          left: Math.round(l.left + l.width / 2 - bounds.width / 2),
          top: Math.round(l.top + l.height / 2 - bounds.height / 2)
        });
      } else {
        this.__popup.set({
          marginTop: Math.round(
            (qx.bom.Document.getHeight() - bounds.height) / 2
          ),
          marginLeft: Math.round(
            (qx.bom.Document.getWidth() - bounds.width) / 2
          )
        });
      }
    },

    /**
      * Shows the popup centered over the widget
      * @param label {String}
      * @param target {qx.ui.core.Widget} Optional target widet. If not given,
      * use the including widget.
      */
    showPopup: function(label, target) {
      if (label) {
        this.__popupAtom.setLabel(label);
      }
      this.__target = target;
      this.__popup.show();
    },

    /**
      * Hides the widget
      */
    hidePopup: function() {
      this.__popup.hide();
    }
  },

  /**
    * Destructor
    */
  destruct: function() {
    this._disposeObjects("__popup", "this.__popupAtom");
  }
});
