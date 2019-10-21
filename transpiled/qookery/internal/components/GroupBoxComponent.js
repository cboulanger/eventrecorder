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
      "qx.ui.groupbox.GroupBox": {}
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
  qx.Class.define("qookery.internal.components.GroupBoxComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "content-padding":
            return "IntegerList";

          case "content-padding-bottom":
            return "Integer";

          case "content-padding-left":
            return "Integer";

          case "content-padding-right":
            return "Integer";

          case "content-padding-top":
            return "Integer";
        }

        return qookery.internal.components.GroupBoxComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createContainerWidget: function _createContainerWidget() {
        var groupBox = new qx.ui.groupbox.GroupBox(this.getAttribute("label"), this.getAttribute("icon"));

        this._applyAttribute("legend-position", groupBox, "legendPosition", "middle");

        this._applyAttribute("content-padding", groupBox, "contentPadding");

        this._applyAttribute("content-padding-top", groupBox, "contentPaddingTop");

        this._applyAttribute("content-padding-right", groupBox, "contentPaddingRight");

        this._applyAttribute("content-padding-bottom", groupBox, "contentPaddingBottom");

        this._applyAttribute("content-padding-left", groupBox, "contentPaddingLeft");

        var label = groupBox.getChildControl("legend").getChildControl("label");
        label.setAllowGrowX(true);
        label.setTextAlign(this.getAttribute("text-align", "left"));

        this._applyWidgetAttributes(groupBox);

        return groupBox;
      },
      getLegend: function getLegend() {
        return this.getMainWidget().getLegend();
      },
      setLegend: function setLegend(legend) {
        this.getMainWidget().setLegend(legend);
      }
    }
  });
  qookery.internal.components.GroupBoxComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=GroupBoxComponent.js.map?dt=1571643378287