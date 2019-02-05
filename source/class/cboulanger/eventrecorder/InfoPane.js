/**
 * A singleton instance of a popup to display informational text (and optionally, an icon) to the user.
 * @asset(qx/icon/Tango/32/status/dialog-information.png)
 */
qx.Class.define("cboulanger.eventrecorder.InfoPane", {
  type: "singleton",
  extend: qx.ui.popup.Popup,
  statics:{
    icon:{
      "waiting":  "cboulanger/eventrecorder/ajax-loader.gif",
      "info":     "icon/32/status/dialog-information.png"
    }
  },
  construct: function() {
    this.base(arguments, new qx.ui.layout.Canvas());
    this.set({
      decorator: "window",
      minWidth: 100,
      minHeight: 30,
      padding: 10,
      backgroundColor: "#f0f0f0"
    });
    this.__atom = new qx.ui.basic.Atom();
    this.__atom.getChildControl("label").set({
      rich: true,
      wrap: true
    });
    this.add(this.__atom);
    this.addListenerOnce("appear", this.center, this);
  },
  members: {

    __atom: null,

    /**
     * Center the widget
     */
    center() {
      let bounds = this.getBounds();
      this.set({
        marginTop: Math.round(
          (qx.bom.Document.getHeight() - bounds.height) / 2
        ),
        marginLeft: Math.round(
          (qx.bom.Document.getWidth() - bounds.width) / 2
        )
      });
      return this;
    },

    /**
     * Displays the given text. Can optionally be placed next to a widget
     * @param text {String|false} The text to display. If false, hide the widget
     * @param widgetToPlaceTo {qx.ui.core.Widget|undefined} If given, place the
     * info panel next to this widget
     */
    display(text, widgetToPlaceTo=false) {
      if (!text) {
        this.hide();
      }
      this.__atom.setLabel(text);
      this.show();
      if (widgetToPlaceTo) {
        this.placeToWidget(widgetToPlaceTo, true);
      } else if (this.isVisible()) {
        qx.event.Timer.once(this.center, this, 100);
      } else {
        this.addListenerOnce("appear", this.center, this);
      }
      return this;
    },

    /**
     * When displaying the info, show the icon associated with the given alias
     * @param alias
     */
    useIcon(alias) {
      let iconpath = cboulanger.eventrecorder.InfoPane.icon[alias];
      if (!iconpath) {
        throw new Error(`Icon alias "${alias}" is invalid.`);
      }
      this.__atom.setIcon(iconpath);
      return this;
    },

    animate() {
      if (!this.isVisible()) {
        this.addListenerOnce("appear", this.animate, this);
        return this.show();
      }
      let animation = {duration: 1000, keyFrames : {
          0 :  {scale: 1, rotate: "0deg"},
          10 : {scale: 0.9, rotate: "-3deg"},
          20 : {scale: 0.9, rotate: "-3deg"},
          30 : {scale: 1.1, rotate: "3deg"},
          40 : {scale: 1.1, rotate: "-3deg"},
          50 : {scale: 1.1, rotate: "3deg"},
          60 : {scale: 1.1, rotate: "-3deg"},
          70 : {scale: 1.1, rotate: "3deg"},
          80 : {scale: 1.1, rotate: "-3deg"},
          90 : {scale: 1.1, rotate: "3deg"},
          100 : {scale: 1, rotate: "0deg"}
        }};
      qx.bom.element.Animation.animate(this.getContentElement().getDomElement(), animation);
      return this;
    },

    show() {
      this.base(arguments);
      return this;
    }
  },

  /**
    * Destructor
    */
  destruct: function() {
    this._disposeObjects("__atom");
  }
});
