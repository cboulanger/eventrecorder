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
qx.Mixin.define("qx.data.MRemoteBinding", {

  statics: {
    SERIALIZER_CLASS_PROP: "$$class",
    SERIALIZER_DATA_PROP: "$$data"
  },

  construct: function() {
    this.__channels = [];
  },

  members: {

    __messageSource: null,
    __channels: null,
    __isInitialized: false,

    /**
     * Initializes property synchronization with the remote peer using the
     * given channel. Must be called from the public syncProperty API method
     * of the proxy object that includes this mixin
     * @param channel {qx.io.channel.IChannel}
     *    The channel over which to synchronize the object properties
     * @param options {Object}
     *    Optional map with synchronization options:
     *      - {Array} properties The list of properties to synchronize, if not
     *        using the default list
     *      - {Boolean} useOriginalClasses If true, when recreating the objects,
     *        use the qooxdoo classes that were serialized on the other end.
     *        If false or undefined (default), create qx.data.model.* objects that
     *        contain the property data only, using the JSON marshaler.
     *        This is usually enough for remote databinding and prevents unintended
     *        side effects.
     */
    _syncProperties: function(channel, options) {
      options = options || {};
      qx.core.Assert.assertObject(options);
      if (!options.properties) {
        options.properties = this._getDefaultPropertyNamesToSync();
      }
      if (!this.__isInitialized) {
        this.__initialize();
      }
      channel.addListener("message", function(message) {
        this.__handleIncomingMessage(message);
      }, this);
      this.__channels.push([channel, options]);
    },

    /**
     * Stop the synchronization of object properties
     */
    stopPropertySync: function () {
      this.warn("Not implemented yet");
    },

    /**
     * Returns an array with the default property names to synchronize. This must
     * include all the properties that  will be synchronized through any of the
     * channels. By default, this will synchronize any existing property except
     * those definend in {@link qx.core.MObjectId}.
     * @return {Array}
     */
    _getDefaultPropertyNamesToSync: function() {
      return qx.Class.getProperties(qx.Class.getByName(this.classname))
        .filter(function(prop) {
          return !prop.startsWith("qx"); // better check needed.
        });
    },

    /**
     * Create a pseudo-UUID to avoid name clashes
     * @return {string}
     */
    _createUuid: function() {
      var dt = new Date().getTime();
      var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c === "x" ? r :(r&0x3|0x8)).toString(16);
      });
      return uuid;
    },

    /**
     * Initialize the object for remote databinding
     * @private
     */
    __initialize: function() {
      var properties = this._getDefaultPropertyNamesToSync();
      this.info("Initializing remote binding with properties " + properties.join(", "));
      properties.forEach(function(prop) {
        var firstUpProp = qx.lang.String.firstUp(prop);
        var eventName = "change" + firstUpProp;
        var attachChangeBubbleListener = function(value) {
          if (value instanceof qx.core.Object && !value.$$remoteBindingChangeBubbleListenerId) {
            if (qx.Class.supportsEvent(value.constructor, "changeBubble")) {
              console.debug("Attaching bubble event listener on " + prop);
              value.$$remoteBindingChangeBubbleListenerId = value.addListener("changeBubble", function(e) {
                this.__handleLocalChangeBubbleEvent(e, prop);
              }, this);
            }
          }
        }.bind(this);
        // watch for bubble events on existing suitable properties
        attachChangeBubbleListener(this["get" + firstUpProp]());
        // watch for property changes
        if (qx.Class.supportsEvent(this.constructor, eventName)) {
          this.$$remoteBindingChangeBubbleListenerId = this.addListener(eventName, function(e) {
            attachChangeBubbleListener(e.getData());
            this.__handleLocalPropertyChangeEvent(e);
          }, this);
        }
      }, this);
      this.__isInitialized = true;
    },

    /**
     * Tear down remote databinding
     * @private
     */
    __tearDown: function() {
      var properties = this._getDefaultPropertyNamesToSync();
      this.info("Ending remote binding of properties " + properties.join(", "));
      properties.forEach(function(prop) {
        var firstUpProp = qx.lang.String.firstUp(prop);
        var value = this["get" + firstUpProp]();
        if (value instanceof qx.core.Object && value.$$remoteBindingChangeBubbleListenerId) {
          value.removeListenerById(value.$$remoteBindingChangeBubbleListenerId);
        }
        if (this.$$remoteBindingChangeBubbleListenerId) {
          this.removeListenerById(this.$$remoteBindingChangeBubbleListenerId);
        }
      });
      this.__isInitialized = false;
    },


    /**
     * Handles the property change events of the instance
     * @param e {qx.event.type.Data}
     * @private
     */
    __handleLocalPropertyChangeEvent: function(e) {
      var type = e.getType();
      var value = e.getData();
      var oldValue = e.getOldData();
      var data = this.__serialize(value);
      var oldData = this.__serialize(oldValue);
      this.__broadcastEvent(type, data, oldData);
    },

    /**
     * Given a event name, return the name of the property involved or
     * null if the event is not a property change event
     * @param type {String}
     * @return {String|null}
     * @private
     */
    __computePropertyNameFromEventType: function(type) {
      if (type === "change" || type === "changeBubble" || !type.startsWith("change")) {
        return null;
      }
      return qx.lang.String.firstLow(type.slice(6));
    },

    /**
     * Broadcasts the 'changeBubble' events of the instance properties
     * @param e {qx.event.type.Data}
     * @param prop {String} the name of the property that fired the event
     * @private
     */
    __handleLocalChangeBubbleEvent: function(e, prop) {
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
    __broadcastEvent: function(type, data, oldData) {
      this.__channels.forEach(function(channelData) {
        var channel = channelData[0];
        var options = channelData[1];
        var changedProperty = this.__computePropertyNameFromEventType(type);
        // do not retransmit message to its origin
        if (channel === this.__messageSource) {
          return;
        }
        // if this is a property change event, should the property change to be sent over this channel
        if (changedProperty && !options.properties.includes(changedProperty)) {
          return;
        }
        this.__sendEventMessage(channel, type, data, oldData);
      }, this);
    },

    /**
     * Sends a event message to the given window.
     * @param channel {qx.io.channel.IChannel}
     * @param type {String} The name of the event
     * @param data {*|undefined}
     * @param oldData {*|undefined}
     * @private
     */
    __sendEventMessage: function(channel, type, data, oldData) {
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
      this.__sendMessage(channel, message);
    },

    /**
     * Send a message to the peer using the postMessage API
     * @param channel {qx.io.channel.IChannel}
     * @param message {String}
     * @private
     */
    __sendMessage: function(channel, message) {
      if (channel.getStatus() !== qx.io.channel.IChannel.CHANNEL_STATUS_OPEN) {
        this.warn("Cannot send message, channel status is '" + channel.getStatus() + "'");
        return;
      }
      channel.sendMessage(message);
      this.debug("Message sent to channel '" + channel.getName() + "':" + JSON.stringify(message));
    },

    /**
     * If the incoming message is a property change event sent by the peer,
     * apply the new value
     * @param message {Object}
     * @private
     */
    __handleIncomingMessage: function(message) {
      var channel = message.source;
      var msgData = message.data;
      this.debug("Message received from '" + channel.getName() + "':" + JSON.stringify(message));
      if (!qx.lang.Type.isObject(msgData) || !msgData.event || !msgData.event.type) {
        this.warn("Ignoring invalid message");
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
     * Given a channel, return the remote binding options
     * @param channel {qx.io.channel.IChannel}
     * @private
     */
    __getChannelOptions: function (channel) {
      return this.__channels.find(function(channelData) {
        return channelData[0] === channel ? channelData[1] : false;
      });
    },

    /**
     * When receiving the "ready" event from a channel endpoint, send property state
     * @param message {Object}
     */
    __handleRemoteReadyEvent: function(message) {
      var channel = message.source;
      var options = this.__getChannelOptions(channel);
      options.properties.forEach(function(prop) {
        var firstUpProp = qx.lang.String.firstUp(prop);
        var type = "change" + firstUpProp;
        var value = this["get" + firstUpProp]();
        var data = this.__serialize(value);
        this.__sendEventMessage(channel, type, data);
      }, this);
    },

    /**
     * Send the ready event to the channel
     * @param channel {qx.io.channel.IChannel}
     * @private
     */
    __sendReadyEvent: function(channel) {
      this.__sendEventMessage(channel, "ready");
    },

    /**
     * Handle the change event for normal property values
     * @param message {Object}
     * @private
     */
    __handleRemotePropertyChangeEvent: function(message) {
      var channel = message.source;
      var evtData = message.data.event;
      var data = evtData.data;
      var firstUpProp = evtData.type.slice(6);
      var prop = qx.lang.String.firstLow(firstUpProp);
      var oldValue = this["get" + firstUpProp]();
      if (evtData.oldData !== undefined &&
        !qx.lang.Type.isObject(evtData.oldData) &&
        evtData.oldData !== oldValue) {
        this.warn("Property '" + prop + "' was out of sync - remote old value " + evtData.oldData + " does not match " + oldValue);
      }
      var options = this.__getChannelOptions(channel);
      var config = {
        useOriginalClasses: options.useOriginalClasses
      };
      var value = this.__unserialize(data, config);
      this.debug("Setting property '" + prop + "' to " + JSON.stringify(value));
      this.__messageSource = channel;
      this["set" + firstUpProp](value);
      this.__messageSource = null;
    },

    /**
     * Handle the changeBubble event for qooxdoo data objects
     * @param message {Object}
     * @private
     */
    __handleRemoteChangeBubbleEvent: function(message) {
      var channel = message.source;
      var evtData = message.data.event;
      var target = this;
      var parts = evtData.data.name.split(".");
      var options = this.__getChannelOptions(channel);
      var config = {
        useOriginalClasses: options.useOriginalClasses
      };
      var value = this.__unserialize(evtData.data.value, config);
      parts.slice(0, -1).forEach(function(part) {
        if (part[0] === "[") {
          target = target.getItem(parseInt(part.slice(1, -1)));
        } else {
          target = target["get" + qx.lang.String.firstUp(part)]();
        }
      });
      var lastPart = parts.pop();
      this.__messageSource = channel; // prevent re-transmission of changed values
      if (lastPart.match(/^[0-9]/)) {
        var range = lastPart.split("-");
        var start = parseInt(range[0]);
        var deleteCount;
        if (range.length > 1) {
          deleteCount = (range[1] - range[0])+1;
        } else {
          deleteCount = value.length-1;
        }
        var args = [start, deleteCount].concat(value);
        target.splice.apply(target, args);
      } else {
        target["set" + qx.lang.String.firstUp(lastPart)](value);
      }
      this.__messageSource = null;
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
      var class_prop = this.self(arguments).SERIALIZER_CLASS_PROP;
      var data_prop = this.self(arguments).SERIALIZER_DATA_PROP;
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
     * @param config {Object}
     *    A configuration map with the following keys:
     *      - includeBubbleEvents {Boolean}
     *          Enable event bubbling (Default: true)
     *      - useOriginalClasses {Boolean}
     *          If true, when recreating the objects, use the qooxdoo classes
     *          that were serialized on the other end. If false or undefined
     *          (default), create qx.data.model.* objects that contain the
     *          property data only, using the JSON marshaler.
     * @return {qx.core.Object|*}
     */
    __unserialize: function unserialize(object, config) {
      if (config === undefined) {
        config = {};
      }
      var includeBubbleEvents = config.includeBubbleEvents !== false;
      var class_prop = this.self(arguments).SERIALIZER_CLASS_PROP;
      var data_prop = this.self(arguments).SERIALIZER_DATA_PROP;
      var result;
      var prop;
      if (qx.lang.Type.isArray(object)) {
        return object.map(unserialize);
      }
      if (!qx.lang.Type.isObject(object)) {
        return object;
      }
      var classname = object[class_prop];
      if (config.toDataModel && classname !== "qx.data.Array") {
        classname = "qx.data.model";
      }
      if (classname) {
        switch (classname) {
          case "qx.data.model":
            delete object[class_prop];
            return qx.data.marshal.Json.createModel(object, includeBubbleEvents);
          default:
            var Clazz = qx.Class.getByName(classname);
            result = new Clazz();
            if (qx.Class.hasInterface(result.constructor, qx.data.IListData)) {
              object[data_prop].forEach(function(item, index) {
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

