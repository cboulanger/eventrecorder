/**
 * A Transport is an object that can send and receive arbitrary JSON objects to
 * a remote target using an endpoint object that does the actual communication
 * with the target. It can be used by one or more channels.
 */
qx.Interface.define("qx.data.channel.transport.Abstract", {
  extend: qx.core.Object,
  type: "abstract",

  events: {
    /**
     * Whenever a endpoint sends a message over this transport,
     * this event is fired with the message object as data.
     */
    "message" :"qx.event.type.Data"
  },

  properties: {

    /**
     * The endpoint object
     */
    endpoint: {
      check: "Object",
      event: "changeEndpoint"
    },

    /**
     * A human-readable name of the endpoint for use in logging, debugging etc.
     */
    endpointName: {
      check: "String",
      event: "changeEndpointName"
    },

    status: {
      check: [
        qx.io.channel.Channel.CHANNEL_STATUS_OPEN,
        qx.io.channel.Channel.CHANNEL_STATUS_CLOSED,
        qx.io.channel.Channel.CHANNEL_STATUS_WAITING,
        qx.io.channel.Channel.CHANNEL_STATUS_OFFLINE
      ],
      init: qx.io.channel.Channel.CHANNEL_STATUS_WAITING,
      event: "changeStatus",
      apply: "_applyStatus"
    }
  },


  members: {

    /**
     * Close the connection
     */
    close: function() {
      this.setStatus(qx.io.channel.Channel.CHANNEL_STATUS_CLOSED);
    },

    /**
     * Send a message into the channel
     * @param messageObj {Object}
     */
    sendMessage: function (messageObj){
      throw new Error("Method must be implemented by subclass!");
    }
  }
});
