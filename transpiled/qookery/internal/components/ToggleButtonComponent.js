(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "defer": "runtime",
        "require": true
      },
      "qookery.internal.components.AtomComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.ToggleButton": {
        "defer": "runtime"
      },
      "qookery.util.Xml": {},
      "qx.ui.form.MModelProperty": {
        "defer": "runtime"
      },
      "qx.ui.form.MForm": {
        "defer": "runtime"
      }
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
  qx.Class.define("qookery.internal.components.ToggleButtonComponent", {
    extend: qookery.internal.components.AtomComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AtomComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "tri-state":
            return "Boolean";
        }

        return qookery.internal.components.ToggleButtonComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Creation
      _createAtomWidget: function _createAtomWidget() {
        var toggleButton = new qx.ui.form.ToggleButton();

        this._applyAtomAttributes(toggleButton);

        this._applyAttribute("tri-state", toggleButton, "triState");

        return toggleButton;
      },
      setup: function setup() {
        var model = this.getAttribute("model");

        if (model != null) {
          var type = this.getAttribute("model-type", "String");
          this.setModel(qookery.util.Xml.parseValue(this, type, model));
        }

        return qookery.internal.components.ToggleButtonComponent.prototype.setup.base.call(this);
      },
      getModel: function getModel() {
        return this.getMainWidget().getModel();
      },
      setModel: function setModel(model) {
        this.getMainWidget().setModel(model);
      },
      getValue: function getValue() {
        return this.getMainWidget().getValue();
      },
      setValue: function setValue(value) {
        this.getMainWidget().setValue(value);
      }
    },
    defer: function defer() {
      // TODO Patching a QX class goes against the "thin wrapper" spirit of Qookery- consider future removal
      qx.Class.patch(qx.ui.form.ToggleButton, qx.ui.form.MModelProperty);
      qx.Class.patch(qx.ui.form.ToggleButton, qx.ui.form.MForm);
    }
  });
  qookery.internal.components.ToggleButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=ToggleButtonComponent.js.map?dt=1571643378761