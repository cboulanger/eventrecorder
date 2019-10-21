(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.io.PartLoader": {
        "defer": "runtime"
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2019 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  
  ************************************************************************ */

  /**
   * This class can be put into the "include" section of compile.json/applications[]
   * to load the eventrecorder into an existing application. If you use parts, you must
   * include it into the part of the main application and exclude it from the part containing
   * the eventrecorder code.
   */
  qx.Class.define("cboulanger.eventrecorder.Loader", {
    defer: function defer() {
      var loader = qx.io.PartLoader.getInstance();

      if (loader.hasPart("eventrecorder")) {
        loader.require(["eventrecorder"]);
      }
    }
  });
  cboulanger.eventrecorder.Loader.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=Loader.js.map?dt=1571643379510