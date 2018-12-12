(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Bootstrap": {
        "usage": "dynamic",
        "require": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);qx.Bootstrap.define("qx.util.RingBuffer", {
    extend: Object,

    /**
     * Constructor.
     *
     * @param maxEntries {Integer ? 50} Maximum number of entries in the buffer
     */
    construct: function construct(maxEntries) {
      this.setMaxEntries(maxEntries || 50);
    },

    members: {
      //Next slot in ringbuffer to use
      __nextIndexToStoreTo: 0,

      //Number of elements in ring buffer
      __entriesStored: 0,

      //Was a mark set?
      __isMarkActive: false,

      //How many elements were stored since setting of mark?
      __entriesStoredSinceMark: 0,

      //ring buffer
      __entries: null,

      //Maximum number of messages to store. Could be converted to a qx property.
      __maxEntries: null,

      /**
       * Set the maximum number of messages to hold. If null the number of
       * messages is not limited.
       *
       * Warning: Changing this property will clear the events logged so far.
       *
       * @param maxEntries {Integer} the maximum number of messages to hold
       */
      setMaxEntries: function setMaxEntries(maxEntries) {
        this.__maxEntries = maxEntries;
        this.clear();
      },

      /**
       * Get the maximum number of entries to hold
       *
       * @return {Integer}
       */
      getMaxEntries: function getMaxEntries() {
        return this.__maxEntries;
      },

      /**
       * Adds a single entry
       *
       * @param entry {var} The data to store
       */
      addEntry: function addEntry(entry) {
        this.__entries[this.__nextIndexToStoreTo] = entry;

        this.__nextIndexToStoreTo = this.__addToIndex(this.__nextIndexToStoreTo, 1);

        //Count # of stored entries
        var max = this.getMaxEntries();
        if (this.__entriesStored < max) {
          this.__entriesStored++;
        }

        //Count # of stored elements since last mark call
        if (this.__isMarkActive && this.__entriesStoredSinceMark < max) {
          this.__entriesStoredSinceMark++;
        }
      },

      /**
       * Returns the number of entries stored
       * @return {Integer}
       */
      getNumEntriesStored: function getNumEntriesStored() {
        return this.__entriesStored;
      },

      /**
       * Remembers the current position in the ring buffer
       *
       */
      mark: function mark() {
        this.__isMarkActive = true;
        this.__entriesStoredSinceMark = 0;
      },

      /**
       * Removes the current mark position
       */
      clearMark: function clearMark() {
        this.__isMarkActive = false;
      },

      /**
       * Returns all stored entries. Mark is ignored.
       *
       * @return {Array} array of stored entries
       */
      getAllEntries: function getAllEntries() {
        return this.getEntries(this.getMaxEntries(), false);
      },

      /**
       * Returns entries which have been added previously.
       *
       * @param count {Integer} The number of entries to retrieve. If there are
       *    more entries than the given count, the oldest ones will not be returned.
       *
       * @param startingFromMark {Boolean ? false} If true, only entries since
       *   the last call to mark() will be returned
       * @return {Array} array of stored entries
       */
      getEntries: function getEntries(count, startingFromMark) {
        //Trim count so it does not exceed ringbuffer size
        if (count > this.__entriesStored) {
          count = this.__entriesStored;
        }

        // Trim count so it does not exceed last call to mark (if mark was called
        // and startingFromMark was true)
        if (startingFromMark && this.__isMarkActive && count > this.__entriesStoredSinceMark) {
          count = this.__entriesStoredSinceMark;
        }

        if (count > 0) {

          var indexOfYoungestElementInHistory = this.__addToIndex(this.__nextIndexToStoreTo, -1);
          var startIndex = this.__addToIndex(indexOfYoungestElementInHistory, -count + 1);

          var result;

          if (startIndex <= indexOfYoungestElementInHistory) {
            //Requested segment not wrapping around ringbuffer boundary, get in one run
            result = this.__entries.slice(startIndex, indexOfYoungestElementInHistory + 1);
          } else {
            //Requested segment wrapping around ringbuffer boundary, get two parts & concat
            result = this.__entries.slice(startIndex, this.__entriesStored).concat(this.__entries.slice(0, indexOfYoungestElementInHistory + 1));
          }
        } else {
          result = [];
        }

        return result;
      },

      /**
       * Clears all entries
       */
      clear: function clear() {
        this.__entries = new Array(this.getMaxEntries());
        this.__entriesStored = 0;
        this.__entriesStoredSinceMark = 0;
        this.__nextIndexToStoreTo = 0;
      },

      /**
       * Adds a number to an ringbuffer index. Does a modulus calculation,
       * i. e. if the index leaves the ringbuffer space it will wrap around to
       * the other end of the ringbuffer.
       *
       * @param idx {Number} The current index.
       * @param addMe {Number} The number to add.
       * @return {Number} The new index
       */
      __addToIndex: function __addToIndex(idx, addMe) {
        var max = this.getMaxEntries();
        var result = (idx + addMe) % max;

        //If negative, wrap up into the ringbuffer space
        if (result < 0) {
          result += max;
        }
        return result;
      }
    }
  });
  qx.util.RingBuffer.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=RingBuffer.js.map?dt=1544616861001