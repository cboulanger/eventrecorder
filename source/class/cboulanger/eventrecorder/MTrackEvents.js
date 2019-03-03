/**
 * This is a marker mixin that can be included into objects to signal that
 * the event recorder should record events of this object. Registers empty
 * listeners for the change events so that they are actually fired.
 */
qx.Mixin.define("cboulanger.eventrecorder.MTrackEvents", {
  properties: {
    /**
     * Turn tracking of events on (default) or off
     */
    trackEvents: {
      check: "Boolean",
      nullable: false,
      init: true
    },

    /**
     * Configure which property change events are tracked. Set
     * to null for no properties, empty array for all properties.
     */
    trackPropertyChanges: {
      check: "Array",
      nullable: true,
      init: null,
      apply: "_applyTrackPropertyChanges"
    }
  },

  members: {
    _applyTrackPropertyChanges(properties) {
      if (properties === null) {
        return;
      }
      if (properties.length === 0 ) {
        properties = qx.Class.getProperties(this.constructor);
      }
      for (let name of properties) {
        let config = qx.Class.getPropertyDefinition(this.constructor, name);
        if (config.event) {
          this.addListener(config.event,()=>{});
        }
      }
    }
  }
});
