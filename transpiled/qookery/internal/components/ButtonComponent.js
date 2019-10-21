(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.AtomComponent": {
        "construct": true,
        "require": true
      },
      "qookery.Qookery": {},
      "qx.ui.form.Button": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /*
  	Qookery - Declarative UI Building for Qooxdoo
  
  	Copyright (c) Ergobyte Informatics S.A., www.ergobyte.gr
  
  	Licensed under the Apache License, Version 2.0 (the "License");
  	you may not use this file except in compliance with the License.
  	You may obtain a copy of the License at
  
  		http://www.apache.org/licenses/LICENSE-2.0
  
  	Unless required by applicable law or agreed to in writing, software
  	distributed under the License is distributed on an "AS IS" BASIS,
  	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  	See the License for the specific language governing permissions and
  	limitations under the License.
  */
  qx.Class.define("qookery.internal.components.ButtonComponent", {
    extend: qookery.internal.components.AtomComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AtomComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createAtomWidget: function _createAtomWidget() {
        var button = this._createButton();

        this._applyAttribute("command", this, function (commandName) {
          var command = qookery.Qookery.getRegistry().getCommand(commandName);
          if (command == null) throw new Error("Undefined command " + commandName);
          button.setCommand(command);
        });

        this._applyAtomAttributes(button);

        return button;
      },
      _createButton: function _createButton() {
        return new qx.ui.form.Button();
      },
      setValue: function setValue(buttonLabelValue) {
        // BCC Qookery: Method kept for compatibilty with former way of setting label
        this.getMainWidget().setLabel(buttonLabelValue);
      },
      getCommand: function getCommand() {
        return this.getMainWidget().getCommand();
      },
      setCommand: function setCommand(command) {
        this.getMainWidget().setCommand(command);
      },
      execute: function execute() {
        this.getMainWidget().execute();
      }
    }
  });
  qookery.internal.components.ButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=ButtonComponent.js.map?dt=1571643377845