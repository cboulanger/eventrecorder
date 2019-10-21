(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.FieldComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.TextArea": {}
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
  qx.Class.define("qookery.internal.components.TextAreaComponent", {
    extend: qookery.internal.components.FieldComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.FieldComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "auto-size":
            return "Boolean";

          case "minimal-line-height":
            return "Integer";

          case "single-step":
            return "Integer";

          case "wrap":
            return "Boolean";
        }

        return qookery.internal.components.TextAreaComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createMainWidget: function _createMainWidget() {
        var widget = new qx.ui.form.TextArea();

        this._setupTextField(widget);

        this._applyWidgetAttributes(widget);

        this._applyAttribute("auto-size", widget, "autoSize");

        this._applyAttribute("minimal-line-height", widget, "minimalLineHeight");

        this._applyAttribute("single-step", widget, "singleStep");

        this._applyAttribute("wrap", widget, "wrap");

        return widget;
      }
    }
  });
  qookery.internal.components.TextAreaComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=TextAreaComponent.js.map?dt=1571643378732