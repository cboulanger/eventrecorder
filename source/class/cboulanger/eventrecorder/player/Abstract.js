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
          reject(new Error(`Timeout of ${timeout} ms has been reached${timeoutMsg?": "+timeoutMsg:""}`));
        }, timeout);
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
     * Replays the given script of intermediate code
     * @param script {String} The script to replay
     * @return {Promise} Promise which resolves when the script has been replayed, or
     * rejects with an error
     * @todo implement pausing
     */
    async replay(script) {
      this.setRunning(true);
      let lines = script.split(/\n/);
      let steps = lines.reduce((prev, curr, index) => prev+Number(!curr.startsWith("wait")), 0);
      let step = 0;
      for (let line of lines) {
        // stop if we're not running
        if (!this.getRunning()) {
          return true;
        }
        // wait doesn't count as a step
        if (!line.startsWith("wait") || !line.startsWith("delay")) {
          step++;
        }
        // comments
        if (line.startsWith("#")) {
          continue;
        }
        // ignore delay in test mode
        if (this.getMode()==="test" && line.startsWith("delay")) {
          continue;
        }
        // inform listeners
        this.fireDataEvent("progress", [step, steps]);
        // parse command line, todo: use real tokenizer
        let [command, id, ...data] = line.split(/ /);
        data = data.join(" ");
        // run command generation implementation
        let method_name = "cmd_" + command.replace(/-/g, "_");
        if (typeof this[method_name] == "function") {
          let code = this[method_name](id, data);
          this.debug(`\n===== Step ${step} / ${steps} ====\nCommand: ${line}\nExecuting: ${code}`);
          try {
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
        } else {
          let msg = `Unsupported/unrecognized command: ${command}`;
          this.warn(msg);
        }
      }
      this.setRunning(false);
    },

    /**
     * Translates the intermediate code into the target language
     * @param script
     * @return {string} Javasc
     */
    translate(script) {
      return script.split(/\n/).map(line => this.generateReplayCode(line)).join("\n");
    },

    /**
     * Given an async piece of code which checks for a condition or an application state,
     * return code that checks for this condition, throwing an error if the
     * condition hasn't been fulfilled within the set timeout.
     * @param condition {String} The condition expression as a string
     * @param timeoutmsg {String} A message to be shown if the condition hasn't been met before the timeout. If not given
     * the condition expression will be shown
     */
    generateWaitForCode(condition, timeoutmsg=null) {
      return `(cboulanger.eventrecorder.player.Abstract.waitForCondition(() => ${condition},${this.getInterval()},${this.getTimeout()}, "${timeoutmsg||condition.replace(/"/g, "\\\"")}"))`;
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
