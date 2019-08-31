/**
 * A channel is the connection between two objects living in different execution
 * context. It relies on a Transport object to pass messages between the i/o endpoints.
 */
qx.Class.define("qx.io.channel.Channel", {
  extend: qx.core.Object,

  /**
   * Static constants
   */
  statics: {
    CHANNEL_STATUS_OPEN: "open",
    CHANNEL_STATUS_CLOSED: "closed",
    CHANNEL_STATUS_OFFLINE: "offline",
    CHANNEL_STATUS_WAITING: "waiting"
  },

  /**
   * Constructor
   * @param transport {qx.data.channel.transport.ITransport}
   */
  construct: function(transport){
    this.base(arguments);
    qx.Interface.objectImplements(transport, qx.data.channel.transport.ITransport);
    this.__transport = transport;

    // retransmit message, attaching channel information
    transport.addListener("message", function(e)  {
      message.channel = this;
      this.fireDataEvent("message", e.getData());
    });

    // bind the status of the channel to the status of the transport
    this.initStatus(transport.getStatus());
    transport.bind("status", this, "status");
  },

  /**
   * Events
   */
  events: {
    /**
     * Whenever a channel endpoint sends a message into this channel,
     * this event is fired with the message object as data.
     */
    "message" :"qx.event.type.Data"
  },

  properties: {
    status: {
      check: [
        qx.io.channel.Channel.CHANNEL_STATUS_OPEN,
        qx.io.channel.Channel.CHANNEL_STATUS_CLOSED,
        qx.io.channel.Channel.CHANNEL_STATUS_WAITING,
        qx.io.channel.Channel.CHANNEL_STATUS_OFFLINE
      ],
      deferredInit: true,
      event: "changeStatus",
      apply: "_applyStatus"
    }
  },

  members: {

    __transport: null,

    _applyStatus: function(value, old){
      // prevent non-transport objects from changing the status?
    },

    /**
     * Returns the transport object
     * @return {qx.data.channel.transport.ITransport}
     */
    getTransport: function() {
      return this.__transport;
    },

    /**
     * Send a message into the channel, using the selected transport
     * @param messageObj {Object}
     */
    sendMessage: function (messageObj) {
      this.__transport.sendMessage(messageObj);
    }
  }
});
