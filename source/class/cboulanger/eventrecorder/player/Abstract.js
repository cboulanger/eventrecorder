/* ************************************************************************

  UI Event Recorder

  Copyright:
    2018 Christian Boulanger

  License:
    MIT license
    See the LICENSE file in the project's top-level directory for details.

  Authors: Christian Boulanger

************************************************************************ */

/**
 * The base class of all player types
 * @require(qx.bom.Element)
 */
qx.Class.define("cboulanger.eventrecorder.player.Abstract", {
  extend : qx.core.Object,
  include : [cboulanger.eventrecorder.MHelperMethods],

  statics: {
    /**
     * Runs the given function in the interval until it returns true or the
     * given timeout is reached. Returns a promise that will resolve once the
     * function returns true or rejects if the timeout is reached.
     * @param fn {Function} Condition function
     * @param interval {Number} The interval in which to run the function. Defaults to 100 ms.
     * @param timeout {Number} The timeout in milliseconds. Defaults to 10 seconds
     * @param timeoutMsg {String|undefined} An optional addition to the timeout error message
     * @return {Promise}
     */
    waitForCondition: function(fn, interval=100, timeout=10000, timeoutMsg) {
      return new Promise(((resolve, reject) => {
        let intervalId = setInterval(() => {
          if (fn()) {
            clearInterval(intervalId);
            resolve();
          }
        }, interval);
        setTimeout(() => {
          clearInterval(intervalId);
          reject(new Error(timeoutMsg || `Timeout waiting for condition.`));
        }, timeout);
      }));
    },

    /**
     * Returns a promise that will resolve (with any potential event data) if the given object fires an event with the given type
     * and will reject if the timeout is reached before that happens.
     * @param qxObj {qx.core.Object}
     * @param type {String} Type of the event
     * @param data {*} The data to expect. If not null, the data will be compared with the actual event data both serialized to JSON
     * @param timeout {Number} The timeout in milliseconds. Defaults to 10 seconds
     * @param timeoutMsg {String|undefined} An optional addition to the timeout error message
     * @return {Promise}
     */
    waitForEvent: function(qxObj, type, data, timeout=10000, timeoutMsg) {
      return new Promise(((resolve, reject) => {
        let timeoutId = setTimeout(() => {
          reject(new Error(timeoutMsg || `Timeout waiting for event "${type}.`));
        }, timeout);
        qxObj.addListenerOnce(type, e => {
          let eventdata = e instanceof qx.event.type.Data ? e.getData() : null;
          if (eventdata !== null && (JSON.stringify(eventdata) !== JSON.stringify(data))) {
            this.debug(JSON.stringify(eventdata) + " !== " + JSON.stringify(data) +" !!");
            return;
          }
          clearTimeout(timeoutId);
          resolve(eventdata);
        });
      }));
    }
  },

  properties: {
    /**
     * The replay mode. Possible values:
     * "test": The script is executed ignoring the "delay" commands, errors will
     * stop execution and will be thrown.
     * "presentation": The script is executed with user delays, errors will be
     * logged to the console but will not stop execution
     */
    mode: {
      check: ["test", "presentation"],
      event: "changeMode",
      init: "test"
    },

    /**
     * The timeout in milliseconds
     */
    timeout: {
      check: "Number",
      init: 10000
    },

    /**
     * The interval between checks if waiting for a condition to fulfil
     */
    interval: {
      check: "Number",
      init: 1000
    },

    /**
     * if true, ignore user delays and use defaultDelay
     */
    useDefaultDelay: {
      check: "Boolean",
      nullable: false,
      init: false
    },

    /**
     * The maximun delay between events (limits user-generated delay)
     */
    maxDelay: {
      check: "Number",
      init: 1000
    },

    /**
     * Whether the player can replay the generated script in the browser
     */
    canReplayInBrowser: {
      check: "Boolean",
      nullable: false,
      init: false,
      event: "changeCanReplay"
    },

    /**
     * Whether the player can export code that can be used outside this application
     */
    canExportExecutableCode: {
      check: "Boolean",
      nullable: false,
      init: false,
      event: "changeCanExportExecutableCode"
    }
  },

  events: {
    /**
     * Fired with each step of the replayed script. The event data is an array
     * containing the number of the step and the number of steps
     */
    "progress" : "qx.event.type.Data"
  },

  /**
   * The methods and simple properties of this class
   */
  members :
  {
    /**
     * Simple tokenizer which splits expressions separated by whitespace, but keeps
     * expressions in quotes (which can contain whitespace) together.
     * @param line {String}
     * @return {String[]}
     * @private
     */
    _tokenize(line) {
      qx.core.Assert.assertString(line);
      let tokens = [];
      let token = "";
      let prevChar="";
      let insideQuotes = false;
      for (let char of line.trim().split("")) {
        switch (char) {
          case "\"":
            insideQuotes=!insideQuotes;
            token += char;
            break;
          case " ":
            // add whitespace to token if inside quotes
            if (insideQuotes) {
              token += char;
              break;
            }
            // when outside quotes, whitespace is end of token
            if (prevChar !== " ") {
              // parse token as json expression or as a string if that fails
              try {
                token = JSON.parse(token);
              } catch (e) {}
              tokens.push(token);
              token = "";
            }
            break;
          default:
            token += char;
        }
        prevChar = char;
      }
      if (token.length) {
        try {
          token = JSON.parse(token);
        } catch (e) {}
        tokens.push(token);
      }
      return tokens;
    },

    /**
     * Translates a single line from the intermediate code into the target language. To be overridden by
     * subclasses if neccessary.
     * @param line {String}
     * @return {String}
     * @private
     */
    _translateLine(line) {
      // parse command line
      let [command, ...args] = this._tokenize(line);
      // run command generation implementation
      let method_name = "cmd_" + command.replace(/-/g, "_");
      if (typeof this[method_name] == "function") {
        return this[method_name].apply(this, args);
      }
      throw new Error(`Unsupported/unrecognized command: ${command}`);
    },

    /**
     * Replays the given script of intermediate code
     * @param script {String} The script to replay
     * @return {Promise} Promise which resolves when the script has been replayed, or
     * rejects with an error
     * @todo implement pausing
     */
    async replay(script) {
      this.setRunning(true);
      this._globalRef = "player" + this.toHashCode();
      window[this._globalRef]=this;
      let lines = script.split(/\n/);
      let steps = lines.reduce((prev, curr, index) => prev+Number(!curr.startsWith("wait")), 0);
      let step = 0;
      for (let line of lines) {
        // stop if we're not running
        if (!this.getRunning()) {
          return;
        }
        // ignore comments and empty lines
        if (line.trim()==="" || line.startsWith("#")) {
          continue;
        }
        // wait doesn't count as a step
        if (!line.startsWith("wait") || !line.startsWith("delay")) {
          step++;
        }
        // ignore delay in test mode
        if (this.getMode()==="test" && line.startsWith("delay")) {
          continue;
        }
        // inform listeners
        this.fireDataEvent("progress", [step, steps]);
        try {
          // translate
          let code = this._translateLine(line);
          this.debug(`\n===== Step ${step} / ${steps} ====\nCommand: ${line}\nExecuting: ${code}`);
          // execute
          let result = window.eval(code);
          if (result instanceof Promise) {
            await result;
          }
        } catch (e) {
          switch (this.getMode()) {
            case "test":
              throw e;
            case "presentation":
              this.error(e);
          }
        }
      }
      this.setRunning(false);
    },

    /**
     * Translates the intermediate code into the target language
     * @param script
     * @return {string} executable code
     */
    translate(script) {
      return script.split(/\n/).map(line => this._translateLine(line)).join("\n");
    },

    /**
     * Given an async piece of code which checks for a condition or an application state,
     * return code that checks for this condition, throwing an error if the
     * condition hasn't been fulfilled within the set timeout.
     * @param condition {String} The condition expression as a string
     * @param timeoutmsg {String|undefined} A message to be shown if the condition hasn't been met before the timeout. If not given
     * the condition expression will be shown
     */
    generateWaitForConditionCode(condition, timeoutmsg) {
      return `(cboulanger.eventrecorder.player.Abstract.waitForCondition(() => ${condition},${this.getInterval()},${this.getTimeout()}, "${timeoutmsg||condition.replace(/"/g, "\\\"")}"))`;
    },

    /**
     * Generates code that returns a promise which will resolve (with any potential event data) if the given object fires
     * an event with the given type and data (if applicable) and will reject if the timeout is reached before that happens.
     * @param id {String} The id of the object to monitor
     * @param type {String} The type of the event to wait for
     * @param data {*|null} The data to expect. Must be serializable to JSON
     * @param timeoutmsg {String|undefined} A message to be shown if the event hasn't been fired before the timeout.
     * @return {String}
     */
    generateWaitForEventCode(id, type, data=null, timeoutmsg) {
      return `(cboulanger.eventrecorder.player.Abstract.waitForEvent(qx.core.Id.getQxObject("${id}"), "${type}",${JSON.stringify(data)}, ${this.getTimeout()}, "${timeoutmsg||"Timeout waiting for event '"+type+"'"}"))`;
    },

    /**
     * Generates code that returns a promise which will resolve (with any potential event data) if the given object fires
     * an event with the given type and data (if applicable). After the timeout, it will execute the given code and restart
     * the timeout.
     * @param id {String} The id of the object to monitor
     * @param type {String} The type of the event to wait for
     * @param data {*|null} The data to expect. Must be serializable to JSON
     * @param code {String} The code to execute after the timeout
     * @return {String}
     */
    generateWaitForEventTimoutFunction(id, type, data=null, code) {
      return `(new Promise(async (resolve, reject) => { 
        while (true){
          try {
            await cboulanger.eventrecorder.player.Abstract.waitForEvent(qx.core.Id.getQxObject("${id}"), "${type}", ${JSON.stringify(data)}, ${this.getTimeout()});
            return resolve(); 
          } catch (e) {
            console.debug(e.message);
            ${code};
          }
        }
      }))`;
    },

    /**
     * Returns the file extension of the downloaded file in the target language
     * @return {string}
     */
    getExportFileExtension() {
      throw new Error("Method getExportFileExtension must be impemented in subclass");
    }
  }
});
