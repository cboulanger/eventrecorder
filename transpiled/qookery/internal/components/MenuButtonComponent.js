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
      "qx.ui.form.MenuButton": {}
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
  qx.Class.define("qookery.internal.components.MenuButtonComponent", {
    extend: qookery.internal.components.ButtonComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ButtonComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Creation
      _createButton: function _createButton() {
        return new qx.ui.form.MenuButton();
      }
    }
  });
  qookery.internal.components.MenuButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=MenuButtonComponent.js.map?dt=1571643378396