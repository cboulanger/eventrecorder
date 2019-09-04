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
   * @param channelId {String?}
   *    The channel id is needed in situations where multiple channels share a
   *    transport object.
   */
  construct: function(transport, channelId) {
    this.base(arguments);
    qx.Interface.objectImplements(transport, qx.io.channel.transport.ITransport);
    this.__transport = transport;
    this.__channelId = channelId;

    // retransmit message, attaching channel information
    transport.addListener("message", function(e) {
      var message = e.getData();
      if (!message.$$channelId || message.$$channelId === this.__channelId) {
        message.$$channel = this;
        this.fireDataEvent("message", message);
      }
    }, this);

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

    /**
     * The status of the channel
     */
    status: {
      check: [
        qx.io.channel.Channel.CHANNEL_STATUS_OPEN,
        qx.io.channel.Channel.CHANNEL_STATUS_CLOSED,
        qx.io.channel.Channel.CHANNEL_STATUS_WAITING,
        qx.io.channel.Channel.CHANNEL_STATUS_OFFLINE
      ],
      deferredInit: true,
      event: "changeStatus"
    }
  },

  members: {

    /**
     * The transport used
     * @var {qx.io.channel.transport.ITransport}
     */
    __transport: null,

    /**
     * An identifier which needs to be unique in each of the endpoint contexts
     */
    __channelId: null,

    /**
     * Returns the transport object
     * @return {qx.data.channel.transport.ITransport}
     */
    getTransport: function() {
      return this.__transport;
    },

    /**
     * Returns the channel id or null if none has been set
     * @return {String|null}
     */
    getChannelId: function() {
      return this.__channelId;
    },

    /**
     * Send a message into the channel, using the selected transport
     * @param messageObj {Object}
     */
    sendMessage: function (messageObj) {
      if (this.__channelId) {
        messageObj.$$channelId = this.__channelId;
      }
      this.__transport.sendMessage(messageObj);
    }
  }
});
