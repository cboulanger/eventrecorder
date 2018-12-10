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
      var button1 = new qx.ui.form.Button("Click me", "recorder/test.png");
      var doc = this.getRoot();
      doc.add(button1, {left: 100, top: 50});

      // window
      let win = new qx.ui.window.Window("New window");
      win.set({
        width: 200,
        height: 50,
        showMinimize: false,
        showMaximize: false,
      });
      doc.add(win);

      // event listeners
      win.addListener("appear", ()=>{
        win.center();
      });
      button1.addListener("execute", ()=>{
        win.show();
      });

      // id registration
      qx.core.Id.getInstance().register(button1,"button");
      button1.setObjectId("button");
      button1.addOwnedObject(win,"window");

      let controller = new recorder.UiController(new recorder.type.TestCafe());

      doc.add(controller, {right:0});
      controller.show();
    }
  }
});