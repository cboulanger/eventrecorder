/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2018 The authors

   License:
     MIT: https://opensource.org/licenses/MIT
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Christian Boulanger (cboulanger)

************************************************************************ */

/**
 * A mixin providing methods for binding properties between applications
 * running in separate browser windows
 */
qx.Mixin.define("cboulanger.eventrecorder.window.MRemoteBinding", {

  statics: {
    SERIALIZER_CLASS_PROP: "$$class",
    SERIALIZER_DATA_PROP: "$$data"
  },

  construct: function() {
    this.__remoteWindows = [];
    if (!window.opener && !window.name) {
      window.name = "Main application";
    }
  },

  members: {

    __changeSource: null,
    __remoteWindows: null,
    __isInitialized: false,

    /**
     * Initializes property synchronization with the remote window
     * @param win {Window|cboulanger.eventrecorder.window.RemoteApplication}
     */
    syncProperties: function(win) {
      var remoteWindow;
      if (win instanceof cboulanger.eventrecorder.window.RemoteApplication) {
        remoteWindow = win._getWindow();
      } else if (win.window === win) {
        remoteWindow = win;
        if (win === window.opener) {
          // send ready message to opener
          this.__sendReadyEvent(win);
        }
      } else {
        throw new Error("Argument must be a Window or RemoteApplication object, is " + win);
      }

      if (!this.__isInitialized) {
        this.__initialize();
      }
      // keep a reference to the window
      this.__remoteWindows.push(remoteWindow);
    },

    /**
     * Create a pseudo-UUID to avoid name clashes
     * @return {string}
     */
    createUuid: function() {
      var dt = new Date().getTime();
      var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c === 'x' ? r :(r&0x3|0x8)).toString(16);
      });
      return uuid;
    },

    /**
     * Returns an array with all the property names to synchronize. Override
     * to refine behavior.
     * @return {Array}
     */
    _getPropertyNamesToSync: function() {
      return qx.Class.getProperties(qx.Class.getByName(this.classname))
        .filter(function(prop) {
          return !prop.startsWith("qx");
        });
    },

    __initialize: function() {
      var properties =  this._getPropertyNamesToSync();
      this.info("Initializing remote binding with properties " + properties);
      properties.forEach(function(prop) {
        // watch for property changes
        var eventName = "change" + qx.lang.String.firstUp(prop);
        this.addListener(eventName, this.__broadcastChangeEvent, this);
      }, this);
      var that = this;
      window.addEventListener("message", function(message){
        that.__handleIncomingMessage(message);
      });
      this.__isInitialized = true;
    },



    /**
     * Handles the change events of the class properties
     * @param e {qx.event.type.Data}
     * @private
     */
    __broadcastChangeEvent: function(e) {
      var type = e.getType();
      var data = this.__serialize(e.getData());
      var oldData = this.__serialize(e.getOldData());
      var message = {
        event: {
          type: type,
          data: data,
          oldData: oldData
        }
      };
      this.__remoteWindows.forEach(function(win) {
        if (win === this.__changeSource) {
          // do not retransmit value change to origin of change
          return;
        }
        this.__sendMessage(message, win);
      }, this);
    },

    /**
     * Send a message to the peer using the postMessage API
     * @param message {String}
     * @param win {Window}
     * @private
     */
    __sendMessage: function(message, win) {
      if (qx.bom.Window.isClosed(win)) {
        // don't send messages to closed windows
        return;
      }
      win.postMessage(message, "*");
      console.debug(">>> Message sent to " + win.name) + ":";
      console.debug(message);
    },

    /**
     * If the incoming message is a property change event sent by the peer,
     * apply the new value
     * @param message {Object}
     * @private
     */
    __handleIncomingMessage: function(message) {
      if (this.__remoteWindows.indexOf(message.source) < 0) {
        this.warn("Ignoring message from unknown source...");
        return;
      }
      var msgData = message.data;
      console.debug(">>> Message received from " + message.source.name + ":");
      console.debug(msgData);
      if (!qx.lang.Type.isObject(msgData) || !msgData.event || !msgData.event.type) {
        this.warn("Invalid message");
        return;
      }
      if (msgData.event.type === "ready") {
        this.__handleReadyEvent(message.source);
      } else if (msgData.event.type.startsWith("change")) {
        this.__handleChangeEvent(message);
      }
    },

    /**
     * Send the ready event to another window, usually the opener
     * @param win {Window}
     * @private
     */
    __sendReadyEvent: function(win) {
      var eventData = {
        event: {
          type: "ready"
        }
      };
      this.__sendMessage(eventData, win);
    },

    /**
     * When receiving the "ready" event from a window, send property state
     * @param win {Window}
     */
    __handleReadyEvent: function(win) {
      this._getPropertyNamesToSync().forEach(function(prop){
        var type = "change" + qx.lang.String.firstUp(prop);
        var value = this.get(prop);
        var data = this.__serialize(value);
        console.debug({classname: value.classname, data });
        var eventData = {
          event: {
            type: type,
            data: data
          }
        };
        this.__sendMessage(eventData, win);
      }, this);
    },

    /**
     * Handle the change event for normal property values
     * @param message {Object}
     * @private
     */
    __handleChangeEvent: function(message) {
      var msgData = message.data;
      var prop = qx.lang.String.firstLow(msgData.event.type.slice(6));
      if (msgData.event.oldData !== undefined
        && !qx.lang.Type.isObject(msgData.event.oldData)
        && msgData.event.oldData !== this.get(prop)) {
        this.warn("Property '" + prop + "' was out of sync - remote old value does not match.");
      }
      var data = msgData.event.data;
      var value = this.__unserialize(data);
      console.warn("Setting " + prop + " to");
      console.debug(value);
      this.__changeSource = message.source;
      this.set(prop, value);
      this.__changeSource = null;
    },

    /**
     *  Serialize an arbitrary value, including many qooxdoo objects.
     *  to a JSON value that can be sent to a remote target
     * @param object {qx.core.Object|*}
     * @return {*|Array|String|Object}
     * @private
     */
    __serialize: function serialize(object) {
      if (!(object instanceof qx.core.Object)) {
        return qx.util.Serializer.toNativeObject(object);
      }
      var class_prop = this.self(arguments).SERIALIZER_CLASS_PROP;
      var data_prop = this.self(arguments).SERIALIZER_DATA_PROP;
      var classname;
      if (object.classname.startsWith("qx.data.model.")) {
        classname = object.classname.slice(0, 13);
      } else {
        classname = object.classname;
      }
      var result = {};
      result[class_prop] = classname;
      if (qx.Class.hasInterface(object.constructor, qx.data.IListData)) {
        console.debug("qx.data.IListData");
        var data = [];
        for (var i = 0; i < object.getLength(); i++) {
          data.push(serialize(object.getItem(i)));
        }
        result[data_prop] = data;
        return result;
      }
      var properties = qx.util.PropertyUtil.getAllProperties(object.constructor);
      for (var name in properties) {
        // ignore property groups
        if (properties[name].group !== undefined) {
          continue;
        }
        var value = object["get" + qx.lang.String.firstUp(name)]();
        result[name] = serialize(value);
      }
      return result;
    },

    /**
     * Unserialize a JSON object, creating suitable qooxdoo objects from the
     * metadata in the JSON
     * @param object {Object|Array|*}
     * @param includeBubbleEvents {Boolean}
     * @return {qx.core.Object|*}
     */
    __unserialize: function unserialize(object, includeBubbleEvents=true) {
      console.debug("unserializing:");
      console.debug(object);
      var class_prop = this.self(arguments).SERIALIZER_CLASS_PROP;
      var data_prop = this.self(arguments).SERIALIZER_DATA_PROP;
      var result;
      if (qx.lang.Type.isArray(object)){
        return object.map(unserialize);
      }
      if (!qx.lang.Type.isObject(object)) {
        return object;
      }
      var classname = object[class_prop];
      if (classname) {
        switch (classname) {
          case "qx.data.model":
            console.debug("-> data object!");
            delete object[class_prop];
            return qx.data.marshal.Json.createModel(object, includeBubbleEvents);
          default:
            var Clazz = qx.Class.getByName(classname);
            result = new Clazz();
            if (qx.Class.hasInterface(result.constructor, qx.data.IListData)) {
              console.debug("-> IListData ");
              object[data_prop].forEach(function(item, index){
                result.setItem(index, unserialize(item));
              });
            } else {
              console.debug("-> class "+ classname);
              for (var prop in object) {
                if (prop !== class_prop) {
                  result.set(prop, unserialize(object[prop]));
                }
              }
            }
        }
        return result;
      }
      console.debug("-> normal object ");
      for (var prop in object) {
        result.set(prop, unserialize(object[prop]));
      }
      return result;
    }
  }
});

