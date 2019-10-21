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
      "qookery.IContainerComponent": {
        "require": true
      },
      "qx.util.StringSplit": {},
      "qx.ui.toolbar.ToolBar": {}
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
  qx.Class.define("qookery.internal.components.ToolBarComponent", {
    extend: qookery.internal.components.Component,
    implement: [qookery.IContainerComponent],
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
      this.__children = [];
      this.__flexes = [];
    },
    members: {
      __children: null,
      __toolbar: null,
      __flexes: null,
      create: function create(attributes) {
        qookery.internal.components.ToolBarComponent.prototype.create.base.call(this, attributes);
        this.__toolbar = this.getMainWidget();

        this._applyAttribute("column-flexes", this, function (flexes) {
          qx.util.StringSplit.split(flexes, /\s+/).forEach(function (columnFlex) {
            this.__flexes.push(parseInt(columnFlex, 10));
          }, this);
        });
      },
      _createWidgets: function _createWidgets() {
        var toolBar = new qx.ui.toolbar.ToolBar();

        this._applyAttribute("spacing", toolBar, "spacing");

        this._applyWidgetAttributes(toolBar);

        return [toolBar];
      },
      listChildren: function listChildren() {
        return this.__children;
      },
      add: function add(childComponent) {
        var index = this.__children.length;

        this.__children.push(childComponent);

        var part = childComponent.getMainWidget();
        var flex = this.__flexes[index];

        this.__toolbar.add(part, flex !== undefined ? {
          flex: flex
        } : null);
      },
      remove: function remove(component) {// TODO ToolBar: Implement removal of children
      },
      contains: function contains(component) {// TODO ToolBar: Implement contains()
      }
    }
  });
  qookery.internal.components.ToolBarComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=ToolBarComponent.js.map?dt=1571643378790