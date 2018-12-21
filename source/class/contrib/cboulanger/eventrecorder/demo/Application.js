/* ************************************************************************

   Copyright: 2018 Christian Boulanger

   License: MIT license

   Authors: Christian Boulanger (cboulanger) info@bibliograph.org

************************************************************************ */

/**
 * This is the main application class of "UI Event Recorder"
 * @asset(contrib/cboulanger/eventrecorder/*)
 */
qx.Class.define("contrib.cboulanger.eventrecorder.demo.Application",
{
  extend : qx.application.Standalone,

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {
    /**
     * This method contains the initial application code and gets called
     * during startup of the application
     *
     * @lint ignoreDeprecated(alert)
     */
    main : function()
    {
      // Call super class
      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Environment.get("qx.debug"))
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
      var button1 = new qx.ui.form.Button("Click me to open window", "contrib/cboulanger/eventrecorder/test.png");
      var doc = this.getRoot();
      doc.add(button1, {left: 100, top: 50});

      // window
      let win = new qx.ui.window.Window("New window");
      win.set({
        width: 300,
        height: 50,
        layout: new qx.ui.layout.VBox(),
        showMinimize: false,
        showMaximize: false,
      });
      let button2 = new qx.ui.form.Button("Click me to close window", "contrib/cboulanger/eventrecorder/test.png");
      button2.addListener("execute", () => win.close());
      win.add(button2);
      doc.add(win);

      // event listeners
      win.addListener("appear", ()=>{
        win.center();
      });
      button1.addListener("execute", ()=>{
        win.show();
      });

      // id registration
      qx.core.Id.getInstance().register(button1,"button1");
      button1.setQxObjectId("button1");
      button1.addOwnedObject(win,"window");
      win.addOwnedObject(button2,"button2");

      // event recorder
      const qxRecorder = new contrib.cboulanger.eventrecorder.type.Qooxdoo();
      const qxController = new contrib.cboulanger.eventrecorder.UiController(qxRecorder, "Generate qooxdoo script");
      qxController.set({width:400,height:300});
      doc.add(qxController, {top:0, right:0});
      qxController.show();

      const testcafeRecorder = new contrib.cboulanger.eventrecorder.type.TestCafe();
      const testcafeController = new contrib.cboulanger.eventrecorder.UiController(testcafeRecorder, "Generate TestCafe script");
      testcafeController.set({width:400,height:300});
      doc.add(testcafeController, {bottom:0, right:0});
      testcafeController.show();
    }
  }
});
