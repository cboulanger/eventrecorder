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
      "qookery.Qookery": {},
      "qookery.IRegistry": {},
      "qx.lang.Type": {},
      "qx.lang.Array": {},
      "qookery.util.ValidationError": {}
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

  /**
   * Base class for components that are containers of other components
   */
  qx.Class.define("qookery.internal.components.ContainerComponent", {
    type: "abstract",
    extend: qookery.internal.components.Component,
    implement: [qookery.IContainerComponent],
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
      this.__children = [];
    },
    members: {
      _containerWidget: null,
      __children: null,
      __layout: null,
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "layout":
            return "QName";
        }

        return qookery.internal.components.ContainerComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      create: function create(attributes) {
        qookery.internal.components.ContainerComponent.prototype.create.base.call(this, attributes);
        var layoutName = this.getAttribute("layout", "{http://www.qookery.org/ns/Form}grid");
        if (layoutName === "none") return;
        var layoutFactory = qookery.Qookery.getRegistry().get(qookery.IRegistry.P_LAYOUT_FACTORY, layoutName, true);
        var layout = this.__layout = layoutFactory.createLayout(this);
        this.getContainerWidget().setLayout(layout);
      },
      _createWidgets: function _createWidgets() {
        this._containerWidget = this._createContainerWidget();
        return [this._containerWidget];
      },
      _createContainerWidget: function _createContainerWidget() {
        throw new Error("Override _createContainerWidget() to provide implementation specific code");
      },
      getContainerWidget: function getContainerWidget() {
        return this._containerWidget;
      },
      listChildren: function listChildren() {
        return this.__children;
      },
      add: function add(component) {
        this._addChildComponent(component);

        var container = this.getContainerWidget();
        var layout = qx.lang.Type.isFunction(container["getLayout"]) ? container.getLayout() : null;
        var widgets = component.listWidgets();

        for (var i = 0; i < widgets.length; i++) {
          var widget = widgets[i];
          if (layout != null && qx.lang.Type.isFunction(layout.configureWidget)) layout.configureWidget(widget);
          container.add(widget);
        }
      },
      remove: function remove(component) {
        var container = this.getContainerWidget();
        var widgets = component.listWidgets();

        for (var i = 0; i < widgets.length; i++) container.remove(widgets[i]);

        this._removeChildComponent(component);
      },
      contains: function contains(component) {
        return qx.lang.Array.contains(this.__children, component);
      },
      validate: function validate() {
        if (!this.getEnabled() || this.getVisibility() !== "visible") return null;
        var errors = [];
        var children = this.listChildren();

        for (var i = 0; i < children.length; i++) {
          var child = children[i];
          var childError = child.validate();
          if (childError == null) continue;
          errors.push(childError);
        }

        if (errors.length === 0) return null;
        if (errors.length === 1) return errors[0];
        return new qookery.util.ValidationError(this, null, errors);
      },
      // Internals
      _addChildComponent: function _addChildComponent(component) {
        this.__children.push(component);
      },
      _removeChildComponent: function _removeChildComponent(component) {
        qx.lang.Array.remove(this.__children, component);
      }
    },
    destruct: function destruct() {
      this._disposeArray("__children");

      this._disposeObjects("__layout");
    }
  });
  qookery.internal.components.ContainerComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=ContainerComponent.js.map?dt=1571643378049