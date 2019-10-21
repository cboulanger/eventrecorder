(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "require": true
      },
      "qookery.ILayoutFactory": {
        "require": true
      },
      "qx.ui.layout.Grow": {}
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
  qx.Class.define("qookery.internal.layouts.GrowLayoutFactory", {
    extend: qx.core.Object,
    implement: [qookery.ILayoutFactory],
    type: "singleton",
    members: {
      createLayout: function createLayout(attributes) {
        var layout = new qx.ui.layout.Grow();
        return layout;
      }
    }
  });
  qookery.internal.layouts.GrowLayoutFactory.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=GrowLayoutFactory.js.map?dt=1571643378912