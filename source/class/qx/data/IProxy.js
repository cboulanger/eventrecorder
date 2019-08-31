/**
 * A Proxy is an object that represents another object that lives in a different
 * execution context (such as in another browser window, a worker, an application
 * running on a different server. The proxy replicates the selected or all properties
 * of the remote objects, including deeply nested objects. It will also synchronize
 * property changes. By default, all qooxdoo classes will be transformed to
 * data models that you can bind other object properties to. If you are sure this
 * does not introduce side effects, you can also replicate the qooxdoo classes.
 * For this, you need to manually include those classes in your application.
 */
qx.Interface.define("qx.data.IProxy", {
  members: {
    /**
     * Initializes property synchronization with the remote peer using the
     * given channel. Usuallly implemented by {@link qx.data.MRemoteBinding} and
     * called implicitly by {@link qx.data.IProxy#startPropertySync}.
     *
     * @param channel {qx.io.channel.Channel}
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
    _syncProperties: function(channel, options) {},

    /**
     * Starts the synchronization of object properties
     * The method signature is dependent on the implementation
     */
    startPropertySync: function () {},

    /**
     * Starts the synchronization of object properties
     */
    stopPropertySync: function () {},
  }
});
