qx.Mixin.define("cboulanger.eventrecorder.MState", {
  properties: {
    state: {
      check: "cboulanger.eventrecorder.State",
      event: "changeState",
      nullable: true
    }
  }
});
