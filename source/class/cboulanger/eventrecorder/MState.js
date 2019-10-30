/**
 * This mixin adds a "state" property, which holds the application state
 * @require(cboulanger.eventrecorder.State)
 */
qx.Mixin.define("cboulanger.eventrecorder.MState", {
  properties: {
    state: {
      check: "cboulanger.eventrecorder.State",
      event: "changeState",
      nullable: true
    }
  }
});
