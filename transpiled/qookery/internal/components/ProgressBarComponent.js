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
      "qx.ui.indicator.ProgressBar": {}
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
  qx.Class.define("qookery.internal.components.ProgressBarComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "maximum":
            return "Number";
        }

        return qookery.internal.components.ProgressBarComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Creation
      _createWidgets: function _createWidgets() {
        var progressBar = new qx.ui.indicator.ProgressBar();

        this._applyAttribute("maximum", progressBar, "maximum");

        this._applyWidgetAttributes(progressBar);

        return [progressBar];
      },
      // Public methods
      getMaximum: function getMaximum() {
        return this.getMainWidget().getMaximum();
      },
      setMaximum: function setMaximum(maximum) {
        this.getMainWidget().setMaximum(maximum);
      },
      getValue: function getValue() {
        return this.getMainWidget().getValue();
      },
      setValue: function setValue(value) {
        return this.getMainWidget().setValue(value);
      }
    }
  });
  qookery.internal.components.ProgressBarComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=ProgressBarComponent.js.map?dt=1571643378416