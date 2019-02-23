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
    __exportingToTestCafe : false,

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
      let lines = script.split(/\n/).map(line => this._translateLineToTestCafe(line));
      return [
        "fixture `<Test suite title>`",
        "  .page `" + window.location.href + "`;",
        "",
        "test('<Test description>', async t => {",
        "  await t",
        ...lines.map(line => " ".repeat(4) + line),
        "});"
      ].filter(line => Boolean(line.trim())).join("\n");
    },

    /**
     * Translates a line of intermediate script code to testcafé code
     * @param line
     * @return {*|var}
     * @private
     */
    _translateLineToTestCafe(line) {
      let code = this._translateLine(line);
      if (!code.startsWith(".")) {
        code = `.eval("${code.replace(/"/g, "\\\"")})"`;
      }
      return code;
    },

    /**
     * Generates code that causes the given delay (in milliseconds).
     * The delay is capped by the {@link #cboulanger.eventrecorder.player.Abstract#maxDelay} property
     * and will only be caused in presentation mode
     * @param delayInMs {Number}
     * @return {string}
     */
    cmd_delay(delayInMs) {
      delayInMs = Math.min(delayInMs, this.getMaxDelay());
      return this.getMode() === "presentation" && delayInMs > 0 ? `.wait(${delayInMs})`: "";
    },

    /**
     * Generates code that waits the given time in milliseconds, regardless of player mode
     * @param timeInMs {Number}
     * @return {string}
     */
    cmd_wait(timeInMs) {
      return `.wait(${timeInMs})`;
    }
  }
});
