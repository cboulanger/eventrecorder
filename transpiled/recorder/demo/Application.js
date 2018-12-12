(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.application.Standalone": {
        "require": true
      },
      "qx.log.appender.Native": {},
      "qx.ui.form.Button": {},
      "qx.ui.window.Window": {},
      "qx.ui.layout.VBox": {},
      "qx.core.Id": {},
      "recorder.UiController": {},
      "recorder.type.Qooxdoo": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);qx.Class.define("recorder.demo.Application", {
    extend: qx.application.Standalone,

    /*
    *****************************************************************************
       MEMBERS
    *****************************************************************************
    */

    members: {
      /**
       * This method contains the initial application code and gets called
       * during startup of the application
       *
       * @lint ignoreDeprecated(alert)
       */
      main: function main() {
        // Call super class
        recorder.demo.Application.prototype.main.base.call(this);

        // Enable logging in debug variant
        {
          // support native logging capabilities, e.g. Firebug for Firefox
          qx.log.appender.Native;
        }

        /*
        -------------------------------------------------------------------------
          Below is your actual application code...
        -------------------------------------------------------------------------
        */

        // button
        var button1 = new qx.ui.form.Button("Click me to open window", "recorder/test.png");
        var doc = this.getRoot();
        doc.add(button1, { left: 100, top: 50 });

        // window
        var win = new qx.ui.window.Window("New window");
        win.set({
          width: 300,
          height: 50,
          layout: new qx.ui.layout.VBox(),
          showMinimize: false,
          showMaximize: false
        });
        var button2 = new qx.ui.form.Button("Click me to close window", "recorder/test.png");
        button2.addListener("execute", function () {
          return win.close();
        });
        win.add(button2);
        doc.add(win);

        // event listeners
        win.addListener("appear", function () {
          win.center();
        });
        button1.addListener("execute", function () {
          win.show();
        });

        // id registration
        qx.core.Id.getInstance().register(button1, "button1");
        button1.setObjectId("button1");
        button1.addOwnedObject(win, "window");
        win.addOwnedObject(button2, "button2");

        // recorder
        var controller = new recorder.UiController(new recorder.type.Qooxdoo());
        controller.set({ width: 400, height: 300 });
        doc.add(controller, { top: 0, right: 0 });
        controller.show();
      }
    }
  });
  recorder.demo.Application.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=Application.js.map?dt=1544616852481