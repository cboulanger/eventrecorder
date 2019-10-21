(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.Component": {
        "construct": true,
        "require": true
      },
      "qx.ui.core.Spacer": {}
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
  qx.Class.define("qookery.internal.components.SpacerComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      _createWidgets: function _createWidgets() {
        var spacer = new qx.ui.core.Spacer();

        this._applyWidgetAttributes(spacer);

        return [spacer];
      },
      _applyEnabled: function _applyEnabled(enabled) {// Not supported
      }
    }
  });
  qookery.internal.components.SpacerComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=SpacerComponent.js.map?dt=1571643378548