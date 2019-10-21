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
      "qx.ui.embed.Canvas": {}
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
  qx.Class.define("qookery.internal.components.CanvasComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "canvas-height":
            return "Size";

          case "canvas-width":
            return "Size";

          case "sync-dimension":
            return "Boolean";

          default:
            return qookery.internal.components.CanvasComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      // Lifecycle
      _createWidgets: function _createWidgets() {
        var canvas = new qx.ui.embed.Canvas(this.getAttribute("canvas-width", 300), this.getAttribute("canvas-height", 150));

        this._applyAttribute("sync-dimension", canvas, "syncDimension");

        this._applyWidgetAttributes(canvas);

        return [canvas];
      },
      // Methods
      getContext2d: function getContext2d() {
        return this.getMainWidget().getContext2d();
      },
      update: function update() {
        this.getMainWidget().update();
      }
    }
  });
  qookery.internal.components.CanvasComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=CanvasComponent.js.map?dt=1571643377857