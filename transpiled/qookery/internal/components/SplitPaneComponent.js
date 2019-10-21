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
      "qx.ui.splitpane.Pane": {}
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
  qx.Class.define("qookery.internal.components.SplitPaneComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "flexes":
            return "IntegerList";
        }

        return qookery.internal.components.SplitPaneComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Creation
      _createContainerWidget: function _createContainerWidget() {
        var orientation = this.getAttribute("orientation", "horizontal");
        var pane = new qx.ui.splitpane.Pane(orientation);

        this._applyWidgetAttributes(pane);

        return pane;
      },
      getAttribute: function getAttribute(attributeName, defaultValue) {
        if (attributeName === "layout") return "none";
        return qookery.internal.components.SplitPaneComponent.prototype.getAttribute.base.call(this, attributeName, defaultValue);
      },
      add: function add(childComponent) {
        this._addChildComponent(childComponent);

        var flexes = this.getAttribute("flexes");
        var flex = flexes ? flexes[this.listChildren().length - 1] : 0;
        this.getMainWidget().add(childComponent.getMainWidget(), flex);
      }
    }
  });
  qookery.internal.components.SplitPaneComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=SplitPaneComponent.js.map?dt=1571643378632