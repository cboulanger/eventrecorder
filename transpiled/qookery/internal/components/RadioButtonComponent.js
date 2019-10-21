(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.ButtonComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.RadioButton": {},
      "qookery.util.Xml": {}
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
  qx.Class.define("qookery.internal.components.RadioButtonComponent", {
    extend: qookery.internal.components.ButtonComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ButtonComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createAtomWidget: function _createAtomWidget() {
        var radioButton = new qx.ui.form.RadioButton();

        this._applyAtomAttributes(radioButton);

        return radioButton;
      },
      setup: function setup() {
        var model = this.getAttribute("model");

        if (model != null) {
          var type = this.getAttribute("model-type", "String");
          this.setModel(qookery.util.Xml.parseValue(this, type, model));
        }

        return qookery.internal.components.RadioButtonComponent.prototype.setup.base.call(this);
      },
      getModel: function getModel() {
        return this.getMainWidget().getModel();
      },
      setModel: function setModel(model) {
        this.getMainWidget().setModel(model);
      }
    }
  });
  qookery.internal.components.RadioButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=RadioButtonComponent.js.map?dt=1571643378426