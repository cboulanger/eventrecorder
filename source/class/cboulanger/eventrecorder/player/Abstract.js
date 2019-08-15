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
  include : [
    cboulanger.eventrecorder.MState,
    cboulanger.eventrecorder.MHelperMethods
  ],

  statics: {
    utilityFunctions : {
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
       * Returns a promise that will resolve (with any potential event data) if
       * the given object fires an event with the given type and will reject if
       * the timeout is reached before that happens.
       *
       * @param qxObjOrId {qx.core.Object|String} If string, assume it is the object id
       * @param type {String} Type of the event
       * @param expectedData {*|undefined} The data to expect. If undefined,
       * resolve. If a regular expression, the event data as a JSON literal will
       * be matched with that regex and the promise will resolve when it matches.
       * Otherwise, the data will be compared with the actual event data both
       * serialized to JSON.
       * @param timeout {Number|undefined} The timeout in milliseconds. Defaults to 10 seconds
       * @param timeoutMsg {String|undefined} An optional addition to the timeout error message
       * @return {Promise}
       */
      waitForEvent: function(qxObjOrId, type, expectedData, timeout, timeoutMsg) {
        let qxObj = qxObjOrId;
        if (qx.lang.Type.isString(qxObjOrId)) {
          qxObj = qx.core.Id.getQxObject(qxObjOrId);
          if (!qxObj) {
            throw new Error(`Invalid object id ${qxObjOrId}`);
          }
        }
        timeout = timeout || this.getTimeout();

        return new Promise(((resolve, reject) => {
          // create a timeout
          let timeoutId = setTimeout(() => {
            qxObj.removeListener(type, changeEventHandler);
            reject(new Error(timeoutMsg || `Timeout waiting for event "${type}.`));
          }, timeout);

          // function to create a listener for the change event
          let changeEventHandler = e => {
            let app = qx.core.Init.getApplication();
            let eventdata = e instanceof qx.event.type.Data ? e.getData() : undefined;
            if (expectedData !== undefined) {
              if (eventdata === undefined) {
                app.warn(`\n--- When waiting for event '${type}' on object ${qxObj}, received 'undefined'`);
                qxObj.addListenerOnce(type, changeEventHandler);
                return;
              }
              if (qx.lang.Type.isArray(expectedData) && qx.lang.Type.isArray(eventdata) && expectedData.length && expectedData[0] instanceof qx.core.Object) {
                /** a) either match array and check for "live" qooxdoo objects in the array (this is for selections), */
                for (let [index, expectedItem] of expectedData.entries()) {
                  if (expectedItem !== eventdata[index]) {
                    app.warn(`\n--- When waiting for event '${type}' on object ${qxObj}, received non-matching array of qooxdoo objects!`);
                    qxObj.addListenerOnce(type, changeEventHandler);
                    return;
                  }
                }
              } else {
                // convert event data to JSON
                try {
                  eventdata = JSON.stringify(e.getData());
                } catch (e) {
                  throw new Error(`\n--- When waiting for event '${type}' on object ${qxObj}, could not stringify event data for comparison.`);
                }
                if (qx.lang.Type.isRegExp(expectedData)) {
                  /** b) or match a regular expression, */
                  if (!eventdata.match(expectedData)) {
                    app.warn(`\n--- When waiting for event '${type}' on object ${qxObj}, expected data to match '${expectedData.toString()}', got ${eventdata}!`);
                    qxObj.addListenerOnce(type, changeEventHandler);
                    return;
                  }
                } else {
                  /* c) or compare JSON equality */
                  try {
                    expectedData = JSON.stringify(expectedData);
                  } catch (e) {
                    throw new Error(`When waiting for event '${type}' on object ${qxObj}, could not stringify expected data for comparison.`);
                  }
                  if (eventdata !== expectedData) {
                    app.warn(`\n--- When waiting for event '${type}' on object ${qxObj}, expected '${JSON.stringify(expectedData)}', got '${JSON.stringify(eventdata)}'!"`);
                    qxObj.addListenerOnce(type, changeEventHandler);
                    return;
                  }
                }
              }
            }
            app.info(`\n+++ Received correct event '${type}' on object ${qxObj}."`);
            clearTimeout(timeoutId);
            resolve(eventdata);
          };

          // add a listener
          qxObj.addListenerOnce(type, changeEventHandler);
        }));
      }
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
      init: "presentation",
      apply: "_applyMode"
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
      init: 100
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
    },

    /**
     * Macro data
     */
    macros: {
      check: "qx.core.Object",
      init: null,
      event: "changeMacros"
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
   * constructor
   */
  construct: function() {
    this.base(arguments);
    this.__commands = [];
    this._globalRef = "eventrecorder_player";
    window[this._globalRef] = this;
    this.resetMacros();
    // inject utility functions in the statics section into the global scope
    // so that they are available in eval()
    for (let [name, fn] of Object.entries(this.self(arguments).utilityFunctions)) {
      window[name] = fn;
    }
  },

  /**
   * The methods and simple properties of this class
   */
  members :
  {
    /**
     * A globally accessible reference to the player implementation
     */
    _globalRef: null,

    /**
     * A list of available commands
     */
    __commands: null,

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
     * An array of promises which are to be awaited
     */
    __promises: null,

    /**
     * Last id addressed
     */
    __lastId : null,

    /**
     * Last command used
     */
    __lastCmd : null,

    /**
     * Returns the player type
     * @return {String}
     */
    getType() {
      throw new Error("Abstract method which needs to be implemented");
    },

    /**
     * Return the last id used
     * @return {String|null}
     */
    getLastId() {
      return this.__lastId;
    },

    /**
     * Return the last command used
     * @return {String|null}
     */
    getLastCommand() {
      return this.__lastCmd;
    },

    /**
     * Stub to be overridden if needed
     * @param value
     * @param old
     * @private
     */
    _applyMode(value, old) {},

    /**
     * NOT IMPLEMENTED
     * Adds the given array of commands
     * @param commands {Object[]}
     */
    _addCommands(commands) {
      this.__commands = this.__commands.concat(commands).sort((a, b) => a.name > b.name);
    },

    /**
     * NOT IMPLEMENTED
     * Returns the list of availabe commands
     * @return {Object[]}
     */
    getCommands() {
      return this.__commands;
    },

    /**
     * Clears all macro definitions and the macro stack
     */
    resetMacros() {
      if (this.getMacros()) {
        this.getMacros().dispose();
      }
      this.__macro_stack = [];
      this.__macro_stack_index = -1;
      let macros = qx.data.marshal.Json.createModel({
        names: [],
        definitions: [],
        descriptions: []
      }, true);
      this.setMacros(macros);
    },

    /**
     * Returns true if a macro of that name exists.
     * @param {String} name
     * @return {boolean}
     */
    macroExists(name) {
      return this.getMacros().getNames().indexOf(name) >= 0;
    },

    /**
     * Returns the names of the currently defined macros as a qx.data.Array
     * @return {qx.data.Array}
     */
    getMacroNames() {
      return this.getMacros().getNames();
    },

    /**
     * Returns an array with the lines of the macro of that name
     * @param {String} name
     * @return {Array}
     */
    getMacroDefinition(name) {
      let index = this.getMacros().getNames().indexOf(name);
      if (index < 0) {
        throw new Error(`Macro '${name}' does not exist`);
      }
      return this.getMacros().getDefinitions().getItem(index);
    },

    /**
     * Returns the description of the macro
     * @param {String} name
     * @return {String}
     */
    getMacroDescription(name) {
      let index = this.getMacros().getNames().indexOf(name);
      if (index < 0) {
        throw new Error(`Macro '${name}' does not exist`);
      }
      return this.getMacros().getDescriptions().getItem(index);
    },

    /**
     * Adds an empty macro of this name
     * @param {String} name
     * @param {String|undefined} description
     */
    addMacro(name, description) {
      if (this.macroExists(name)) {
        throw new Error(`A macro of the name '${name}' alread exists.`);
      }
      let macros = this.getMacros();
      macros.getDefinitions().push([]);
      macros.getDescriptions().push(description||"");
      macros.getNames().push(name);
    },

    /**
     * Begins the definition of a macro of that name.
     * @param {String} name
     */
    beginMacroDefintion(name) {
      let index = ++this.__macro_stack_index;
      this.__macro_stack[index] = { name };
    },

    /**
     * Returns true if the player is currently in a macro definition
     * @return {boolean}
     */
    isInMacroDefinition() {
      return this.__macro_stack_index >= 0;
    },

    /**
     * Return the name of the macro that is currently being defined
     * @return {String}
     */
    getCurrentMacroName() {
      if (!this.isInMacroDefinition()) {
        throw new Error("No macro is currently defined");
      }
      let {name} = this.__macro_stack[this.__macro_stack_index];
      return name;
    },

    /**
     * Leave the current macro, i.e. return to the including script/macro
     */
    leaveMacroDefinition() {
      this.getCurrentMacroName(); // this will throw if none is being defined
      this.__macro_stack_index--;
    },

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
     * Translates a single line from the intermediate code into the target
     * language. To be overridden by subclasses if neccessary.
     *
     * @param line {String}
     * @return {String}
     * @ignore(command)
     * @ignore(args)
     */
    async _translateLine(line) {
      // comment
      if (line.startsWith("#")) {
        return this.addComment(line.substr(1).trim());
      }
      // parse command line
      let [command, ...args] = this._tokenize(line);
      command = command.toLocaleLowerCase();
      this.__lastCmd = command;
      this.__lastId = args[0]; // assume first argument is id
      // run command generation implementation
      let method_name = "cmd_" + command.replace(/-/g, "_");
      if (typeof this[method_name] == "function") {
        let translatedLine = this[method_name].apply(this, args);
        // async function
        if (translatedLine && typeof translatedLine.then == "function") {
          translatedLine = await translatedLine;
        }
        if (translatedLine && translatedLine.startsWith("(") && this.isInAwaitBlock()) {
          this._addPromiseToAwaitStack(translatedLine);
          return null;
        }
        return translatedLine;
      }
      throw new Error(`Unsupported/unrecognized command: '${command}'`);
    },

    /**
     * Given a script, return an array of lines with all variable and macro
     * declarations registered and removed. Optionally, variables are expanded.
     *
     * @param script {String}
     * @param expandVariables {Boolean} Whether to expand the found variables. Default to true
     * @return {Array}
     * @private
     */
    async _handleMeta(script, expandVariables=true) {
      this.resetMacros();
      this.__vars = {};
      let lines = [];
      for (let line of script.split(/\n/)) {
        line = line.trim();
        if (!line) {
          continue;
        }
        // expand variables
        let var_def = line.match(/([^=\s]+)\s*=\s*(.+)/);
        if (var_def) {
          this.__vars[var_def[1]] = var_def[2];
          continue;
        } else if (expandVariables && line.match(/\$([^\s\d\/]+)/)) {
          line = line.replace(/\$([^\s\d\/]+)/g, (...args) => this.__vars[args[1]]);
        }

        // register macros
        if (line.startsWith("define ")) {
          if (this.isInAwaitBlock()) {
            throw new Error("You cannot use a macro in an await block.");
          }
          await this._translateLine(line);
          continue;
        }

        // await block
        if (line.startsWith("await-")) {
          await this._translateLine(line);
        }

        // end await block or macro
        if (line === "end") {
          // macro
          if (!this.isInAwaitBlock()) {
            await this._translateLine(line);
            continue;
          }
          // await block
          await this._translateLine(line);
        }

        // add code to macro
        if (this.isInMacroDefinition()) {
          let name = this.getCurrentMacroName();
          this.getMacroDefinition(name).push(line);
          continue;
        }
        lines.push(line);
      }
      // remove variable registration if they have been expanded
      if (expandVariables) {
        this.__vars = {};
      }
      return lines;
    },

    /**
     * Returns the lines for the macro of the given name, with the given arguments
     * replaced (1st arg -> $1, 2nd arg -> $2, etc.). If it doesn't exist,
     * return undefined.
     * @param macro_name {String} The name of the macro
     * @param args {Array} An array of arguments to be replaced in the macro code
     * @return {Array|undefined}
     * @private
     */
    _getMacro(macro_name, args) {
      if (!this.macroExists(macro_name)) {
        return undefined;
      }
      let macro_lines = this.getMacroDefinition(macro_name);
      // argument placeholders
      for (let i = 0; i < args.length; i++) {
        macro_lines = macro_lines.map(l => l.replace(new RegExp("\\$" + (i + 1), "g"), JSON.stringify(args[i])));
      }
      return macro_lines;
    },


    /**
     * Returns an array of lines containing variable declarations
     * @return {string[]}
     * @private
     */
    _defineVariables() {
      return Object.getOwnPropertyNames(this.__vars)
        .map(key => `const ${key} ="${this.__vars[key]}";`);
    },

    /**
     * Translates variables in a line
     * @param line {String}
     * @private
     * @return {String}
     * @ignore(args)
     */
    _translateVariables(line) {
      if (line.match(/\$([^\s\d\/]+)/)) {
        line = line.replace(/\$([^\s\d\/]+)/g, (...args) => {
          let var_name = args[1];
          let var_content = this.__vars[var_name];
          if (var_content === undefined) {
            throw new Error(`Variable '${var_name}' has not been defined.`);
          }
          return var_content;
        });
      }
      return line;
    },

    /**
     * Returns the code of utility functions needed for the command implementations.
     * @param script {String} Optional script code to be searched for the function name.
     * If given, omit function if not present in the script code
     * @return {string[]}
     * @private
     * @ignore(fn)
     */
    _generateUtilityFunctionsCode(script) {
      return Object.entries(this.self(arguments).utilityFunctions)
        .filter(([name]) => script ? script.match(new RegExp(name)) : true)
        .map(([name, fn]) => fn.toString()
          .replace(/function \(/, `function ${name}(`)
          // remove comments, see https://stackoverflow.com/questions/5989315/regex-for-match-replacing-javascript-comments-both-multiline-and-inline
          .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1")
          .split(/\n/)
          .map(line => line.trim())
          .filter(line => Boolean(line))
          .join("")
        );
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

        // ignore comments
        if (line.startsWith("#")) {
          continue;
        }

        // variables
        line = this._translateVariables(line);

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

        // translate
        let code = await this._translateLine(line);
        // skip empty lines
        if (!code) {
          continue;
        }
        this.debug(`${line}\n${"-".repeat(40)}\n${code}`);
        // execute
        let result = window.eval(code);
        if (result instanceof Promise) {
          try {
            await result;
          } catch (e) {
            throw e;
          }
        }
      }
      return true;
    },

    /**
     * Replays the given script of intermediate code
     * @param scriptOrLines {String|Array}
     *    The script to replay. If String, assume an unhandled script. If Array,
     *    assume that script has already been handled by {@link #_handleMeta) and
     *    split into lines.
     * @return {Promise} Promise which resolves when the script has been replayed, or
     * rejects with an error
     * @todo implement pausing
     */
    async replay(scriptOrLines) {
      this.setRunning(true);
      let lines = Array.isArray(scriptOrLines) ? scriptOrLines : await this._handleMeta(scriptOrLines);
      let steps = 0;
      let await_block= false;
      for (let line of lines) {
        if (line.startsWith("await-")) {
          await_block = true;
          continue;
        }
        if (line.startsWith("end")) {
          await_block = false;
          continue;
        }
        if (!await_block && !line.startsWith("wait ") && !line.startsWith("#") && !line.startsWith("delay")) {
          steps++;
        }
      }

      // replay it!
      try {
        await this._play(lines, steps, 0);
      } catch (e) {
        switch (this.getMode()) {
          case "test":
            throw e;
          case "presentation":
            this.warn(e);
            dialog.Dialog.error(e.message);
        }
      }
      this.setRunning(false);
      qx.event.Timer.once(() => this.cmd_hide_info(), null, 100);
    },

    /**
     * Translates the intermediate code into the target language
     * @param scriptOrLines {String|Array}
     *    The script to translate.
     *    If String, assume an unhandled script. If Array. assume that script
     *    has already been handled by {@link #_handleMeta) and split into lines
     * @return {string} executable code
     */
    async translate(scriptOrLines) {
      return this._translate(scriptOrLines);
    },

    /**
     * Implementation for #translate(). Returns the translated lines.
     * @param scriptOrLines {String|Array}
     *    If String, assume an unhandled script. If Array. assume that script
     *    has already been handled by {@link #_handleMeta) and split into lines
     * @return {string}
     * @private
     */
    async _translate(scriptOrLines) {
      let lines = Array.isArray(scriptOrLines) ? scriptOrLines : await this._handleMeta(scriptOrLines);
      let translatedLines = this._defineVariables();
      for (let line of lines) {
        line = line.trim();
        let [command, ...args] = this._tokenize(line);
        let macro_lines = this._getMacro(command, args);
        let new_lines = [];
        for (let l of (macro_lines || [line])) {
          new_lines.push(await this._translateLine(l));
        }
        translatedLines = translatedLines.concat(new_lines.filter(l => Boolean(l)));
      }
      let translation = translatedLines.join("\n");
      return this._generateUtilityFunctionsCode(translation)
        .concat(translatedLines)
        .join("\n");
    },

    /**
     * Given an async piece of code which checks for a condition or an application state,
     * return code that checks for this condition, throwing an error if the
     * condition hasn't been fulfilled within the set timeout.
     * @param condition {String} The condition expression as a string
     * @param timeoutmsg {String|undefined} An optional message to be shown if the condition hasn't been met before the timeout.
     */
    generateWaitForConditionCode(condition, timeoutmsg) {
      qx.core.Assert.assertString(condition);
      timeoutmsg = timeoutmsg || `Timeout waiting for condition '${condition}' to fulfil."`;
      return `(waitForCondition(() => ${condition}, ${this.getInterval()}, ${this.getTimeout()}, "${timeoutmsg}"))`;
    },

    /**
     * Generates code that returns a promise which will resolve (with any potential event data) if the given object fires
     * an event with the given type and data (if applicable) and will reject if the timeout is reached before that happens.
     * @param id {String} The id of the object to monitor
     * @param type {String} The type of the event to wait for
     * @param data {*|undefined} The data to expect. Must be serializable to JSON. Exception: if the data is a string that
     * starts with "{verbatim}", the unquoted string is used
     * @param timeoutmsg {String|undefined} An optional message to be shown if the event hasn't been fired before the timeout.
     * @return {String}
     */
    generateWaitForEventCode(id, type, data, timeoutmsg) {
      qx.core.Assert.assertString(id);
      qx.core.Assert.assertString(type);
      if (qx.lang.Type.isString(data) && data.startsWith("{verbatim}")) {
        data = data.substr(10);
      } else {
        data = JSON.stringify(data);
      }
      if (!timeoutmsg) {
        timeoutmsg=`Timeout waiting for event '${type}' on '${id}'`;
      }

      return `(waitForEvent("${id}", "${type}",${data}, ${this.getTimeout()}, "${timeoutmsg}"))`;
    },

    /**
     * Generates code that returns a promise which will resolve (with any
     * potential event data) if the given object fires an event with the given
     * type and data (if applicable). After the timeout, it will execute the
     * given code and restart the timeout.
     *
     * @param id {String} The id of the object to monitor
     * @param type {String} The type of the event to wait for
     * @param data {*|null} The data to expect. Must be serializable to JSON. In case
     * of events that do not have data, you MUST explicitly pass 'undefined' as
     * argument if you use the following arguments
     * @param code {String} The code to execute after the timeout
     * @return {String}
     */
    generateWaitForEventTimoutFunction(id, type, data, code) {
      qx.core.Assert.assertString(id);
      qx.core.Assert.assertString(type);
      return `(new Promise(async (resolve, reject) => { 
        while (true){
          try {
            await waitForEvent(qx.core.Id.getQxObject("${id}"), "${type}", ${data===undefined?"undefined":JSON.stringify(data)}, ${this.getTimeout()});
            return resolve(); 
          } catch (e) {
            console.debug(e.message);
            ${code};
          }
        }
      }))`.split(/\n/).map(l => l.trim()).join("");
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
     * Escapes all characters in a string that are special characters in a regular expression
     * @param s {String} The string to escape
     * @return {String}
     */
    escapeRegexpChars(s) {
      return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    },

    /**
     * Creates a regular expression that matches a json string. In this string, you can use a regular expression
     * enclosed by "<!" and "!>" to replace data that cannot be known in advance, such as tokens or session ids.
     * Example: '{token:"<![A-Za-z0-9]{32}!>",user:"admin">' will match '{"token":"OnBHqQd59VHZYcphVADPhX74q0Sc6ERR","user":"admin"}'
     * @param s {string}
     */
    createRegexpForJsonComparison(s) {
      let searchExp = /<![^<][^!]+!>/g;
      let foundRegExps = s.match(searchExp);
      if (foundRegExps && foundRegExps.length) {
        let index=0;
        // remove escape sequence
        foundRegExps = foundRegExps.map(m => m.slice(2, -2));
        // replace placeholders
        return this.escapeRegexpChars(s).replace(searchExp, () => foundRegExps[index++]);
      }
      return this.escapeRegexpChars(s);
    },

    /**
     * Adds promise code to a list of promises that need to resolve before the
     * script proceeds
     * @param promiseCode
     */
    _addPromiseToAwaitStack(promiseCode) {
      if (!qx.lang.Type.isArray(this.__promises)) {
        throw new Error("Cannot add promise since no await block has been opened.");
      }
      this.__promises.push(promiseCode);
    },

    /**
     * Returns the file extension of the downloaded file in the target language
     * @return {string}
     */
    getExportFileExtension() {
      throw new Error("Method getExportFileExtension must be impemented in subclass");
    },

    /**
     * Whether the player is in an await block
     * @return {Boolean}
     */
    isInAwaitBlock() {
      return qx.lang.Type.isArray(this.__promises);
    },

    /*
    ============================================================================
       COMMANDS
    ============================================================================
    */

    /**
     * Asserts that the current url matches the given value (RegExp)
     * @param uri {String}
     */
    cmd_assert_uri(uri) {
      return `qx.core.Assert.assertEquals(window.location.href, "${uri}", "Script is valid on '${uri}' only'")`;
    },

    /**
     * Asserts that the current url matches the given value (RegExp)
     * @param uri_regexp {String} A string containing a regular expression
     */
    cmd_assert_match_uri(uri_regexp) {
      if (this.getMode()==="presentation") {
        return `if(!window.location.href.match(new RegExp("${uri_regexp}"))){alert("The eventrecorder script is meant to be played on a website that matches '${uri_regexp}'.");window["${this._globalRef}"].stop();}`;
      }
      return `qx.core.Assert.assertMatch(window.location.href, "${uri_regexp}", "Current URL does not match '${uri_regexp}'")`;
    },

    /**
     * Sets the player mode
     * @param mode
     * @return {string}
     */
    cmd_config_set_mode(mode) {
      return `window["${this._globalRef}"].setMode("${mode}");`;
    },

    /**
     * Starts the definition of a macro
     * @param {String} macro_name
     * @param {String|undefined} macro_description
     * @return {null}
     */
    cmd_define(macro_name, macro_description) {
      if (this.macroExists(macro_name)) {
        throw new Error(`Cannot define macro '${macro_name}' since a macro of that name already exists.`);
      }
      this.addMacro(macro_name, macro_description);
      this.beginMacroDefintion(macro_name);
      return null;
    },

    /**
     * Ends the definition of a macro or a block of awaitable statements
     * @return {null}
     */
    cmd_end() {
      if (this.__promises) {
        let line = this.__promises.length ? `(Promise.all([${this.__promises.join(",")}]))` : null;
        this.__promises = null;
        return line;
      }
      if (this.__macro_stack_index < 0) {
        throw new Error(`Unexpected 'end'.`);
      }
      this.leaveMacroDefinition();
      return null;
    },

    /**
     * Starts a block of statements that return promises. The player will wait for
     * all of the promises to resolve before proceeding.
     */
    cmd_await_all() {
      this.__promises=[];
      return null;
    }
  }
});
