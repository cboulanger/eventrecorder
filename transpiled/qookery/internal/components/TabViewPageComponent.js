(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.ContainerComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.tabview.Page": {}
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
  qx.Class.define("qookery.internal.components.TabViewPageComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "show-close-button":
            return "Boolean";
        }

        return qookery.internal.components.TabViewPageComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createContainerWidget: function _createContainerWidget() {
        var page = new qx.ui.tabview.Page(this.getAttribute("label", null), this.getAttribute("icon", null));

        this._applyAttribute("show-close-button", page, "showCloseButton");

        this._applyWidgetAttributes(page);

        return page;
      }
    }
  });
  qookery.internal.components.TabViewPageComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=TabViewPageComponent.js.map?dt=1571643378671