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
      "qx.ui.basic.Image": {}
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
  qx.Class.define("qookery.internal.components.ImageComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "scale":
            return "Boolean";

          case "source":
            return "ReplaceableString";

          default:
            return qookery.internal.components.ImageComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      // Creation
      _createWidgets: function _createWidgets() {
        var image = new qx.ui.basic.Image(this.getAttribute("source", null));

        this._applyAttribute("scale", image, "scale");

        this._applyWidgetAttributes(image);

        return [image];
      },
      getSource: function getSource() {
        return this.getMainWidget().getSource();
      },
      setSource: function setSource(source) {
        this.getMainWidget().setSource(source);
      },
      getScale: function getScale() {
        return this.getMainWidget().getScale();
      },
      setScale: function setScale(scale) {
        this.getMainWidget().setScale(scale);
      }
    }
  });
  qookery.internal.components.ImageComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=ImageComponent.js.map?dt=1571643378335