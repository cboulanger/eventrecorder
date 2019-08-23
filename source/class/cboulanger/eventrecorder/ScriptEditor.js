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
 * The Script Editor running in a separate browser window
 * @asset(cboulanger/eventrecorder/*)
 * @asset(dialog/*)
 * @ignore(ace)
 */
qx.Class.define("cboulanger.eventrecorder.ScriptEditor", {
  extend: qx.application.Standalone,
  /**
   * The recorded script
   */
  script: {
    check: "String",
    nullable: false,
    init: ""
  },

  controllerWindow: {
    check: "window"
  },

  members: {

    main() {
      this.base(arguments);

      if (qx.core.Environment.get("qx.debug")) {
        qx.log.appender.Native;
      }
      // establish communication with the window
      this.setControllerWindow(window.opener);

      const formUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml");
      qookery.contexts.Qookery.loadResource(formUrl, this, xmlSource => {
        let xmlDocument = qx.xml.Document.fromString(xmlSource);
        let parser = qookery.Qookery.createFormParser();
        let formComponent = parser.parseXmlDocument(xmlDocument);
        this.__setupForm(formComponent);
      });
      parser.dispose();
    },


    __setupForm(formComponent) {
      formComponent.setQxObjectId("form");
      this.addOwnedQxObject(formComponent);
      let editorWidget = formComponent.getMainWidget();
      this.add(editorWidget);
      formComponent.addOwnedQxObject(this);
      editorWidget.addListener("appear", this.__loadScript, this);
      this.bind("script", formComponent.getModel(), "leftEditorContent");
      let formModel = formComponent.getModel();
      formModel.bind("leftEditorContent", this, "script");
      formModel.addListener("changeTargetScriptType", this.__translate, this);
      formModel.addListener("changeTargetMode", this.__translate, this);
      qx.event.Timer.once(() => this.__setupAutocomplete(), this, 1000);

      // setup bindings between editor and player
      const setupBindings = player => {
        formModel.bind("targetMode", player, "mode");
        player.bind("mode", formModel, "targetMode");
        formModel.setTargetScriptType(player.getType());
      };
      setupBindings(this.getPlayer());
      this.addListener("changePlayer", e => setupBindings(e.getData()));
    },

    __loadScript() {
      formComponent.getModel().setLeftEditorContent(this.getScript())
    },

    __translate() {
      this.translateTo(formModel.getTargetScriptType(), formModel.getTargetMode())
    },


    /**
     * Configures the autocomplete feature in the editor(s)
     * @private
     */
    __setupAutocomplete() {
      const langTools = ace.require("ace/ext/language_tools");
      let tokens = [];
      let iface = qx.Interface.getByName("cboulanger.eventrecorder.IPlayer").$$members;
      for (let key of Object.getOwnPropertyNames(iface)) {
        if (key.startsWith("cmd_") && typeof iface[key] == "function") {
          let code = iface[key].toString();
          let params = code.slice(code.indexOf("(") + 1, code.indexOf(")")).split(/,/).map(p => p.trim());
          let caption = key.substr(4).replace(/_/g, "-");
          let snippet = caption + " " + params.map((p, i) => `\${${i + 1}:${p}}`).join(" ") + "\$0";
          let meta = params.join(" ");
          let value = null;
          tokens.push({caption, type: "command", snippet, meta, value});
        }
      }
      let ids = [];
      let traverseObjectTree = function (obj) {
        if (typeof obj.getQxObjectId !== "function") {
          return;
        }
        let id = obj.getQxObjectId();
        if (id) {
          ids.push(qx.core.Id.getAbsoluteIdOf(obj));
        }
        for (let owned of obj.getOwnedQxObjects()) {
          traverseObjectTree(owned);
        }
      };
      let registeredObjects = Object.values(qx.core.Id.getInstance().__registeredObjects); //FIXME
      for (let obj of registeredObjects) {
        traverseObjectTree(obj);
      }
      for (let id of ids) {
        tokens.push({caption: id, type: "id", value: id});
      }
      const player = this.getPlayer();
      const completer = {
        getCompletions: function (editor, session, pos, prefix, callback) {
          if (prefix.length === 0) {
            callback(null, []);
            return;
          }
          let line = editor.session.getLine(pos.row).substr(0, pos.column);
          let numberOfTokens = player._tokenize(line).length;
          let options = tokens
          // filter on positional argument
            .filter(token => (token.type === "command" && numberOfTokens === 1) || (token.type === "id" && numberOfTokens === 2))
            // filter on word match
            .filter(token => token.caption.toLocaleLowerCase().substr(0, prefix.length) === prefix.toLocaleLowerCase())
            // create popup data
            .map(token => {
              token.score = 100 - (token.caption.length - prefix.length);
              return token;
            });
          callback(null, options);
        }
      };
      langTools.addCompleter(completer);
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function () {
    if (!qx.core.Environment.get("module.objectid") || !qx.core.Environment.get("eventrecorder.enabled")) {
      return;
    }
    qookery.Qookery.setOption(qookery.Qookery.OPTION_EXTERNAL_LIBRARIES, qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/js"));
  }
});
