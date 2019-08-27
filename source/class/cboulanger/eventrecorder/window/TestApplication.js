/* ************************************************************************

   Copyright: 2018 Christian Boulanger

   License: MIT license

   Authors: Christian Boulanger (cboulanger) info@bibliograph.org

************************************************************************ */

/**
 * This is the main application class of "UI Event Recorder"
 */
qx.Class.define("cboulanger.eventrecorder.window.TestApplication", {
  extend: qx.application.Standalone,
  include: cboulanger.eventrecorder.window.MRemoteBinding,
  properties: {
    chatMessage : {
      check: "String",
      init: "",
      event: "changeChatMessage"
    }
  },
  members:
  {
    main : function() {
      this.base(arguments);
      if (qx.core.Environment.get("qx.debug")) {
        qx.log.appender.Native;
      }
      var container = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      var button = new qx.ui.form.Button("1. Open a new window");
      container.add(button);
      container.add(new qx.ui.basic.Label("2. Type a message:"));
      var chatbox = new qx.ui.form.TextField();
      chatbox.setLiveUpdate(true);
      this.bind("chatMessage", chatbox, "value");
      chatbox.bind("value", this, "chatMessage");
      container.add(chatbox);
      this.getRoot().add(container, {left:50, top: 50});
      // communicate with a new browser window
      button.addListener("execute", function() {
        var remoteWin = new cboulanger.eventrecorder.window.RemoteApplication("remote_binding_test", {
          width: 300,
          height: 300
        });
        this.syncProperties(remoteWin);
      }, this);

      // communicate with a window that opened this application
      if (window.opener) {
        this.syncProperties(window.opener);
      }
    }
  }
});
