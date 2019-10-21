(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.AbstractSelectBoxComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.ComboBox": {}
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
  qx.Class.define("qookery.internal.components.ComboBoxComponent", {
    extend: qookery.internal.components.AbstractSelectBoxComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AbstractSelectBoxComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "placeholder":
            return "ReplaceableString";

          case "text-align":
            return "String";
        }

        return qookery.internal.components.ComboBoxComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createMainWidget: function _createMainWidget() {
        var comboBox = new qx.ui.form.ComboBox();

        this._applySelectBoxAttributes(comboBox);

        this._applyAttribute("placeholder", comboBox, "placeholder");

        var textField = comboBox.getChildControl("textfield");
        textField.addListener("changeValue", function (event) {
          if (this._disableValueEvents) return;
          var text = event.getData();
          if (text != null && text.trim().length === 0) text = null;
          var format = this.getFormat();
          var value = format != null ? format.parse(text) : text;
          this.getEditableWidget().setValue(this._getLabelOf(value));

          this._setValueSilently(value);
        }, this);

        this._applyAttribute("text-align", textField, "textAlign");

        return comboBox;
      },
      // Behavior
      _updateUI: function _updateUI(value) {
        this.getEditableWidget().setValue(this._getLabelOf(value));
      }
    }
  });
  qookery.internal.components.ComboBoxComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=ComboBoxComponent.js.map?dt=1571643377901