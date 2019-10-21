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
      "qx.ui.container.Stack": {}
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
  qx.Class.define("qookery.internal.components.StackComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    properties: {
      dynamic: {
        check: "Boolean",
        nullable: false,
        apply: "_applyDynamic"
      }
    },
    members: {
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "dynamic":
            return "Boolean";

          default:
            return qookery.internal.components.StackComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      create: function create(attributes) {
        qookery.internal.components.StackComponent.prototype.create.base.call(this, attributes);

        this._applyAttribute("dynamic", this, "dynamic");
      },
      _createContainerWidget: function _createContainerWidget() {
        var stack = new qx.ui.container.Stack();

        this._applyWidgetAttributes(stack);

        return stack;
      },
      getAttribute: function getAttribute(attributeName, defaultValue) {
        if (attributeName === "layout") return "none";
        return qookery.internal.components.StackComponent.prototype.getAttribute.base.call(this, attributeName, defaultValue);
      },
      setSelection: function setSelection(component) {
        var container = this.getMainWidget();
        var widget = component.getMainWidget();
        if (!container || !widget) return;
        container.setSelection([widget]);
      },
      getSelection: function getSelection() {
        var container = this.getMainWidget();
        if (!container) return null;
        var selection = container.getSelection();
        if (!selection || selection.length === 0) return null;
        return selection[0].getUserData("qookeryComponent");
      },
      selectNext: function selectNext() {
        var container = this.getMainWidget();
        var index = 0;
        var children = container.getChildren();
        var selection = container.getSelection();

        if (selection && selection.length === 1) {
          index = children.indexOf(selection[0]) + 1;
          if (index >= children.length) index = 0;
        }

        container.setSelection([children[index]]);
      },
      _applyDynamic: function _applyDynamic(dynamic) {
        var container = this.getMainWidget();
        if (!container) return null;
        container.setDynamic(dynamic);
      }
    }
  });
  qookery.internal.components.StackComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=StackComponent.js.map?dt=1571643378646