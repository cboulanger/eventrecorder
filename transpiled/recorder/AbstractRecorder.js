(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.bom.Element": {
        "require": true
      },
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qx.event.Manager": {
        "construct": true
      },
      "qx.core.Id": {
        "construct": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);qx.Class.define("recorder.AbstractRecorder", {

    extend: qx.core.Object,
    //include : [ Mixin1, Mixin2 ],

    /**
     * Constructor
     */
    construct: function construct() {
      var _this = this;

      qx.core.Object.constructor.call(this);
      qx.event.Manager.setGlobalEventMonitor(function (target, event) {
        if (!_this.__running) return;
        var id = void 0;
        if (typeof target.getAttribute == "function") {
          id = target.getAttribute("data-qx-object-id");
        } else if (target instanceof qx.core.Object) {
          id = qx.core.Id.getAbsoluteIdOf(target, true);
        } else {
          return;
        }
        if (id) {
          _this._recordEvent(id, event, target);
        }
      });
    },

    /**
     * The methods and simple properties of this class
     */
    members: {
      __running: false,
      __lines: null,
      __paused: false,

      start: function start() {
        this.__lines = [];
        this.__running = true;
        this.__paused = false;
      },
      pause: function pause() {
        this.__running = false;
        this.__paused = true;
      },
      isPaused: function isPaused() {
        return this.__paused;
      },
      resume: function resume() {
        this.__running = true;
        this.__paused = false;
      },
      stop: function stop() {
        this.__running = false;
        this.__paused = false;
      },
      _recordEvent: function _recordEvent(id, event, target) {
        this.__lines = this.__lines.concat(this.recordEvent(id, event, target));
      },
      getLines: function getLines() {
        return this.__lines;
      },


      /**
       * Given an id, the event and (optionally) the even target, return one or more
       * pieces of code that can replay the user action that lead to this event.
       * Return an array, each element is one line of code
       * @param {String} id The id of the DOM node
       * @param {qx.event.Event} event The event that was fired
       * @param {qx.bom.Element} target The event target
       * @return {String[]} An array of script lines
       */
      recordEvent: function recordEvent(id, event, target) {
        this.error("recordEvent() must be implemented by subclass.");
      },


      /**
       * Given an array of script lines, return a piece of code that can be
       * pasted into a test suite.
       * @param {String[]} lines Array of script lines
       * @return {String}
       */
      generateScript: function generateScript(lines) {
        this.error("generateScript() must be implemented by subclass.");
      }
    }
  });
  recorder.AbstractRecorder.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=AbstractRecorder.js.map?dt=1544616856052