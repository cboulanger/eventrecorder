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
 * A player that replays in the browser using qooxdoo code, and which can
 * export TestCafé code
 */
qx.Class.define("cboulanger.eventrecorder.player.Testcafe", {

  extend : cboulanger.eventrecorder.player.Qooxdoo,

  implement: [cboulanger.eventrecorder.IPlayer],

  properties: {
    /**
     * @inheritDoc
     */
    canExportExecutableCode: {
      refine: true,
      init: true
    }
  },

  members :
  {

    /**
     * overridden to disallow presentation mode
     * @param value
     * @param old
     * @private
     */
    _applyMode(value,old) {
      if (value === "presentation") {
        this.warn("Presentation mode is not supported, switching to test mode");
        this.setMode("test");
      }
    },

    /**
     * Returns the file extension of the downloaded file in the target language
     * @return {string}
     */
    getExportFileExtension() {
      return "js";
    },

    /**
     * Translates the intermediate code into the target language
     * @param script
     * @return {string} executable code
     */
    translate(script) {
      let lines = this._translate(script).split(/\n/);
      return [
        "fixture `<Test suite title>`",
        "  .page `" + window.location.href + "`;",
        "",
        "test('<Test description>', async t => {",
        ...lines.map(line => "  " + line),
        "});"
      ].join("\n");
    },

    /**
     * Translates a line of intermediate script code to testcafé code
     * @param line
     * @return {*|var}
     * @private
     */
    _translateLine(line) {
      let code = this.base(arguments, line);
      if (code && !code.startsWith("await t.") && !code.startsWith("//")) {
        code = code.endsWith(";") ?
          `await t.eval(()=>{${code}});`:
          `await t.eval(()=>${code});`;
      }
      return code;
    },

    /*
    ============================================================================
       COMMANDS
    ============================================================================
    */



    /**
     * Generates code that causes the given delay (in milliseconds).
     * The delay is capped by the {@link #cboulanger.eventrecorder.player.Abstract#maxDelay} property
     * and will only be caused in presentation mode
     * @param delayInMs {Number}
     * @return {string}
     */
    cmd_delay(delayInMs) {
      delayInMs = Math.min(delayInMs, this.getMaxDelay());
      return this.getMode() === "presentation" && delayInMs > 0 ? `await t.wait(${delayInMs});`: "";
    },

    /**
     * Generates code that waits the given time in milliseconds, regardless of player mode
     * @param timeInMs {Number}
     * @return {string}
     */
    cmd_wait(timeInMs) {
      return `await t.wait(${timeInMs});`;
    }
  }
});
