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
      "qx.ui.form.TextField": {}
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
  qx.Class.define("qookery.internal.components.TextFieldComponent", {
    extend: qookery.internal.components.FieldComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.FieldComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createMainWidget: function _createMainWidget() {
        var widget = new qx.ui.form.TextField();

        this._setupTextField(widget);

        this._applyWidgetAttributes(widget);

        return widget;
      }
    }
  });
  qookery.internal.components.TextFieldComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=TextFieldComponent.js.map?dt=1571643378740