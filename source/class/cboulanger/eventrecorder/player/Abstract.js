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
     * An object mapping macro names to arrays containing the macro lines
     * @var {Object}
     */
    __macros : null,

    /**
     * An array of object containing information on the macros that are currently
     * being defined (in a nested way)
     * @var {Object[]}
     */
    __macro_stack: null,

    /**
     * The index of the macro in the macro stack that is currently defined
     * @var {Integer}
     */
    __macro_stack_index: -1,

    /**
     * Variables
     */
    __vars: null,

    /**
     * Simple tokenizer which splits expressions separated by whitespace, but keeps
     * expressions in quotes (which can contain whitespace) together. Parses tokens
     * as JSON expressions, but accepts unquoted text as strings.
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
     * Given a script, return an array of lines with all variable and macro declarations
     * removed, variables expanded and macros registered.
     * @param script {String}
     * @return {Array}
     * @private
     */
    _handleMacrosAndVariables(script) {
      this.__macros = {};
      this.__macro_stack = [];
      this.__macro_stack_index = -1;
      this.__vars = {};
      let lines = [];
      for (let line of script.split(/\n/)) {
        line = line.trim();
        if (!line) {
          continue;
        }
        // variables
        let var_def = line.match(/([^=\s]+)\s*=\s*(.+)/);
        if (var_def) {
          this.__vars[var_def[1]] = var_def[2];
          continue;
        } else if (line.match(/\$([^\s\d\/]+)/)) {
          line = line.replace(/\$([^\s\d\/]+)/g, (...args) => this.__vars[args[1]]);
        }
        // macros
        if (line.startsWith("define ") || line === "end") {
          this._translateLine(line);
        } else if (this.__macro_stack_index >= 0) {
          let {name} = this.__macro_stack[this.__macro_stack_index];
          this.__macros[name].push(line);
        } else {
          lines.push(line);
        }
      }
      return lines;
    },

    /**
     * Returns the macro lines
     * @param macro_name {String}
     * @param args {Array}
     * @return {Array}
     * @private
     */
    _getMacro(macro_name, args) {
      let macro_lines = this.__macros[macro_name];
      if (macro_lines !== undefined) {
        // argument placeholders
        for (let i = 0; i < args.length; i++) {
          macro_lines = macro_lines.map(l => l.replace(new RegExp("\\$" + (i + 1), "g"), JSON.stringify(args[i])));
        }
      }
      return macro_lines;
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
      window[this._globalRef] = this;
      let steps = 0;
      let lines = this._handleMacrosAndVariables(script);
      for (let line of lines) {
        if (!line.startsWith("wait ") && !line.startsWith("#") && !line.startsWith("delay")) {
          steps++;
        }
      }
      let result = await this._play(lines, steps, 0);
      this.setRunning(false);
      return result;
    },

    /**
     * Replays a number of script lines
     * @param lines {String[]}
     * @param steps {Integer?}
     * @param step {Integer?}
     * @return {Promise<boolean>}
     * @private
     */
    async _play(lines, steps=0, step=0) {
      for (let line of lines) {

        // stop if we're not running (user pressed "stop" button
        if (!this.getRunning()) {
          return false;
        }

        // play macros recursively
        let [command, ...args] = this._tokenize(line);
        let macro_lines = this._getMacro(command, args);
        if (macro_lines !== undefined) {
          if (steps) {
            step++;
            this.debug(`\n===== Step ${step} / ${steps}, executing macro ${command} =====`);
          }
          await this._play(macro_lines);
          continue;
        }

        // ignore comments
        if (line.startsWith("#")) {
          continue;
        }
        // count steps if given, wait doesn't count as a step
        if (steps && !line.startsWith("wait") && !line.startsWith("delay")) {
          step++;
          // inform listeners
          this.fireDataEvent("progress", [step, steps]);
          this.debug(`\n===== Step ${step} / ${steps} ====`);
        }
        // ignore delay in test mode
        if (this.getMode()==="test" && line.startsWith("delay")) {
          continue;
        }

        try {
          // translate
          let code = this._translateLine(line);
          if (!code) {
            continue;
          }
          // all other code is executed
          this.debug(`Command: ${line}\nExecuting: ${code}`);
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
      return true;
    },


    /**
     * Translates the intermediate code into the target language
     * @param script
     * @return {string} executable code
     */
    translate(script) {
      return this._translate(script);
    },

    /**
     * Implementation for #translate()
     * @param script
     * @return {string}
     * @private
     */
    _translate(script) {
      let lines = this._handleMacrosAndVariables(script);
      let translatedLines = [];
      for (let line of lines) {
        if (line.startsWith("#")) {
          translatedLines.push(this.addComment(line.substr(1).trim()));
          continue;
        }
        let [command, ...args] = this._tokenize(line);
        let macro_lines = this._getMacro(command, args);
        let new_lines = (macro_lines ||[line]).map(l => this._translateLine(l));
        translatedLines = translatedLines.concat(new_lines);
      }
      return translatedLines.join("\n");
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
     * @param data {*|null} The data to expect. Must be serializable to JSON. Exception: if the data is a string that
     * starts with "{verbatim}", use the unquoted string
     * @param timeoutmsg {String|undefined} A message to be shown if the event hasn't been fired before the timeout.
     * @return {String}
     */
    generateWaitForEventCode(id, type, data=null, timeoutmsg) {
      if (qx.lang.Type.isString(data) && data.startsWith("{verbatim}")) {
        data = data.substr(10);
      } else {
        data = JSON.stringify(data);
      }
      return `(cboulanger.eventrecorder.player.Abstract.waitForEvent(qx.core.Id.getQxObject("${id}"), "${type}",${data}, ${this.getTimeout()}, "${timeoutmsg||"Timeout waiting for event '"+type+"'"}"))`;
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
     * Adds a line comment to the target script
     * @param comment {String}
     * @return {string}
     */
    addComment(comment) {
      return "// " + comment;
    },

    /**
     * Returns the file extension of the downloaded file in the target language
     * @return {string}
     */
    getExportFileExtension() {
      throw new Error("Method getExportFileExtension must be impemented in subclass");
    },

    cmd_define(macro_name) {
      if (this.__macros[macro_name] !== undefined) {
        throw new Error(`Cannot define macro '${macro_name}' since a macro of that name already exists.`);
      }
      let index = ++this.__macro_stack_index;
      this.__macro_stack[index] = { name: macro_name };
      this.__macros[macro_name] = [];
      return null;
    },

    cmd_end() {
      if (this.__macro_stack_index < 0) {
        throw new Error(`Unexpected 'end' without macro definition.`);
      }
      this.__macro_stack_index--;
      return null;
    }
  }
});
