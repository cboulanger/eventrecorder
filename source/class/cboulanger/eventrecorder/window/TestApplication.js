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
    },
    listModel: {
      check: "qx.data.Array",
      nullable: true,
      event: "changeListModel"
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
      container.add(new qx.ui.basic.Label("TODO: changeBubble/change events"));
      var list = this.__createList();
      this.bind("listModel", list, "model");
      list.bind("model", this, "listModel");
      container.add(list);
      this.getRoot().add(container, {left:50, top: 50});
      // communicate with a new browser window
      button.addListener("execute", function() {
        var remoteWin = new cboulanger.eventrecorder.window.RemoteApplication("remote_binding_test", {
          width: 300,
          height: 500
        });
        this.syncProperties(remoteWin);
      }, this);


      if (window.opener) {
        // if we're in a new window, sync properties with the window that opened this
        this.syncProperties(window.opener);
      } else {
        // we are the main window, create the data for the list to be sync'ed
        var rawData = [];
        for (var i = 0; i < 20; i++) {
          var entry = {
            name: "Item " + i,
            online: i % 3 === 0
          };
          rawData.push(entry);
        }
        var data = qx.data.marshal.Json.createModel(rawData, true);
        list.setModel(data);
      }
    },

    __createList: function(){
      // create the widgets
      var list = new qx.ui.list.List();
      list.setWidth(150);

      // create the delegate to change the bindings
      var delegate = {
        configureItem : function(item) {
          item.setPadding(3);
        },
        createItem : function() {
          return new qx.ui.form.CheckBox();
        },
        bindItem : function(controller, item, id) {
          controller.bindProperty("name", "label", null, item, id);
          controller.bindProperty("online", "value", null, item, id);
          controller.bindPropertyReverse("online", "value", null, item, id);
        }
      };
      list.setDelegate(delegate);
      return list;
    }
  }
});
