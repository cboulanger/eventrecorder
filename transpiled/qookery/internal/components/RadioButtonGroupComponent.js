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
      "qookery.IContainerComponent": {
        "require": true
      },
      "qookery.Qookery": {},
      "qookery.IRegistry": {},
      "qx.ui.form.RadioButtonGroup": {},
      "qx.data.Array": {},
      "qx.lang.Type": {},
      "qx.ui.form.IRadioItem": {},
      "qx.ui.form.RadioButton": {}
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
  qx.Class.define("qookery.internal.components.RadioButtonGroupComponent", {
    extend: qookery.internal.components.EditableComponent,
    implement: [qookery.IContainerComponent],
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
      this.__children = [];
    },
    members: {
      __children: null,
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "allow-empty-selection":
            return "Boolean";

          case "layout":
            return "QName";

          default:
            return qookery.internal.components.RadioButtonGroupComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      // Creation
      _createMainWidget: function _createMainWidget() {
        var layoutName = this.getAttribute("layout", "{http://www.qookery.org/ns/Form}h-box");
        var layoutFactory = qookery.Qookery.getRegistry().get(qookery.IRegistry.P_LAYOUT_FACTORY, layoutName, true);
        var layout = layoutFactory.createLayout(this);
        var radioButtonGroup = new qx.ui.form.RadioButtonGroup(layout);
        radioButtonGroup.getRadioGroup().setAllowEmptySelection(this.getAttribute("allow-empty-selection", false));
        radioButtonGroup.addListener("changeSelection", function (event) {
          if (this._disableValueEvents) return;
          var selection = event.getData();
          var model = selection.length !== 1 ? null : selection[0].getModel();
          this.setValue(model);
        }, this);

        this._applyWidgetAttributes(radioButtonGroup);

        return radioButtonGroup;
      },
      // Public methods
      setItems: function setItems(items) {
        this.__removeAllGroupItems();

        if (items == null) return;

        if (items instanceof qx.data.Array) {
          items = items.toArray();
        }

        if (qx.lang.Type.isArray(items)) {
          items.map(function (model) {
            var label = this._getLabelOf(model);

            this.__addGroupItem(model, label);
          }, this);
        } else if (qx.lang.Type.isObject(items)) {
          for (var model in items) {
            var label = items[model];

            this.__addGroupItem(model, label);
          }
        } else throw new Error("Items are of unsupported type");
      },
      setSelection: function setSelection(itemNumber) {
        var selectablesItems = this.getMainWidget().getSelectables(true);
        if (selectablesItems.length === 0) return;
        this.getMainWidget().setSelection([selectablesItems[itemNumber]]);
      },
      // IContainerComponent implementation
      add: function add(childComponent) {
        var radioButton = childComponent.getMainWidget();
        if (!qx.Class.hasInterface(radioButton.constructor, qx.ui.form.IRadioItem)) throw new Error("<radio-button-group> supports only components with main widgets implementing IRadioItem");
        this.getMainWidget().add(radioButton);

        this.__children.push(childComponent);
      },
      listChildren: function listChildren() {
        return this.__children;
      },
      remove: function remove(component) {// TODO RadioButtonGroup: Implement removal of children
      },
      contains: function contains(component) {// TODO RadioButtonGroup: Implement contains()
      },
      // Internals
      _updateUI: function _updateUI(value) {
        if (value == null) {
          this.getMainWidget().resetSelection();
          return;
        }

        var radioButtonGroup = this.getMainWidget();
        var selectionFound = false;
        var buttons = radioButtonGroup.getChildren();
        var modelProvider = this.getForm().getModelProvider();

        for (var i = 0; i < buttons.length; i++) {
          var button = buttons[i];
          var model = button.getModel();

          if (!modelProvider.areEqual(model, value)) {
            button.setFocusable(false);
          } else {
            button.setFocusable(true);
            radioButtonGroup.setSelection([button]);
            selectionFound = true;
          }
        }

        if (selectionFound != null) return;
        radioButtonGroup.resetSelection();
        if (buttons.length > 0) buttons[0].setFocusable(true);
      },
      __addGroupItem: function __addGroupItem(model, label) {
        var groupItem = new qx.ui.form.RadioButton(label);
        groupItem.setModel(model);
        groupItem.setFocusable(false);
        var tabIndex = this.getAttribute("tab-index");
        if (tabIndex != null) groupItem.setTabIndex(tabIndex);
        this.getMainWidget().add(groupItem);
      },
      __removeAllGroupItems: function __removeAllGroupItems() {
        this.getMainWidget().removeAll().forEach(function (widget) {
          widget.dispose();
        });
      }
    },
    destruct: function destruct() {
      this._disposeArray("__children");
    }
  });
  qookery.internal.components.RadioButtonGroupComponent.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=RadioButtonGroupComponent.js.map?dt=1571643378462