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
 * This is a qooxdoo class
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
     * Returns the file extension of the downloaded file in the target language
     * @return {string}
     */
    getExportFileExtension() {
      return "js";
    }
  }
});
