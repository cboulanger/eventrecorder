(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Mixin": {
        "usage": "dynamic",
        "require": true
      },
      "cboulanger.eventrecorder.window.RemoteApplication": {},
      "qx.Class": {},
      "qx.lang.String": {},
      "qx.core.Object": {},
      "qx.lang.Type": {},
      "qx.core.Assert": {},
      "qx.bom.Window": {},
      "qx.util.Serializer": {},
      "qx.data.IListData": {},
      "qx.util.PropertyUtil": {},
      "qx.data.marshal.Json": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

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
    construct: function construct() {
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
      syncProperties: function syncProperties(win) {
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
        } // keep a reference to the window


        this.__remoteWindows.push(remoteWindow);
      },

      /**
       * Create a pseudo-UUID to avoid name clashes
       * @return {string}
       */
      createUuid: function createUuid() {
        var dt = new Date().getTime();
        var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          var r = (dt + Math.random() * 16) % 16 | 0;
          dt = Math.floor(dt / 16);
          return (c === "x" ? r : r & 0x3 | 0x8).toString(16);
        });
        return uuid;
      },

      /**
       * Returns an array with all the property names to synchronize. Override
       * to refine behavior.
       * @return {Array}
       */
      _getPropertyNamesToSync: function _getPropertyNamesToSync() {
        return qx.Class.getProperties(qx.Class.getByName(this.classname)).filter(function (prop) {
          return !prop.startsWith("qx");
        });
      },
      __initialize: function __initialize() {
        var properties = this._getPropertyNamesToSync();

        this.info("Initializing remote binding with properties " + properties.join(", "));
        properties.forEach(function (prop) {
          var firstUpProp = qx.lang.String.firstUp(prop);
          var eventName = "change" + firstUpProp;

          var attachChangeBubbleListener = function (value) {
            if (value instanceof qx.core.Object && !value.__remoteBindingChangeBubbleListenerId) {
              if (qx.Class.supportsEvent(value.constructor, "changeBubble")) {
                console.debug("Attaching bubble event listener on " + prop);
                var id = value.addListener("changeBubble", function (e) {
                  this.__handleLocalChangeBubbleEvent(e, prop);
                }, this);
                value.__remoteBindingChangeBubbleListenerId = id;
              }
            }
          }.bind(this); // watch for bubble events on existing suitable properties


          attachChangeBubbleListener(this["get" + firstUpProp]()); // watch for property changes

          if (qx.Class.supportsEvent(this.constructor, eventName)) {
            this.addListener(eventName, function (e) {
              attachChangeBubbleListener(e.getData());

              this.__handleLocalPropertyChangeEvent(e);
            }, this);
          }
        }, this);
        var that = this;
        window.addEventListener("message", function (message) {
          that.__handleIncomingMessage(message);
        });
        this.__isInitialized = true;
      },

      /**
       * Handles the property change events of the instance
       * @param e {qx.event.type.Data}
       * @private
       */
      __handleLocalPropertyChangeEvent: function __handleLocalPropertyChangeEvent(e) {
        var type = e.getType();
        var value = e.getData();
        var oldValue = e.getOldData();

        var data = this.__serialize(value);

        var oldData = this.__serialize(oldValue);

        this.__broadcastEvent(type, data, oldData);
      },

      /**
       * Given a property change event name, return the name of the property
       * @param type {String}
       * @return {String}
       * @private
       */
      __computePropertyNameFromEventType: function __computePropertyNameFromEventType(type) {
        var firstUpProp = type.slice(6);
        return qx.lang.String.firstLow(firstUpProp);
      },

      /**
       * Broadcasts the 'changeBubble' events of the instance properties
       * @param e {qx.event.type.Data}
       * @param prop {String} the name of the property that fired the event
       * @private
       */
      __handleLocalChangeBubbleEvent: function __handleLocalChangeBubbleEvent(e, prop) {
        var data = e.getData();
        data.name = prop + "." + data.name;

        if (qx.lang.Type.isArray(data.value)) {
          data.value = data.value.map(this.__serialize, this);
        } else {
          data.value = this.__serialize(data.value);
        }

        delete data.old;
        delete data.item;

        this.__broadcastEvent("changeBubble", data);
      },

      /**
       * Broadcast a message with the given parameters
       * @param type {String}
       * @param data {*|undefined}
       * @param oldData {*|undefined}
       * @private
       */
      __broadcastEvent: function __broadcastEvent(type, data, oldData) {
        this.__remoteWindows.forEach(function (win) {
          if (win === this.__changeSource) {
            // do not retransmit value change to origin of change
            return;
          }

          this.__sendEventMessage(win, type, data, oldData);
        }, this);
      },

      /**
       * Sends a event message to the given window.
       * @param win {Window}
       * @param type {String}
       * @param data {*|undefined}
       * @param oldData {*|undefined}
       * @private
       */
      __sendEventMessage: function __sendEventMessage(win, type, data, oldData) {
        qx.core.Assert.assertTrue(type && qx.lang.Type.isString(type), "Type must be a non-empty string");
        var message = {
          event: {
            type: type
          }
        };

        if (data !== undefined) {
          message.event.data = data;
        }

        if (oldData !== undefined) {
          message.event.oldData = oldData;
        }

        this.__sendMessage(win, message);
      },

      /**
       * Send a message to the peer using the postMessage API
       * @param win {Window}
       * @param message {String}
       * @private
       */
      __sendMessage: function __sendMessage(win, message) {
        qx.core.Assert.assertTrue(win.window === win, "First argument must be a Window object");

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
      __handleIncomingMessage: function __handleIncomingMessage(message) {
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

        var type = msgData.event.type;

        if (type.startsWith("change") && type !== "changeBubble") {
          this.__handleRemotePropertyChangeEvent(message);
        } else {
          switch (type) {
            case "ready":
              this.__handleRemoteReadyEvent(message);

              break;

            case "changeBubble":
              this.__handleRemoteChangeBubbleEvent(message);

              break;

            default:
              throw new Error("No handler for event type '" + type + "'.");
          }
        }
      },

      /**
       * When receiving the "ready" event from a window, send property state
       * @param message {Object}
       */
      __handleRemoteReadyEvent: function __handleRemoteReadyEvent(message) {
        var win = message.source;

        this._getPropertyNamesToSync().forEach(function (prop) {
          var firstUpProp = qx.lang.String.firstUp(prop);
          var type = "change" + firstUpProp;
          var value = this["get" + firstUpProp]();

          var data = this.__serialize(value);

          this.__sendEventMessage(win, type, data);
        }, this);
      },

      /**
       * Send the ready event to another window, usually the opener
       * @param win {Window}
       * @private
       */
      __sendReadyEvent: function __sendReadyEvent(win) {
        this.__sendEventMessage(win, "ready");
      },

      /**
       * Handle the change event for normal property values
       * @param message {Object}
       * @private
       */
      __handleRemotePropertyChangeEvent: function __handleRemotePropertyChangeEvent(message) {
        var evtData = message.data.event;
        var firstUpProp = evtData.type.slice(6);
        var prop = qx.lang.String.firstLow(firstUpProp);
        var oldValue = this["get" + firstUpProp]();

        if (evtData.oldData !== undefined && !qx.lang.Type.isObject(evtData.oldData) && evtData.oldData !== oldValue) {
          this.warn("Property '" + prop + "' was out of sync - remote old value " + evtData.oldData + " does not match " + oldValue);
        }

        var data = evtData.data;

        var value = this.__unserialize(data);

        console.debug(">>> Setting property '" + prop + "':");
        console.debug(value);
        this.__changeSource = message.source;
        this["set" + firstUpProp](value);
        this.__changeSource = null;
      },

      /**
       * Handle the changeBubble event for qooxdoo data objects
       * @param message {Object}
       * @private
       */
      __handleRemoteChangeBubbleEvent: function __handleRemoteChangeBubbleEvent(message) {
        var evtData = message.data.event;
        var target = this;
        var parts = evtData.data.name.split(".");

        var value = this.__unserialize(evtData.data.value);

        parts.slice(0, -1).forEach(function (part) {
          if (part[0] === "[") {
            target = target.getItem(parseInt(part.slice(1, -1)));
          } else {
            target = target["get" + qx.lang.String.firstUp(part)]();
          }
        });
        var lastPart = parts.pop();
        this.__changeSource = message.source; // prevent re-transmission of changed values

        if (lastPart.match(/^[0-9]/)) {
          var range = lastPart.split("-");
          var start = parseInt(range[0]);
          var deleteCount;

          if (range.length > 1) {
            deleteCount = range[1] - range[0] + 1;
          } else {
            deleteCount = value.length - 1;
          }

          var args = [start, deleteCount].concat(value);
          target.splice.apply(target, args);
        } else {
          target["set" + qx.lang.String.firstUp(lastPart)](value);
        }

        this.__changeSource = null;
      },

      /**
       * Serialize an arbitrary value, including many qooxdoo objects,
       * to a JSON value that can be sent to a remote target
       * @param object {qx.core.Object|*}
       * @return {*|Array|String|Object}
       * @private
       */
      __serialize: function serialize(object) {
        if (!(object instanceof qx.core.Object)) {
          return qx.util.Serializer.toNativeObject(object);
        }

        var class_prop = cboulanger.eventrecorder.window.MRemoteBinding.SERIALIZER_CLASS_PROP;
        var data_prop = cboulanger.eventrecorder.window.MRemoteBinding.SERIALIZER_DATA_PROP;
        var classname;

        if (object.classname.startsWith("qx.data.model.")) {
          classname = "qx.data.model";
        } else {
          classname = object.classname;
        }

        var result = {};
        result[class_prop] = classname;

        if (qx.Class.hasInterface(object.constructor, qx.data.IListData)) {
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
       *    The json object which will be unserialized into a qooxdoo object if
       *    it has been serialized from a qooxdoo object. Normal object and
       *    primitive values will be used as-is.
       * @param includeBubbleEvents {Boolean} Defaults to true
       * @return {qx.core.Object|*}
       */
      __unserialize: function unserialize(object, includeBubbleEvents = true) {
        var class_prop = cboulanger.eventrecorder.window.MRemoteBinding.SERIALIZER_CLASS_PROP;
        var data_prop = cboulanger.eventrecorder.window.MRemoteBinding.SERIALIZER_DATA_PROP;
        var result;
        var prop;

        if (qx.lang.Type.isArray(object)) {
          return object.map(unserialize);
        }

        if (!qx.lang.Type.isObject(object)) {
          return object;
        }

        var classname = object[class_prop];

        if (classname) {
          switch (classname) {
            case "qx.data.model":
              delete object[class_prop];
              return qx.data.marshal.Json.createModel(object, includeBubbleEvents);

            default:
              var Clazz = qx.Class.getByName(classname);
              result = new Clazz();

              if (qx.Class.hasInterface(result.constructor, qx.data.IListData)) {
                object[data_prop].forEach(function (item, index) {
                  result.setItem(index, unserialize(item));
                });
              } else {
                for (prop in object) {
                  if (prop !== class_prop) {
                    result.set(prop, unserialize(object[prop]));
                  }
                }
              }

          }

          return result;
        }

        for (prop in object) {
          result[prop] = unserialize(object[prop]);
        }

        return result;
      }
    }
  });
  cboulanger.eventrecorder.window.MRemoteBinding.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=MRemoteBinding.js.map?dt=1571643405908