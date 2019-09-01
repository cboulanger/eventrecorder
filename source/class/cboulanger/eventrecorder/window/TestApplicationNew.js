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
  include: qx.data.MRemoteBinding,
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
    __openAppBtn: null,
    __listWidget: null,

    main : function() {
      this.base(arguments);
      if (qx.core.Environment.get("qx.debug")) {
        qx.log.appender.Native;
      }

      // Non-UI test class
      qx.Class.define("test.Proxy", {
        extend: qx.core.Object,
        include: qx.data.MRemoteBinding,
        properties: {
          foo: {check: "String", event:"changeFoo"},
          bar: {check: "Object", event:"changeBar"}
        }
      });

      var FOO_EXPECTED_VALUE = "Hello World!";
      var BAR_EXPECTED_VALUE = {one:{deeply:{nested:{object:{"this":{is:true}}}}}};

      // create UI widgets, including button to open new apps and the list widget
      this.__createUi();

      // when the button is clicked, open remote application in new window
      var window_counter = 1;
      this.__openAppBtn.addListener("execute", function() {
        var window_name = "Remote Application " + window_counter++;
        var remoteApplication = new qx.ui.window.RemoteApplication("remote_binding_test", {
          width: 300,
          height: 500
        }, window_name);

        // synchronize properties of this app with the app in the new window via postMessage transport
        var transport = new qx.io.channel.transport.PostMessage(remoteApplication.getWindow(), window_name);
        var channel1A = new qx.io.channel.Channel(transport, "channel1");
        this.syncProperties(channel1A);

        // test non-ui databinding
        var proxyA = new test.Proxy();
        var channel2A = new qx.io.channel.Channel(transport, "channel2");
        proxyA._syncProperties(channel2A);

        // test if properties were correctly synchronized after a timeout
        qx.event.Timer.once(function () {
          qx.core.Assert.assertEquals(FOO_EXPECTED_VALUE, proxyA.getFoo());
          qx.core.Assert.assertJsonEquals(BAR_EXPECTED_VALUE, qx.util.Serializer.toNativeObject(proxyA.getBar()));
          // make a change inside the object
          proxyA.getBar().getOne().getDeeply().getNested().getObject().getThis().setIs(false);
        }, this, 2000);
      }, this);

      // if we're the app running in a newly opened window, sync properties with the window that opened us
      if (window.opener) {
        var transport = new qx.io.channel.transport.PostMessage(window.opener, "Main application");
        var channel1B = new qx.io.channel.Channel(transport, "channel1");
        this._syncProperties(channel1B);

        // setup the remote object
        var proxyB = new test.Proxy();
        var channel2A = new qx.io.channel.Channel(transport, "channel2");
        proxyB._syncProperties(channel2A);

        // trigger property sync
        proxyB.setFoo(FOO_EXPECTED_VALUE);
        proxyB.setBar(qx.data.marshal.Json.createModel(BAR_EXPECTED_VALUE));

        // test for the expected change inside the object
        qx.event.Timer.once(function () {
          qx.core.Assert.assertEquals(false, proxyB.getOne().getDeeply().getNested().getObject().getThis().getIs());
        }, this, 2000);
        console.info("Non-UI tests passed");
        return;
      }

      // we are the main window (= first application), create the data for the list
      // which will be propagated to all other windows that are opened
      var data = this.__createListData();
      var model = qx.data.marshal.Json.createModel(data, true);
      this.__listWidget.setModel(model);
    },

    __createUi: function() {
      var container = new qx.ui.container.Composite(new qx.ui.layout.VBox(5));
      container.add((new qx.ui.basic.Label("<h3>Remote databinding demo</h3>")).set({rich:true}));
      var button1 = new qx.ui.form.Button("1. Open a new window");
      this.__openAppBtn = button1;
      container.add(button1);
      container.add(new qx.ui.basic.Label("2. Type a message:"));
      var chatbox = new qx.ui.form.TextField();
      chatbox.setLiveUpdate(true);
      this.bind("chatMessage", chatbox, "value");
      chatbox.bind("value", this, "chatMessage");
      container.add(chatbox);
      container.add(new qx.ui.basic.Label("3. Tick & Click:"));
      var list = this.__createList();
      // setup databinding
      this.bind("listModel", list, "model");
      list.bind("model", this, "listModel");
      this.__listWidget = list;
      container.add(list);
      var button2 = new qx.ui.form.Button("Add item at the top");
      var list_counter = 1;
      button2.addListener("execute", function() {
        list.getModel().unshift(qx.data.marshal.Json.createModel({
          name: "New item " + list_counter++,
          online: true
        }));
      });
      container.add(button2);
      var button3 = new qx.ui.form.Button("Delete first three items");
      button3.addListener("execute", function() {
        list.getModel().splice(0, 3);
      });
      container.add(button3);
      this.getRoot().add(container, {left:50, top: 0});
    },

    __createList: function() {
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
    },

    __createListData: function () {
      var data = [];
      for (var i = 0; i < 20; i++) {
        var entry = {
          name: "Item " + i,
          online: i % 3 === 0
        };
        data.push(entry);
      }
      return data;
    }
  }
});
