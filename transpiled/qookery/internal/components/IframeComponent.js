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
      "qx.ui.embed.Iframe": {}
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
  qx.Class.define("qookery.internal.components.IframeComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      _createWidgets: function _createWidgets() {
        var source = this.getAttribute("source", "about:blank");
        var iframe = new qx.ui.embed.Iframe(source);

        this._applyWidgetAttributes(iframe);

        return [iframe];
      },
      setSource: function setSource(source) {
        this.getMainWidget().setSource(source);
      },
      getSource: function getSource() {
        return this.getMainWidget().getSource();
      },
      getDocument: function getDocument() {
        return this.getMainWidget().getDocument();
      },
      getWindow: function getWindow() {
        return this.getMainWidget().getWindow();
      }
    }
  });
  qookery.internal.components.IframeComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=IframeComponent.js.map?dt=1571643378325