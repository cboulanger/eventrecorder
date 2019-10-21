(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.EditableComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.tree.VirtualTree": {},
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
  qx.Class.define("qookery.internal.components.VirtualTreeComponent", {
    extend: qookery.internal.components.EditableComponent,
    events: {
      "changeSelection": "qx.event.type.Data"
    },
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
    },
    members: {
      __delegate: null,
      _createMainWidget: function _createMainWidget() {
        var virtualTree = new qx.ui.tree.VirtualTree();

        this._applyAttribute("child-property", virtualTree, "childProperty");

        this._applyAttribute("hide-root", virtualTree, "hideRoot");

        this._applyAttribute("icon-property", virtualTree, "iconPath");

        this._applyAttribute("label-path", virtualTree, "labelPath");

        virtualTree.getSelection().addListener("change", function (e) {
          this.fireDataEvent("changeSelection", virtualTree.getSelection().getItem(0));
        }, this);
        return virtualTree;
      },
      setup: function setup() {
        if (this.__delegate !== null) this.getMainWidget().setDelegate(this.__delegate);
        qookery.internal.components.VirtualTreeComponent.prototype.setup.base.call(this);
      },
      parseXmlElement: function parseXmlElement(elementName, xmlElement) {
        switch (elementName) {
          case "{http://www.qookery.org/ns/Form}virtual-tree-delegate":
            var delegateClassName = qookery.util.Xml.getAttribute(xmlElement, "class", Error);
            var delegateClass = qx.Class.getByName(delegateClassName);
            this.__delegate = new delegateClass();
            return true;
        }

        return false;
      },
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "child-property":
            return "String";

          case "hide-root":
            return "Boolean";

          case "icon-property":
            return "String";

          case "label-path":
            return "String";

          default:
            return qookery.internal.components.VirtualTreeComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      setIconOptions: function setIconOptions(iconOptions) {
        this.getMainWidget().setIconOptions(iconOptions);
      },
      _updateUI: function _updateUI(value) {
        this.getMainWidget().setModel(this.getValue());
      }
    },
    destruct: function destruct() {
      this._disposeObjects("__delegate");
    }
  });
  qookery.internal.components.VirtualTreeComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=VirtualTreeComponent.js.map?dt=1571643378809