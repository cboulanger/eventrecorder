/* ************************************************************************

   Copyright: 2018 Christian Boulanger

   License: MIT license

   Authors: Christian Boulanger (cboulanger) info@bibliograph.org

************************************************************************ */

/**
 * This is the main application class of "UI Event Recorder"
 * @asset(recorder/*)
 */
qx.Class.define("recorder.demo.Application",
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
      var button1 = new qx.ui.form.Button("Click me to open window", "recorder/test.png");
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
      let button2 = new qx.ui.form.Button("Click me to close window", "recorder/test.png");
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
      button1.setObjectId("button1");
      button1.addOwnedObject(win,"window");
      win.addOwnedObject(button2,"button2");

      // recorder
      let controller = new recorder.UiController(new recorder.type.Qooxdoo());
      doc.add(controller, {top:0, right:0});
      controller.show();
    }
  }
});