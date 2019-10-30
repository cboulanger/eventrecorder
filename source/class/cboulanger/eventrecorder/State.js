/**
 * An object holding the application-wide state of the eventrecorder
 */
qx.Class.define("cboulanger.eventrecorder.State", {
  extend: qx.io.persistence.Object,
  properties: {

    /**
     * The name of the connected application
     */
    applicationName: {
      check: "String",
      event: "changeApplicationName",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * The recorded script
     */
    script: {
      check: "String",
      nullable: true,
      event: "changeScript",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * Whether the player is/should be playing
     * Null value means disabled
     */
    play: {
      check: "Boolean",
      nullable: true,
      init: null,
      event: "changePlay",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * Whether the player is/should be playing
     * Null value means disabled
     */
    record: {
      check: "Boolean",
      nullable: true,
      init: null,
      event: "changeRecord",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * A model of macro names and descriptions
     */
    macros: {
      check: "qx.data.Array",
      nullable: true,
      event: "changeMacros",
      transform: "_transformArray",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * If not null, the name of the macro to play as a script
     */
    macroToPlay: {
      check: "String",
      nullable: true,
      event: "changeMacroToPlay",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * Whether the recorder should log additional information on the
     * recorded events. Null means disabled
     */
    logEvents: {
      check: "Boolean",
      nullable: true,
      init: null,
      event: "changeRecord",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * Whether the stored script should start playing after the
     * application loads. null means disabled
     */
    autoplay: {
      check: "Boolean",
      nullable: true,
      event: "changeAutoplay",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * Whether the application is reloaded before the script is replayed
     * null means disabled
     */
    reloadBeforeReplay: {
      check: "Boolean",
      nullable: true,
      event: "changeReloadBeforeReplay",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * Whether the event recorder is scriptable
     * (only useful for demos of the eventrecorder itself)
     */
    scriptable: {
      check: "Boolean",
      nullable: true,
      init: true,
      event: "changeScriptable",
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    playerType: {
      check: "String",
      event: "changePlayerType",
      nullable: true,
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    playerMode: {
      check: ["presentation", "test"],
      event: "changePlayerMode",
      nullable: true,
      "@": qx.io.persistence.anno.Property.DEFAULT
    },

    /**
     * The object ids defined in the recorded application
     */
    objectIds: {
      check: "qx.data.Array",
      event: "changeObjectIds",
      transform: "_transformArray",
      "@": qx.io.persistence.anno.Property.DEFAULT
    }
  },
  members: {
    _transformArray(value, oldValue) {
      if (!oldValue) {
        oldValue = new qx.data.Array();
      }
      if (value) {
        oldValue.replace(value);
      } else {
        oldValue.removeAll();
      }
      return oldValue;
    }
  }
});
