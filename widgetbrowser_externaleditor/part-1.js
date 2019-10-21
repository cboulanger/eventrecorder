(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Mixin": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.contexts.Qookery": {},
      "qx.xml.Document": {},
      "qookery.Qookery": {},
      "qx.lang.String": {},
      "qx.util.Uri": {},
      "qx.io.request.Jsonp": {},
      "qx.lang.Type": {},
      "qx.event.Manager": {},
      "qx.core.Id": {},
      "qx.ui.core.Widget": {},
      "qx.core.Assert": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2018 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  
  ************************************************************************ */

  /**
   * An unsystematic collection of methods that are re-used in more than one class
   * The methods really need to be put into domain-specific mixins or static classes
   */
  qx.Mixin.define("cboulanger.eventrecorder.MHelperMethods", {
    members: {
      async createQookeryComponent(formUrl) {
        return new Promise((resolve, reject) => {
          qookery.contexts.Qookery.loadResource(formUrl, this, xmlSource => {
            const xmlDocument = qx.xml.Document.fromString(xmlSource);
            const parser = qookery.Qookery.createFormParser();

            try {
              const formComponent = parser.parseXmlDocument(xmlDocument);
              resolve(formComponent);
            } catch (e) {
              reject(e);
            } finally {
              parser.dispose();
            }
          });
        });
      },

      /**
       * Returns a player instance. Caches the result
       * @param type
       * @private
       * @return {cboulanger.eventrecorder.IPlayer}
       */
      getPlayerByType(type) {
        if (!type) {
          throw new Error("No player type given!");
        }

        if (!this.__players) {
          this.__players = [];
        }

        if (this.__players[type]) {
          return this.__players[type];
        }

        let Clazz = cboulanger.eventrecorder.player[qx.lang.String.firstUp(type)];

        if (!Clazz) {
          throw new Error("A player of type '".concat(type, "' does not exist."));
        }

        const player = new Clazz();
        this.__players[type] = player;
        return player;
      },

      getApplicationParentDir() {
        let uri = qx.util.Uri.parseUri(location.href);
        return "".concat(uri.protocol, "://").concat(uri.authority).concat(uri.directory.split("/").slice(0, -2).join("/"));
      },

      /**
       * Get the content of a gist by its id
       * @param gist_id {String}
       * @return {Promise<*>}
       * @private
       */
      async getRawGist(gist_id) {
        return new Promise((resolve, reject) => {
          let url = "https://api.github.com/gists/".concat(gist_id);
          let req = new qx.io.request.Jsonp(url);
          req.addListener("success", e => {
            let response = req.getResponse();

            if (!qx.lang.Type.isObject(response.data.files)) {
              reject(new Error("Unexpected response: " + JSON.stringify(response)));
            }

            let filenames = Object.getOwnPropertyNames(response.data.files);
            let file = response.data.files[filenames[0]];

            if (!file.filename.endsWith(".eventrecorder")) {
              reject(new Error("Gist is not an eventrecorder script"));
            }

            let script = file.content;
            resolve(script);
          });
          req.addListener("statusError", e => reject(new Error(e.getData())));
          req.send();
        });
      },

      /**
       * Add a function to the global event monitor.
       * @param fn {Function}
       */
      addGlobalEventListener(fn) {
        let evtMonitor = qx.event.Manager.getGlobalEventMonitor();
        qx.event.Manager.setGlobalEventMonitor(evtMonitor ? (target, event) => {
          evtMonitor(target, event);
          fn(target, event);
        } : fn);
      },

      /**
       * Returns the absolute id of the owned object with that id
       * @param domNode {Element}
       * @param id {String}
       * @returns {String}
       */
      absoluteIdOf: function absoluteIdOf(domNode, id) {
        return qx.core.Id.getAbsoluteIdOf(qx.ui.core.Widget.getWidgetByElement(domNode).getQxObject(id));
      },

      /**
       * Simple tokenizer which splits expressions separated by whitespace, but keeps
       * expressions in quotes (which can contain whitespace) together. Parses tokens
       * as JSON expressions, but accepts unquoted text as strings.
       * @param line {String}
       * @return {String[]}
       * @private
       */
      tokenize(line) {
        qx.core.Assert.assertString(line);
        let tokens = [];
        let token = "";
        let prevChar = "";
        let insideQuotes = false;

        for (let char of line.trim().split("")) {
          switch (char) {
            case "\"":
              insideQuotes = !insideQuotes;
              token += char;
              break;

            case " ":
              // add whitespace to token if inside quotes
              if (insideQuotes) {
                token += char;
                break;
              } // when outside quotes, whitespace is end of token


              if (prevChar !== " ") {
                // parse token as json expression or as a string if that fails
                try {
                  token = JSON.parse(token);
                } catch (e) {}

                tokens.push(token);
                token = "";
              }

              break;

            default:
              token += char;
          }

          prevChar = char;
        }

        if (token.length) {
          try {
            token = JSON.parse(token);
          } catch (e) {}

          tokens.push(token);
        }

        return tokens;
      }

    }
  });
  cboulanger.eventrecorder.MHelperMethods.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "cboulanger.eventrecorder.MHelperMethods": {
        "require": true
      },
      "qx.event.Timer": {},
      "qx.core.Init": {},
      "qx.core.Id": {},
      "qx.ui.tooltip.ToolTip": {},
      "qx.event.Registration": {},
      "qx.bom.Lifecycle": {
        "defer": "runtime"
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /**
   * When added to the `applications[x].include` section of `compile.json`,
   * this class will automatically assign ids to all the widgets in the
   * widget hierarchy, i.e. all objects that are added as child object via
   * the `add()` method provided my `qx.ui.core.MChildrenHandling`. The id
   * generator assigns ids to all widgets that do not already have an id
   * using the last part of the class namespace plus the integer hash code of
   * the widget. This will result in absolute ids of the form
   * `Composite50/Scroll117/TabView120/TabPage147`
   */
  qx.Class.define("cboulanger.eventrecorder.ObjectIdGenerator", {
    type: "singleton",
    extend: qx.core.Object,
    include: [cboulanger.eventrecorder.MHelperMethods],
    statics: {
      DEFAULT_LISTENED_EVENTS: ["tap", "dbltap", "contextmenu"]
    },
    events: {
      "done": "qx.event.type.Event"
    },
    members: {
      /**
       * Start automatically assigning ids.
       */
      init: function init() {
        // start generating ids with a delay because rendering widgets is asynchrous
        qx.event.Timer.once(() => {
          this.assignObjectIdsToChildren(qx.core.Init.getApplication().getRoot());
          this.fireEvent("done");
        }, null, 2000);
        this.addGlobalEventListener((target, event) => {
          if (event.getType() === "appear") {
            this.assignObjectIdsToChildren(qx.core.Init.getApplication().getRoot());
          }
        });
      },

      /**
       * Given a {@link qx.core.Object}, return an id for it, which is the last
       * part of the class name
       * @param qxObj {qx.core.Object}
       * @return {String}
       */
      generateId: function generateId(qxObj) {
        let clazz = qxObj.classname;
        return clazz.substr(clazz.lastIndexOf(".") + 1);
      },

      /**
       * Given an object and its parent, set its object id and add it to the
       * parent's owned objects. If the object doesn't have a parent or the
       * parent has no object id, register the object as a global id root.
       * @param obj The object to assign an object id to
       * @param owner The owning parent object
       * @param id {String|undefined} Optional id. If not given, generate an id from
       * the class name
       */
      generateQxObjectId: function generateQxObjectId(obj, owner, id) {
        if (!obj || typeof obj.getQxObjectId != "function" || obj.getQxObjectId()) {
          return;
        }

        id = id || this.generateId(obj);
        obj.setQxObjectId(id);

        if (owner && owner.getQxObjectId()) {
          // if the parent has an id, we add the child as an owned object
          let siblingWithSameName = false;
          let postfix = 1;

          do {
            try {
              owner.addOwnedQxObject(obj);
              siblingWithSameName = false; // console.log(`Adding ${obj} to ${parent} with id '${id}'`);
            } catch (e) {
              // name already exists, append a number
              siblingWithSameName = true;
              postfix++;
              obj.setQxObjectId(id + postfix);
            }
          } while (siblingWithSameName);
        } else {
          // otherwise, we register it as a top-level object
          //console.log(`Registering ${obj} as global id root with id '${id}'`);
          qx.core.Id.getInstance().register(obj, id);
        }
      },

      /**
       * Recursively assigns object ids to the children of the given parent widget.
       * @param parent {qx.ui.core.Widget|qx.ui.core.MChildrenHandling} An object that must include
       * the qx.ui.core.MChildrenHandling mixin.
       * @param level {Number}
       */
      assignObjectIdsToChildren: function assignObjectIdsToChildren(parent, level = 0) {
        if (!parent) {
          return;
        }

        let children = typeof parent.getChildren == "function" ? parent.getChildren() : typeof parent.getLayoutChildren == "function" ? parent.getLayoutChildren() : null; // let msg = "    ".repeat(level) + parent.classname;
        // if ( !children || ! children.length) {
        //   console.log(msg + " (no children)");
        //   return;
        // }
        // console.log(msg);

        if (!children || !children.length) {
          return;
        }

        for (let child of children) {
          // ignore tooltipps
          if (child instanceof qx.ui.tooltip.ToolTip) {
            continue;
          } // assign object id and add to parent if neccessary


          this.generateQxObjectId(child, parent); // handle special cases

          let otherChildRoots = [];
          let id;
          let obj = child; // traverse prototype chain to catch extended types

          while (obj instanceof qx.core.Object) {
            switch (obj.classname) {
              case "qx.core.Object":
                break;

              case "qx.ui.form.ComboBox":
                otherChildRoots.push(child.getChildControl("textfield"));
                break;

              case "qx.ui.form.VirtualSelectBox":
                otherChildRoots.push(child.getSelection());
                break;

              case "qx.ui.groupbox.GroupBox":
                otherChildRoots.push(child.getChildControl("frame"));
                break;

              case "qx.ui.form.MenuButton":
              case "qx.ui.toolbar.MenuButton":
              case "qx.ui.menubar.Button":
                otherChildRoots.push(child.getMenu());
                break;

              case "qx.ui.tree.Tree":
                otherChildRoots.push(child.getChildControl("pane"));
                break;

              case "qx.ui.tree.VirtualTree":
                child.addListener("open", () => {});
                child.addListener("close", () => {});
                otherChildRoots.push(child._manager);
                otherChildRoots.push(child.getPane());
                break;

              case "qx.ui.treevirtual.TreeVirtual":
                child.addListener("treeClose", () => {});
                child.addListener("treeOpenWithContent", () => {});
                child.addListener("treeOpenWhileEmpty", () => {});
              // fallthrough

              case "qx.ui.table.Table":
                otherChildRoots.push(child.getSelectionModel());
                id = "Selection";
                break;

              case "qx.ui.list.List":
                otherChildRoots.push(child.getSelection());
                id = "Selection";
                break;

              case "qx.ui.tabview.Page":
                this.generateQxObjectId(child.getChildControl("button"), child);
                break;

              default:
                if (child instanceof qx.core.Object) {
                  obj = Object.getPrototypeOf(obj); // continue while loop

                  continue;
                }

            } // break out of while loop


            break;
          } // add an empty event listener for the defined default events so
          // that they will be recorded


          for (let evt_name of cboulanger.eventrecorder.ObjectIdGenerator.DEFAULT_LISTENED_EVENTS) {
            if (qx.event.Registration.getManager(child).findHandler(child, evt_name) && !child.hasListener(evt_name)) {
              child.addListener(evt_name, () => {});
            }
          } // recurse into other child roots outside the layout hierarchy
          // that fire events relevant to the recorder


          if (otherChildRoots.length) {
            otherChildRoots.forEach(childRoot => {
              this.generateQxObjectId(childRoot, child, id);
              this.assignObjectIdsToChildren(childRoot, level + 1);
            });
          } // recurse into layout children


          this.assignObjectIdsToChildren(child, level + 1);
        }
      }
    },

    /**
     * Will be called after class has been loaded, before application startup
     */
    defer: function defer() {
      {
        qx.bom.Lifecycle.onReady(() => cboulanger.eventrecorder.ObjectIdGenerator.getInstance().init());
      }
    }
  });
  cboulanger.eventrecorder.ObjectIdGenerator.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Assert": {},
      "qookery.internal.Registry": {},
      "qookery.internal.FormParser": {}
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
   * Static class providing access to main Qookery features
   */
  qx.Class.define("qookery.Qookery", {
    type: "static",
    statics: {
      // Prefixed attributes - see XSD for their definition
      A_FORMAT: "{http://www.qookery.org/ns/Form}format",
      A_ICON: "{http://www.qookery.org/ns/Form}icon",
      A_MAP: "{http://www.qookery.org/ns/Form}map",
      A_TOOL_TIP_TEXT: "{http://www.qookery.org/ns/Form}tool-tip-text",
      // Options

      /**
       * Default value of <code>spacing-x</code> attribute for layout managers that support it
       */
      OPTION_DEFAULT_LAYOUT_SPACING_X: "q:default-layout-spacing-x",

      /**
       * Default value of <code>spacing-y</code> attribute for layout managers that support it
       */
      OPTION_DEFAULT_LAYOUT_SPACING_Y: "q:default-layout-spacing-y",

      /**
       * Default value of <code>live-update</code> attribute for components that support it
       */
      OPTION_DEFAULT_LIVE_UPDATE: "q:default-live-update",

      /**
       * Default value of <code>native-context-menu</code> attribute for components that support it
       */
      OPTION_DEFAULT_NATIVE_CONTEXT_MENU: "q:default-native-context-menu",

      /**
       * {String} Path to directory containing external libraries used by Qookery, defaults to <code>qookery/lib</code>.
       */
      OPTION_EXTERNAL_LIBRARIES: "q:external-libraries",
      // Services

      /**
       * Currently running Qooxdoo application
       */
      SERVICE_APPLICATION: "qx.application.IApplication",

      /**
       * Default model provider
       */
      SERVICE_MODEL_PROVIDER: "qookery.IModelProvider",

      /**
       * Qookery registry
       */
      SERVICE_REGISTRY: "qookery.IRegistry",

      /**
       * Currently set resource loader
       */
      SERVICE_RESOURCE_LOADER: "qookery.IResourceLoader",
      __OPTIONS: {
        // Default values
        "q:external-libraries": "qookery/lib"
      },

      /**
       * Return an option's value
       *
       * @param optionName {String} name of option
       * @param defaultValue {any} value to return in case option is not set
       *
       * @return {any} option value
       */
      getOption: function getOption(optionName, defaultValue) {
        qx.core.Assert.assertString(optionName);
        var value = qookery.Qookery.__OPTIONS[optionName];
        if (value === undefined) return defaultValue;
        return value;
      },

      /**
       * Set an option's value
       *
       * @param optionName {String} name of option
       * @param value {any} new option value
       */
      setOption: function setOption(optionName, value) {
        qx.core.Assert.assertString(optionName);
        qookery.Qookery.__OPTIONS[optionName] = value;
      },

      /**
       * Return the Qookery registry
       *
       * @return {qookery.IRegistry} the registry
       */
      getRegistry: function getRegistry() {
        return qookery.internal.Registry.getInstance();
      },

      /**
       * Return a service
       *
       * @param serviceName {String} symbolic name of the service
       * @param required {Boolean} if <code>true</code>, throw an exception when service is not found
       *
       * @return {Object} the instance of the required service or <code>null</code> if not available
       */
      getService: function getService(serviceName, required) {
        var registry = qookery.internal.Registry.getInstance();
        var service = registry.getService(serviceName);
        if (service != null || !required) return service;
        throw new Error("Required service '" + serviceName + "' is not available");
      },

      /**
       * Create a new Qookery form parser
       *
       * <p>You can use the parser for parsing XML documents in order to create a new form
       * components. Form components may then be displayed at any time by adding their
       * main widget (currently always a composite) to the children list
       * of container widgets.</p>
       *
       * <p>A demonstration of how to correctly use the form parser is:</p>
       *
       * <pre class="javascript">
       * var parser = qookery.Qookery.createNewParser();
       * try {
       *	var formComponent = parser.parse(xmlDocument);
       *	var mainWidget = formComponent.getMainWidget();
       *	container.add(mainWidget);
       * }
       * catch(error) {
       *	// Handle the exception
       * }
       * finally {
       *	parser.dispose();
       * }
       * </pre>
      	 * @param variables {Map ? null} optional variables to pass to generated forms
       * @param serviceResolver {Function ? null} optional function that will be called when resolving services
       *
       * @return {qookery.IFormParser} newly created instance of form parser
       */
      createFormParser: function createFormParser(variables, serviceResolver) {
        if (variables == null) variables = {};
        if (serviceResolver == null) serviceResolver = function serviceResolver(serviceName) {
          return null;
        };
        return new qookery.internal.FormParser(variables, serviceResolver);
      }
    }
  });
  qookery.Qookery.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.Qookery": {
        "require": true
      },
      "qookery.impl.FormWindow": {},
      "qookery.IFormComponent": {},
      "qookery.IContainerComponent": {},
      "qx.xml.Document": {},
      "qx.log.Logger": {}
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
   * The 'Qookery' scripting context is always available to XML authors and provides
   * a number of commonly used methods.
   */
  qx.Class.define("qookery.contexts.Qookery", {
    type: "static",
    statics: {
      // Methods ported from root Qookery static class
      getOption: qookery.Qookery.getOption,
      setOption: qookery.Qookery.setOption,
      getRegistry: qookery.Qookery.getRegistry,
      getService: qookery.Qookery.getService,
      // Additional methods of use to XML authors

      /**
       * Use resource loader to load a resource
       *
       * @param resourceUri {String} URI of the resource to load
       * @param thisArg {Object ? null} object to set as <code>this</code> for callbacks
       * @param successCallback {Function} callback to call after successful load
       * @param failCallback {Function} callback to call in case load fails
       *
       * @return {String|null} loaded resource as text in case call is synchronous
       */
      loadResource: function loadResource(resourceUri, thisArg, successCallback, failCallback) {
        var resourceLoader = qookery.Qookery.getService("qookery.IResourceLoader", true);
        return resourceLoader.loadResource(resourceUri, thisArg, successCallback, failCallback);
      },

      /**
       * Open a window with a form as content
       *
       * @param form {String|qookery.IFormComponent} URL of the XML form to load, or a form component
       * @param options {Map ? null} any of FormWindow options in addition to any of those below
       *		<ul>
       *		<li>model {any} optional model to load into the form</li>
       *		<li>variables {Map ? null} optional variables to pass to the form parser</li>
       *		<li>onClose {Function ? null} callback that will receive the form's result property when window is closed</li>
       *		</ul>
       * @param thisArg {Object ? null} object to set as <code>this</code> for callbacks
       *
       * @return {qookery.impl.FormWindow} newly opened form window
       */
      openWindow: function openWindow(form, options, thisArg) {
        if (!options) options = {};
        var window = new qookery.impl.FormWindow(null, null, options, thisArg);

        if (qx.Class.hasInterface(form.constructor, qookery.IFormComponent)) {
          if (options["variables"]) {
            for (var key in options["variables"]) {
              form.setVariable(key, options["variables"][key]);
            }
          }

          window.openForm(form, options["model"]);
        } else this.loadResource(form, null, function (formXml) {
          window.createAndOpen(formXml, options["model"], options["variables"]);
        });

        return window;
      },

      /**
       * Create a new format instance
       *
       * @param specification {String} valid format specification or a registered factory or format name
       * @param options {Map ? null} any number of options to pass to the format class constructor
       *
       * @return {qx.util.format.IFormat} new format instance or null if not available
       */
      createFormat: function createFormat(specification, options) {
        return qookery.Qookery.getRegistry().createFormat(specification, options);
      },

      /**
       * Programmatically create a new Qookery component
       *
       * @param parentComponent {qookery.IContainerComponent} parent component to hold new component
       * @param componentName {String} qualified or symbolic name of the new component's implementation class
       * @param attributes {Map ? null} any number of attributes understood by new component implementation
       *
       * @return {qookery.IComponent} newly created component
       */
      createComponent: function createComponent(parentComponent, componentName, attributes) {
        var componentQName = componentName.indexOf("{") === 0 ? componentName : "{http://www.qookery.org/ns/Form}" + componentName;
        var component = qookery.Qookery.getRegistry().createComponent(componentQName, parentComponent);
        component.create(attributes);
        component.setup();
        return component;
      },

      /**
       * Ascend the form hierarchy, starting from given form
       *
       * @param form {qookery.IFormComponent} the form to start ascending from
       * @param callback {Function} a function that will be called with each encountered form
       *			- a non-undefined return value breaks the ascension
       * @return {undefined}
       */
      ascendForms: function ascendForms(form, callback) {
        while (form != null && !form.isDisposed()) {
          var result = callback(form);
          if (result !== undefined) return result;
          form = form.getParentForm();
        }
      },

      /**
       * Iterate all components under the hierarchy starting with given component
       *
       * @param component {qookery.IComponent} the component to start descending from
       * @param callback {Function} a function that will be called with each encountered component
       *			- a non-undefined return value breaks the recursion
       * @return {any} value returned by callback if descending was interrupted or <code>undefined</code>
       */
      descendComponents: function descendComponents(component, callback) {
        var result = callback(component);
        if (result !== undefined) return result;
        if (!qx.Class.hasInterface(component.constructor, qookery.IContainerComponent)) return undefined;
        var childComponents = component.listChildren();

        for (var i = 0; i < childComponents.length; i++) {
          qookery.contexts.Qookery.descendComponents(childComponents[i], callback);
        }
      },

      /**
       * Starting from given component, descend all children altering the value of a component property
       *
       * @param component {qookery.IComponent} the component to start descending from
       * @param propertyName {String} the name of the property to set
       * @param propertyValue {any} the new value to set
       */
      setPropertyRecursively: function setPropertyRecursively(component, propertyName, propertyValue) {
        qookery.contexts.Qookery.descendComponents(component, function (c) {
          if (!qx.Class.hasProperty(c.constructor, propertyName)) return;
          c.set(propertyName, propertyValue);
        });
      },

      /**
       * Load a Qookery form from a URL
       *
       * @param formUrl {String} URI of the resource to load
       * @param thisArg {Object} object to set as <code>this</code> for callbacks
       * @param options {Map ? null} operation options
       *	<ul>
       *		<li>async {Boolean} if <code>true</code> load asynchronously - this is the default
       *		<li>fail {Function} callback to call in case load fails</li>
       *		<li>model {Object} form model</li>
       *		<li>success {Function} callback to call after successful load</li>
       *		<li>variables {Object ? null} variables that will be available in xml <code> $.variableName</code></li>
       *	</ul>
       *
       * @return {qookery.IComponent|null} loaded form component if synchronous or <code>null</code>
       */
      loadForm: function loadForm(formUrl, thisArg, options) {
        var successCallback = options["success"];
        var failCallback = options["fail"];
        var model = options["model"];
        var variables = options["variables"];

        var createForm = function createForm(xmlCode) {
          var xmlDocument = qx.xml.Document.fromString(xmlCode);
          var parser = qookery.Qookery.createFormParser(variables);

          try {
            var formComponent = parser.parseXmlDocument(xmlDocument);
            if (successCallback) successCallback.call(thisArg, formComponent, model, variables);
            return formComponent;
          } catch (error) {
            qx.log.Logger.error(this, "Error creating form editor", error);
            if (failCallback) failCallback.call(thisArg);
          } finally {
            parser.dispose();
          }
        };

        var resourceLoader = qookery.Qookery.getService("qookery.IResourceLoader", true);

        if (options["async"] === false) {
          var xmlCode = resourceLoader.loadResource(formUrl, thisArg, null, failCallback);
          return createForm(xmlCode);
        }

        return resourceLoader.loadResource(formUrl, thisArg, createForm, failCallback);
      }
    }
  });
  qookery.contexts.Qookery.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
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
   * Facility that handles registration of various Qookery artifacts under well known symbolic names
   */
  qx.Interface.define("qookery.IRegistry", {
    statics: {
      // Constants
      // .	Partitions
      P_ATTRIBUTE: "attribute",
      P_CELL_EDITOR_FACTORY: "cell-editor-factory",
      P_CELL_RENDERER_FACTORY: "cell-renderer-factory",
      P_COMMAND: "command",
      P_COMPONENT: "component",
      P_FORMAT: "format",
      P_FORMAT_FACTORY: "format-factory",
      P_LAYOUT_FACTORY: "layout-factory",
      P_LIBRARY: "library",
      P_MAP: "map",
      P_MEDIA_QUERY: "media-query",
      P_MODEL_PROVIDER: "model-provider",
      P_SERVICE: "service",
      P_VALIDATOR: "validator"
    },
    members: {
      // Partitions

      /**
       * Create a new partition in the registry
       *
       * @param partitionName {String} the name of the partition to create
       *
       * @throws {Error} in case the partition already exists or the name is not acceptable
       */
      createPartition: function createPartition(partitionName) {},
      // Elements

      /**
       * Retrieve an element from the registry
       *
       * @param partitionName {String} the name of the partition to look up
       * @param elementName {String} the name of the element to find in partition
       * @param required {Boolean?} if <code>true</code>, throw an exception when not found
       *
       * @return {any} the element or <code>undefined</code>
       */
      get: function get(partitionName, elementName, required) {},

      /**
       * Return a list of the names of all elements registered in a partition
       *
       * @param partitionName {String} the name of the partition to look up
       *
       * @return {Array} an array of element names
       */
      keys: function keys(partitionName) {},

      /**
       * Put an element into the registry
       *
       * @param partitionName {String} the name of the partition to look up
       * @param elementName {String} the name of the element to put in the partition
       * @param element {any} the element itself, <code>undefined</code> is not a valid value
       */
      put: function put(partitionName, elementName, element) {},

      /**
       * Remove an element from the registry
       *
       * @param partitionName {String} the name of the partition to look up
       * @param elementName {String} the name of the element to remove from the partition
       */
      remove: function remove(partitionName, elementName) {},
      // Services

      /**
       * Register a new service
       *
       * @param serviceName {String} symbolic name of the service
       * @param serviceClass {qx.Class|Object} singleton class of service or any object with a getInstance() member function
       */
      registerService: function registerService(serviceName, serviceClass) {},

      /**
       * Return a service's instance
       *
       * @param serviceName {String} symbolic name of the service
       *
       * @return {Object} the instance of the required service or <code>null</code> if not available
       */
      getService: function getService(serviceName) {},
      // Components

      /**
       * Register a new component type
       *
       * @param componentQName {String} qualified name of the component to register
       * @param componentClass {qx.Class} class that implements (at least) qookery.IComponent
       */
      registerComponentType: function registerComponentType(componentQName, componentClass) {},

      /**
       * Check if a component type is available
      	 * @param componentQName {String} qualified name of a possibly registered component type
       *
       * @return {boolean} <code>true</code> in case the component type is available
       */
      isComponentTypeAvailable: function isComponentTypeAvailable(componentQName) {},

      /**
       * Create a new component instance
       *
       * @param componentQName {String} qualified name of a registered component type
       * @param parentComponent {IComponent?null} component that will contain new component
       *
       * @return {IComponent} newly created component, an exception is thrown on error
       */
      createComponent: function createComponent(componentQName, parentComponent) {},
      // Validators

      /**
       * Register a validator under provided name
       *
       * @param name {String} the name of the validator for subsequent access
       * @param validator {qookery.IValidator} the validator itself
       */
      registerValidator: function registerValidator(name, validator) {},

      /**
       * Get a previously registered validator by name
       *
       * @param name {String} name of the validator
       *
       * @return {qookery.IValidator} the validator or <code>undefined</code> if not found
       */
      getValidator: function getValidator(name) {},
      // Media queries

      /**
       * Get a previously registered media query by name
       *
       * @param name {String} name of the media query
       *
       * @return {qx.bom.MediaQuery} the media query or <code>null</code> if not found
       */
      getMediaQuery: function getMediaQuery(name) {},
      // Model providers

      /**
       * Register a model provider, optionally setting it as the default one
       *
       * @param providerName {String} symbolic name of provider
       * @param providerClass {qx.Class} class of the provider
       * @param setDefault {Boolean} if <code>true</code>, provider will be set as the default one
       */
      registerModelProvider: function registerModelProvider(providerName, providerClass, setDefault) {},

      /**
       * Return a registered model provider
       *
       * @param providerName {String} symbolic name of provider
       */
      getModelProvider: function getModelProvider(providerName) {},
      // Formats

      /**
       * Register an IFormat under a symbolic name
       *
       * @param formatName {String} symbolic name of the format for easy referencing
       * @param format {qx.util.format.IFormat} format class
       */
      registerFormat: function registerFormat(formatName, format) {},

      /**
       * Register an IFormat factory for easy instance creation by XML authors
       *
       * @param factoryName {String} name of the format class for easy referencing
       * @param formatClass {qx.Class} format class
       */
      registerFormatFactory: function registerFormatFactory(factoryName, formatClass) {},

      /**
       * Return a previously registered format
       *
       * @param formatName {String} symbolic name of the wanted format
       */
      getFormat: function getFormat(formatName) {},

      /**
       * Parse a format specification
       *
       * <p>Format specification syntax is:</p>
       *
       * <pre>{formatName} | ( {factoryName} [ ':' {option1} '=' {value1} [ ',' {option2} '=' {value2} ]* ]? )</pre>
       *
       * @param specification {String} a specification according to above syntax
       * @param options {Map} any additional options to pass to the format constructor - forces factory lookup if provided
       *
       * @return {qx.util.format.IFormat} the newly created format instance
       */
      createFormat: function createFormat(specification, options) {},
      // Maps

      /**
       * Register a map
       *
       * @param mapName {String} symbolic name of the map for subsequent access
       * @param map {Map} map object
       */
      registerMap: function registerMap(mapName, map) {},

      /**
       * Return a registered map
       *
       * @param mapName {String} symbolic name of the map sought
       *
       * @return {Map} map object or <code>null</code> if map was not found
       */
      getMap: function getMap(mapName) {},
      // Libraries

      /**
       * Register a library for future use
       *
       * @param libraryName {String} symbolic name of the library
       * @param resourceUris {Array?} array of URIs of resources to load when library is used for the first time
       * @param dependencies {Array?} array of names of other libraries that must be loaded prior to this one
       * @param postLoadCallback {Function?} function that will be called when loading finished for further library initialization
       */
      registerLibrary: function registerLibrary(libraryName, resourceUris, dependencies, postLoadCallback) {},

      /**
       * Request one or more libraries for usage, loading them if needed
       *
       * @param libraryName {String|Array?} symbolic name(s) of libraries to load - may be empty
       * @param continuation {Function} called once finished; on failure, the cause will be found in the first argument as an instance of Error
       * @param thisArg {any} optional <code>this</code> argument for continuation
       */
      loadLibrary: function loadLibrary(libraryName, continuation, thisArg) {}
    }
  });
  qookery.IRegistry.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qookery.IRegistry": {
        "construct": true,
        "require": true
      },
      "qookery.impl.DefaultModelProvider": {
        "construct": true
      },
      "qookery.impl.DefaultResourceLoader": {
        "construct": true
      },
      "qx.core.Init": {
        "construct": true
      },
      "qookery.internal.validators.ArrayValidator": {
        "construct": true
      },
      "qookery.internal.validators.ComparisonValidator": {
        "construct": true
      },
      "qookery.internal.validators.NotNullValidator": {
        "construct": true
      },
      "qookery.internal.validators.StringValidator": {
        "construct": true
      },
      "qookery.internal.layouts.BasicLayoutFactory": {
        "construct": true
      },
      "qookery.internal.layouts.FlowLayoutFactory": {
        "construct": true
      },
      "qookery.internal.layouts.GridLayoutFactory": {
        "construct": true
      },
      "qookery.internal.layouts.GrowLayoutFactory": {
        "construct": true
      },
      "qookery.internal.layouts.HBoxLayoutFactory": {
        "construct": true
      },
      "qookery.internal.layouts.VBoxLayoutFactory": {
        "construct": true
      },
      "qookery.internal.components.ButtonComponent": {
        "construct": true
      },
      "qookery.internal.components.CanvasComponent": {
        "construct": true
      },
      "qookery.internal.components.CheckFieldComponent": {
        "construct": true
      },
      "qookery.internal.components.ComboBoxComponent": {
        "construct": true
      },
      "qookery.internal.components.CompositeComponent": {
        "construct": true
      },
      "qookery.internal.components.DateFieldComponent": {
        "construct": true
      },
      "qookery.internal.components.FormComponent": {
        "construct": true
      },
      "qookery.internal.components.GroupBoxComponent": {
        "construct": true
      },
      "qookery.internal.components.HoverButtonComponent": {
        "construct": true
      },
      "qookery.internal.components.HtmlComponent": {
        "construct": true
      },
      "qookery.internal.components.IframeComponent": {
        "construct": true
      },
      "qookery.internal.components.ImageComponent": {
        "construct": true
      },
      "qookery.internal.components.LabelComponent": {
        "construct": true
      },
      "qookery.internal.components.ListComponent": {
        "construct": true
      },
      "qookery.internal.components.MenuButtonComponent": {
        "construct": true
      },
      "qookery.internal.components.PasswordFieldComponent": {
        "construct": true
      },
      "qookery.internal.components.ProgressBarComponent": {
        "construct": true
      },
      "qookery.internal.components.RadioButtonComponent": {
        "construct": true
      },
      "qookery.internal.components.RadioButtonGroupComponent": {
        "construct": true
      },
      "qookery.internal.components.ScrollComponent": {
        "construct": true
      },
      "qookery.internal.components.SelectBoxComponent": {
        "construct": true
      },
      "qookery.internal.components.SeparatorComponent": {
        "construct": true
      },
      "qookery.internal.components.SliderComponent": {
        "construct": true
      },
      "qookery.internal.components.SpacerComponent": {
        "construct": true
      },
      "qookery.internal.components.SpinnerComponent": {
        "construct": true
      },
      "qookery.internal.components.SplitButtonComponent": {
        "construct": true
      },
      "qookery.internal.components.SplitPaneComponent": {
        "construct": true
      },
      "qookery.internal.components.StackComponent": {
        "construct": true
      },
      "qookery.internal.components.TabViewComponent": {
        "construct": true
      },
      "qookery.internal.components.TabViewPageComponent": {
        "construct": true
      },
      "qookery.internal.components.TableComponent": {
        "construct": true
      },
      "qookery.internal.components.TextAreaComponent": {
        "construct": true
      },
      "qookery.internal.components.TextFieldComponent": {
        "construct": true
      },
      "qookery.internal.components.ToggleButtonComponent": {
        "construct": true
      },
      "qookery.internal.components.ToolBarComponent": {
        "construct": true
      },
      "qookery.internal.components.VirtualTreeComponent": {
        "construct": true
      },
      "qookery.internal.formats.CustomFormat": {
        "construct": true
      },
      "qookery.internal.formats.DateFormat": {
        "construct": true
      },
      "qookery.internal.formats.MapFormat": {
        "construct": true
      },
      "qookery.internal.formats.NumberFormat": {
        "construct": true
      },
      "qx.ui.table.celleditor.CheckBox": {
        "construct": true
      },
      "qx.ui.table.celleditor.PasswordField": {
        "construct": true
      },
      "qx.ui.table.celleditor.SelectBox": {
        "construct": true
      },
      "qx.ui.table.celleditor.TextField": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Boolean": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Date": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Debug": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Default": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Html": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Image": {
        "construct": true
      },
      "qookery.internal.components.table.CellRenderer": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Number": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.Password": {
        "construct": true
      },
      "qx.ui.table.cellrenderer.String": {
        "construct": true
      },
      "qx.lang.Type": {},
      "qx.bom.MediaQuery": {},
      "qx.lang.String": {},
      "qookery.internal.util.Library": {}
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
  qx.Class.define("qookery.internal.Registry", {
    extend: qx.core.Object,
    type: "singleton",
    implement: [qookery.IRegistry],
    construct: function construct() {
      qx.core.Object.constructor.call(this);
      this.__partitions = {};

      var partition = this.__attributes = this.__createPartition(qookery.IRegistry.P_ATTRIBUTE);

      partition["allow-grow"] = "Boolean";
      partition["allow-grow-x"] = "Boolean";
      partition["allow-grow-y"] = "Boolean";
      partition["allow-shrink"] = "Boolean";
      partition["allow-shrink-x"] = "Boolean";
      partition["allow-shrink-y"] = "Boolean";
      partition["allow-stretch"] = "Boolean";
      partition["allow-stretch-x"] = "Boolean";
      partition["allow-stretch-y"] = "Boolean";
      partition["col-span"] = "Number";
      partition["column"] = "Number";
      partition["draggable"] = "Boolean";
      partition["droppable"] = "Boolean";
      partition["enabled"] = "Boolean";
      partition["flex"] = "Number";
      partition["focusable"] = "Boolean";
      partition["height"] = "Size";
      partition["label"] = "ReplaceableString";
      partition["left"] = "Number";
      partition["line-break"] = "Boolean";
      partition["live-update"] = "Boolean";
      partition["margin"] = "IntegerList";
      partition["margin-bottom"] = "Integer";
      partition["margin-left"] = "Integer";
      partition["margin-right"] = "Integer";
      partition["margin-top"] = "Integer";
      partition["max-height"] = "Size";
      partition["max-length"] = "Integer";
      partition["max-width"] = "Size";
      partition["maximum"] = "Integer";
      partition["min-height"] = "Size";
      partition["min-width"] = "Size";
      partition["minimal-line-height"] = "Integer";
      partition["minimum"] = "Integer";
      partition["native-context-menu"] = "Boolean";
      partition["padding"] = "IntegerList";
      partition["padding-bottom"] = "Integer";
      partition["padding-left"] = "Integer";
      partition["padding-right"] = "Integer";
      partition["padding-top"] = "Integer";
      partition["page-step"] = "Integer";
      partition["read-only"] = "Boolean";
      partition["required"] = "Boolean";
      partition["reversed"] = "Boolean";
      partition["row"] = "Number";
      partition["row-height"] = "Integer";
      partition["row-span"] = "Number";
      partition["single-step"] = "Integer";
      partition["spacing"] = "Integer";
      partition["spacing-x"] = "Integer";
      partition["spacing-y"] = "Integer";
      partition["stretch"] = "Boolean";
      partition["tab-index"] = "Integer";
      partition["tool-tip-text"] = "ReplaceableString";
      partition["top"] = "Number";
      partition["width"] = "Size";
      partition = this.__createPartition(qookery.IRegistry.P_SERVICE);
      partition["qookery.IModelProvider"] = qookery.impl.DefaultModelProvider;
      partition["qookery.IRegistry"] = this;
      partition["qookery.IResourceLoader"] = qookery.impl.DefaultResourceLoader;
      partition["qx.application.IApplication"] = {
        getInstance: function getInstance() {
          return qx.core.Init.getApplication();
        }
      }; // Obsolete shorthands, refrain from using; full interface name is preferred

      partition["Application"] = partition["qx.application.IApplication"];
      partition["ModelProvider"] = partition["qookery.IModelProvider"];
      partition["Registry"] = partition["qookery.IRegistry"];
      partition["ResourceLoader"] = partition["qookery.IResourceLoader"];
      partition = this.__createPartition(qookery.IRegistry.P_MEDIA_QUERY);
      partition["small-up"] = "only screen";
      partition["small-only"] = "only screen and (max-width: 40em)"; // Mobile screens, width up to 640px

      partition["medium-up"] = "only screen and (min-width: 40.063em)";
      partition["medium-only"] = "only screen and (min-width: 40.063em) and (max-width: 64em)"; // Tablet screens, width up to 1024px

      partition["large-up"] = "only screen and (min-width: 64.063em)";
      partition["large-only"] = "only screen and (min-width: 64.063em) and (max-width: 90em)"; // Large screens, width up to1440px

      partition["xlarge-up"] = "only screen and (min-width: 90.063em)";
      partition["xlarge-only"] = "only screen and (min-width: 90.063em) and (max-width: 120em)"; // Extra large screens, width up to 1920px

      partition["xxlarge-up"] = "only screen and (min-width: 120.063em)";
      partition = this.__createPartition(qookery.IRegistry.P_MODEL_PROVIDER);
      partition["default"] = qookery.impl.DefaultModelProvider.getInstance();
      partition = this.__createPartition(qookery.IRegistry.P_VALIDATOR);
      partition["array"] = qookery.internal.validators.ArrayValidator.getInstance();
      partition["comparison"] = qookery.internal.validators.ComparisonValidator.getInstance();
      partition["notNull"] = qookery.internal.validators.NotNullValidator.getInstance();
      partition["string"] = qookery.internal.validators.StringValidator.getInstance();
      partition = this.__createPartition(qookery.IRegistry.P_LAYOUT_FACTORY);
      partition["{http://www.qookery.org/ns/Form}basic"] = qookery.internal.layouts.BasicLayoutFactory.getInstance();
      partition["{http://www.qookery.org/ns/Form}flow"] = qookery.internal.layouts.FlowLayoutFactory.getInstance();
      partition["{http://www.qookery.org/ns/Form}grid"] = qookery.internal.layouts.GridLayoutFactory.getInstance();
      partition["{http://www.qookery.org/ns/Form}grow"] = qookery.internal.layouts.GrowLayoutFactory.getInstance();
      partition["{http://www.qookery.org/ns/Form}h-box"] = qookery.internal.layouts.HBoxLayoutFactory.getInstance();
      partition["{http://www.qookery.org/ns/Form}v-box"] = qookery.internal.layouts.VBoxLayoutFactory.getInstance();
      partition = this.__createPartition(qookery.IRegistry.P_COMPONENT);
      partition["{http://www.qookery.org/ns/Form}button"] = qookery.internal.components.ButtonComponent;
      partition["{http://www.qookery.org/ns/Form}canvas"] = qookery.internal.components.CanvasComponent;
      partition["{http://www.qookery.org/ns/Form}check-field"] = qookery.internal.components.CheckFieldComponent;
      partition["{http://www.qookery.org/ns/Form}combo-box"] = qookery.internal.components.ComboBoxComponent;
      partition["{http://www.qookery.org/ns/Form}composite"] = qookery.internal.components.CompositeComponent;
      partition["{http://www.qookery.org/ns/Form}date-field"] = qookery.internal.components.DateFieldComponent;
      partition["{http://www.qookery.org/ns/Form}form"] = qookery.internal.components.FormComponent;
      partition["{http://www.qookery.org/ns/Form}group-box"] = qookery.internal.components.GroupBoxComponent;
      partition["{http://www.qookery.org/ns/Form}hover-button"] = qookery.internal.components.HoverButtonComponent;
      partition["{http://www.qookery.org/ns/Form}html"] = qookery.internal.components.HtmlComponent;
      partition["{http://www.qookery.org/ns/Form}iframe"] = qookery.internal.components.IframeComponent;
      partition["{http://www.qookery.org/ns/Form}image"] = qookery.internal.components.ImageComponent;
      partition["{http://www.qookery.org/ns/Form}label"] = qookery.internal.components.LabelComponent;
      partition["{http://www.qookery.org/ns/Form}list"] = qookery.internal.components.ListComponent;
      partition["{http://www.qookery.org/ns/Form}menu-button"] = qookery.internal.components.MenuButtonComponent;
      partition["{http://www.qookery.org/ns/Form}password-field"] = qookery.internal.components.PasswordFieldComponent;
      partition["{http://www.qookery.org/ns/Form}progress-bar"] = qookery.internal.components.ProgressBarComponent;
      partition["{http://www.qookery.org/ns/Form}radio-button"] = qookery.internal.components.RadioButtonComponent;
      partition["{http://www.qookery.org/ns/Form}radio-button-group"] = qookery.internal.components.RadioButtonGroupComponent;
      partition["{http://www.qookery.org/ns/Form}scroll"] = qookery.internal.components.ScrollComponent;
      partition["{http://www.qookery.org/ns/Form}select-box"] = qookery.internal.components.SelectBoxComponent;
      partition["{http://www.qookery.org/ns/Form}separator"] = qookery.internal.components.SeparatorComponent;
      partition["{http://www.qookery.org/ns/Form}slider"] = qookery.internal.components.SliderComponent;
      partition["{http://www.qookery.org/ns/Form}spacer"] = qookery.internal.components.SpacerComponent;
      partition["{http://www.qookery.org/ns/Form}spinner"] = qookery.internal.components.SpinnerComponent;
      partition["{http://www.qookery.org/ns/Form}split-button"] = qookery.internal.components.SplitButtonComponent;
      partition["{http://www.qookery.org/ns/Form}split-pane"] = qookery.internal.components.SplitPaneComponent;
      partition["{http://www.qookery.org/ns/Form}stack"] = qookery.internal.components.StackComponent;
      partition["{http://www.qookery.org/ns/Form}tab-view"] = qookery.internal.components.TabViewComponent;
      partition["{http://www.qookery.org/ns/Form}tab-view-page"] = qookery.internal.components.TabViewPageComponent;
      partition["{http://www.qookery.org/ns/Form}table"] = qookery.internal.components.TableComponent;
      partition["{http://www.qookery.org/ns/Form}text-area"] = qookery.internal.components.TextAreaComponent;
      partition["{http://www.qookery.org/ns/Form}text-field"] = qookery.internal.components.TextFieldComponent;
      partition["{http://www.qookery.org/ns/Form}toggle-button"] = qookery.internal.components.ToggleButtonComponent;
      partition["{http://www.qookery.org/ns/Form}tool-bar"] = qookery.internal.components.ToolBarComponent;
      partition["{http://www.qookery.org/ns/Form}virtual-tree"] = qookery.internal.components.VirtualTreeComponent;
      partition = this.__createPartition(qookery.IRegistry.P_FORMAT_FACTORY);
      partition["custom"] = qookery.internal.formats.CustomFormat;
      partition["date"] = qookery.internal.formats.DateFormat;
      partition["map"] = qookery.internal.formats.MapFormat;
      partition["number"] = qookery.internal.formats.NumberFormat;
      partition = this.__createPartition(qookery.IRegistry.P_CELL_EDITOR_FACTORY);

      partition["{http://www.qookery.org/ns/Form}check-box"] = function (component, column) {
        return new qx.ui.table.celleditor.CheckBox();
      };

      partition["{http://www.qookery.org/ns/Form}password-field"] = function (component, column) {
        return new qx.ui.table.celleditor.PasswordField();
      };

      partition["{http://www.qookery.org/ns/Form}select-box"] = function (component, column) {
        return new qx.ui.table.celleditor.SelectBox();
      };

      partition["{http://www.qookery.org/ns/Form}text-field"] = function (component, column) {
        return new qx.ui.table.celleditor.TextField();
      };

      partition = this.__createPartition(qookery.IRegistry.P_CELL_RENDERER_FACTORY);

      partition["{http://www.qookery.org/ns/Form}boolean"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Boolean();
      };

      partition["{http://www.qookery.org/ns/Form}date"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Date(column["text-align"], column["color"], column["font-style"], column["font-weight"]);
      };

      partition["{http://www.qookery.org/ns/Form}debug"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Debug();
      };

      partition["{http://www.qookery.org/ns/Form}default"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Default();
      };

      partition["{http://www.qookery.org/ns/Form}html"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Html(column["text-align"], column["color"], column["font-style"], column["font-weight"]);
      };

      partition["{http://www.qookery.org/ns/Form}image"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Image(column["width"], column["height"]);
      };

      partition["{http://www.qookery.org/ns/Form}model"] = function (component, column) {
        return new qookery.internal.components.table.CellRenderer(component, column);
      };

      partition["{http://www.qookery.org/ns/Form}number"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Number(column["text-align"], column["color"], column["font-style"], column["font-weight"]);
      };

      partition["{http://www.qookery.org/ns/Form}password"] = function (component, column) {
        return new qx.ui.table.cellrenderer.Password();
      };

      partition["{http://www.qookery.org/ns/Form}string"] = function (component, column) {
        return new qx.ui.table.cellrenderer.String(column["text-align"], column["color"], column["font-style"], column["font-weight"]);
      };

      this.__createPartition(qookery.IRegistry.P_COMMAND);

      this.__createPartition(qookery.IRegistry.P_FORMAT);

      this.__createPartition(qookery.IRegistry.P_LIBRARY);

      this.__createPartition(qookery.IRegistry.P_MAP);
    },
    members: {
      __partitions: null,
      __attributes: null,
      // Partitions
      createPartition: function createPartition(partitionName) {
        this.__createPartition(partitionName);
      },
      // Elements
      get: function get(partitionName, elementName, required) {
        var partition = this.__getPartition(partitionName);

        var element = partition[elementName];
        if (element === undefined && required === true) throw new Error("Required element '" + elementName + "' missing from partition '" + partitionName + "'");
        return element;
      },
      keys: function keys(partitionName) {
        var partition = this.__getPartition(partitionName);

        return Object.keys(partition);
      },
      put: function put(partitionName, elementName, element) {
        if (element === undefined) throw new Error("Illegal call to put() with an undefined element");

        var partition = this.__getPartition(partitionName);

        var previousElement = partition[elementName];
        if (previousElement) this.debug("Registration of element '" + elementName + "' in partition '" + partitionName + "' replaced existing element");
        partition[elementName] = element;
      },
      remove: function remove(partitionName, elementName) {
        var partition = this.__getPartition(partitionName);

        delete partition[elementName];
      },
      // Attributes
      getAttributeType: function getAttributeType(attributeName) {
        return this.__attributes[attributeName];
      },
      // Services
      getService: function getService(serviceName) {
        var serviceClass = this.get(qookery.IRegistry.P_SERVICE, serviceName);
        if (serviceClass == null) return null;

        try {
          return serviceClass.getInstance();
        } catch (e) {
          this.error("Error activating service", serviceName, e); // Service is defunct, remove it from array of available services

          this.remove(qookery.IRegistry.P_SERVICE, serviceName);
          return null;
        }
      },
      registerService: function registerService(serviceName, serviceClass) {
        this.put(qookery.IRegistry.P_SERVICE, serviceName, serviceClass);
      },
      unregisterService: function unregisterService(serviceName) {
        this.remove(qookery.IRegistry.P_SERVICE, serviceName);
      },
      // Model providers
      getModelProvider: function getModelProvider(providerName) {
        if (providerName == null) return this.getService("qookery.IModelProvider");
        var providerClass = this.get(qookery.IRegistry.P_MODEL_PROVIDER, providerName, true);
        return providerClass.getInstance();
      },
      registerModelProvider: function registerModelProvider(providerName, providerClass, setDefault) {
        this.put(qookery.IRegistry.P_MODEL_PROVIDER, providerName, providerClass);
        if (setDefault) this.registerService("qookery.IModelProvider", providerClass);
      },
      // Components
      isComponentTypeAvailable: function isComponentTypeAvailable(componentQName) {
        return this.get(qookery.IRegistry.P_COMPONENT, componentQName) !== undefined;
      },
      registerComponentType: function registerComponentType(componentQName, componentClass) {
        this.put(qookery.IRegistry.P_COMPONENT, componentQName, componentClass);
      },
      createComponent: function createComponent(componentQName, parentComponent) {
        var componentClass = this.get(qookery.IRegistry.P_COMPONENT, componentQName, true);
        return new componentClass(parentComponent);
      },
      // Validators
      registerValidator: function registerValidator(name, validator) {
        this.put(qookery.IRegistry.P_VALIDATOR, name, validator);
      },
      getValidator: function getValidator(name) {
        return this.get(qookery.IRegistry.P_VALIDATOR, name);
      },
      // Media queries
      getMediaQuery: function getMediaQuery(name) {
        var query = this.get(qookery.IRegistry.P_MEDIA_QUERY, name);
        if (query == null) return null;

        if (qx.lang.Type.isString(query)) {
          query = new qx.bom.MediaQuery(query);
          this.put(qookery.IRegistry.P_MEDIA_QUERY, name, query);
        }

        return query;
      },
      // Formats
      getFormat: function getFormat(formatName) {
        return this.get(qookery.IRegistry.P_FORMAT, formatName);
      },
      registerFormat: function registerFormat(formatName, format) {
        this.put(qookery.IRegistry.P_FORMAT, formatName, format);

        format.dispose = function () {// Registered formats are immortal
        };
      },
      registerFormatFactory: function registerFormatFactory(factoryName, formatClass) {
        this.put(qookery.IRegistry.P_FORMAT_FACTORY, factoryName, formatClass);
      },
      createFormat: function createFormat(specification, options) {
        var colonPos = specification.indexOf(":");

        if (colonPos === -1 && options === undefined) {
          var format = this.get(qookery.IRegistry.P_FORMAT, specification);
          if (format) return format;
        }

        var factoryName = specification;
        if (options === undefined) options = {};

        if (colonPos !== -1) {
          factoryName = specification.slice(0, colonPos);
          specification.slice(colonPos + 1).replace(/([^=,]+)=([^,]*)/g, function (m, key, value) {
            key = qx.lang.String.clean(key);
            value = qx.lang.String.clean(value);
            options[key] = value;
          });
        }

        var formatClass = this.get(qookery.IRegistry.P_FORMAT_FACTORY, factoryName, true);
        return new formatClass(options);
      },
      // Maps
      getMap: function getMap(mapName) {
        return this.get(qookery.IRegistry.P_MAP, mapName);
      },
      registerMap: function registerMap(mapName, map) {
        this.put(qookery.IRegistry.P_MAP, mapName, map);
      },
      // Libraries
      getLibrary: function getLibrary(name, required) {
        return this.get(qookery.IRegistry.P_LIBRARY, name, required);
      },
      isLibraryLoaded: function isLibraryLoaded(name) {
        var library = this.get(qookery.IRegistry.P_LIBRARY, name, false);
        if (library == null) return false;
        return library.isLoaded();
      },
      registerLibrary: function registerLibrary(name, resourceUris, dependencies, postLoadCallback) {
        var library = new qookery.internal.util.Library(name, resourceUris, dependencies, postLoadCallback);
        this.put(qookery.IRegistry.P_LIBRARY, name, library);
      },
      loadLibrary: function loadLibrary(libraryNames, continuation, thisArg) {
        var libraryName = libraryNames;

        if (qx.lang.Type.isArray(libraryNames)) {
          libraryName = libraryNames[0];

          if (libraryNames.length >= 2) {
            libraryNames = libraryNames.slice(1);
            var originalContinuation = continuation;

            continuation = function continuation(error) {
              if (error != null) return originalContinuation(error);
              qookery.internal.Registry.getInstance().loadLibrary(libraryNames, originalContinuation, thisArg);
            };
          }
        }

        if (!libraryName) return continuation.call(thisArg);
        var library = this.get(qookery.IRegistry.P_LIBRARY, libraryName, true);
        library.load(continuation, thisArg);
      },
      // Commands
      getCommand: function getCommand(commandName) {
        return this.get(qookery.IRegistry.P_COMMAND, commandName);
      },
      registerCommand: function registerCommand(commandName, command) {
        this.put(qookery.IRegistry.P_COMMAND, commandName, command);
      },
      // Cell renders
      getCellRendererFactory: function getCellRendererFactory(cellRendererName, required) {
        return this.get(qookery.IRegistry.P_CELL_RENDERER_FACTORY, cellRendererName, required);
      },
      registerCellRendererFactory: function registerCellRendererFactory(cellRendererName, cellRendererFactory) {
        this.put(qookery.IRegistry.P_CELL_RENDERER_FACTORY, cellRendererName, cellRendererFactory);
      },
      // Internals
      __getPartition: function __getPartition(name) {
        var partition = this.__partitions[name];
        if (partition === undefined) throw new Error("Unknown partition '" + name + "'");
        return partition;
      },
      __createPartition: function __createPartition(name) {
        var partition = this.__partitions[name];
        if (partition !== undefined) throw new Error("Partition '" + name + "' is already defined");
        this.__partitions[name] = partition = {};
        return partition;
      }
    }
  });
  qookery.internal.Registry.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
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
   * Interface providing access to some internals of the Qookery XML parser
   */
  qx.Interface.define("qookery.IFormParser", {
    members: {
      /**
       * Parse and generate a Qookery form
       *
       * @param xmlDocument {qx.xml.Document} input DOM XML document structured according to the form.xsd schema
       * @param parentComponent {qookery.IContainerComponent} an optional parent component that will hold generated results or <code>null</code>
       *
       * @return {qookery.IComponent} the root of the generated component hierarchy - typically a form component
       */
      parseXmlDocument: function parseXmlDocument(xmlDocument, parentComponent) {}
    }
  });
  qookery.IFormParser.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
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
   * Model providers bridge user-provided data functionality with Qookery interfaces
   */
  qx.Interface.define("qookery.IModelProvider", {
    members: {
      /**
       * Return a JavaScript primitive or array of primitives that uniquely identifies model object
       *
       * <p>The result must be such so that if a == b, then identityOf(a) == identityOf(b) and vice-versa.</p>
       * <p>The result must be <code>null</code> when no input was passed.</p>
       *
       * @param object {any} model object - it may be <code>null</code>
       *
       * @return {any} any JavaScript primitive or array of primitives
       */
      identityOf: function identityOf(object) {},

      /**
       * Test two model objects for equality
       *
       * <p>Method must be null-safe:
       *		equals(null, null) -> true and
       *		equals(null, non-null) -> false</p>
       *
       * @param object1 {any} model object, may be <code>null</code>
       * @param object2 {any} model object, may be <code>null</code>
       *
       * @return {Boolean} <code>true</code> if objects are equal or both <code>null</code>
       */
      areEqual: function areEqual(object1, object2) {},

      /**
       * Returns a negative number, zero, or a positive number as object1 is less than, equal to, or greater than object2
       *
       * <p>Method must be null-safe:
       *		compare(null, null) -> 0,
       *		compare(null, non-null) -> -1 and
       *		compare(non-null, null) -> 1</p>
       *
       * @param object1 {any} model object, may be <code>null</code>
       * @param object2 {any} model object, may be <code>null</code>
       *
       * @return {Number} negative number, positive number or zero according to comparison result
       */
      compare: function compare(object1, object2) {},

      /**
       * Convert values from component specific to model objects
       *
       * <p>Provider is expected to convert given component specific value to a model object.</p>
       *
       * @param value {any} component-specific value
       * @param className {String} the name of the value's class
       *
       * @return {any} value if no conversion needed, conversion result, or <code>null</code> if conversion was attempted but failed
       */
      convertFrom: function convertFrom(value, className) {},

      /**
       * Convert values from model objects to component specific values
       *
       * <p>Provider is expected to convert given model object into an object of the required class for component specific needs.</p>
       *
       * @param object {any} model object
       * @param className {String} the name of the wanted value's class
       *
       * @return {any} input if no conversion needed, conversion result, or <code>null</code> if conversion was attempted but failed
       */
      convertTo: function convertTo(object, className) {},

      /**
       * Return a human-friendly label for a model object
       *
       * @param object {any} model object - it may not be <code>null</code>
       * @param labelType {String?} optional symbolic name of needed label type
       *
       * @return {String} any textual label or <code>null</code> if none available
       */
      getLabel: function getLabel(object, labelType) {},

      /**
       * Connect a component to the form's underlying model, in a way specified by second argument
       *
       * @param component {qookery.IEditableComponent} editable component that will receive connection
       * @param specification {String} an implementation specific text that will be parsed by the model provider
       *
       * @return {qookery.internal.util.Connection} new connection instance
       */
      connectComponent: function connectComponent(component, specification) {},

      /**
       * Clone an object
       *
       * @param object {any} model object to clone
       */
      clone: function clone(object) {}
    }
  });
  qookery.IModelProvider.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.IModelProvider": {
        "require": true
      },
      "qx.lang.Type": {},
      "qx.lang.Object": {},
      "qx.data.Conversion": {}
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
  qx.Class.define("qookery.impl.DefaultModelProvider", {
    type: "singleton",
    extend: qx.core.Object,
    implement: [qookery.IModelProvider],
    members: {
      identityOf: function identityOf(object) {
        return object != null ? object.toString() : null;
      },
      areEqual: function areEqual(object1, object2) {
        if (object1 instanceof Date && object2 instanceof Date) return object1.getTime() === object2.getTime();
        var id1 = this.identityOf(object1),
            id2 = this.identityOf(object2);

        if (id1 !== undefined && id2 !== undefined) {
          if (qx.lang.Type.isArray(id1) && qx.lang.Type.isArray(id2)) return qx.lang.Object.equals(id1, id2);
          return id1 == id2;
        }

        return object1 === object2;
      },
      compare: function compare(object1, object2) {
        if (object1 === object2) return 0;
        if (object1 == null) return -1;
        if (object2 == null) return 1;
        var type1 = typeof object1;
        var type2 = typeof object2;
        if (type1 !== type2) throw new Error("Unable to compare objects of different type");
        if (type1 === "string") return object1 == object2 ? 0 : object1 > object2 ? 1 : -1;
        if (type1 === "number") return object1 - object2;
        if (type1 === "boolean") return object1 ? 1 : -1;
        if (object1 instanceof Date && object2 instanceof Date) return object1.getTime() - object2.getTime();
        throw new Error("Unsupported object types for comparison");
      },
      convertFrom: function convertFrom(value, className) {
        // No conversion performed by default
        return value;
      },
      convertTo: function convertTo(object, className) {
        // No conversion performed by default
        return object;
      },
      getLabel: function getLabel(object, labelType) {
        if (qx.lang.Type.isString(object)) return object;
        return qx.data.Conversion.toString(object);
      },
      connectComponent: function connectComponent(component, connectionSpecification) {
        // The default model provider expects a Qooxdoo property path in the specification argument
        return component.getForm().addConnection(component, connectionSpecification);
      },
      clone: function clone(object) {
        return object; // Not supported by this model provider
      }
    }
  });
  qookery.impl.DefaultModelProvider.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
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
   * Implementations of this interface provide resources requested by Qookery
   */
  qx.Interface.define("qookery.IResourceLoader", {
    members: {
      /**
       * Return the URI of a named resource
       *
       * <p>This method allows applications to extend or replace default resolution performed
       * by qx.util.ResourceManager</p>
       *
       * @param name {String} the name of the resource
       *
       * @return {String} a URI that can be used to load the resource
       */
      resolveResourceUri: function resolveResourceUri(name) {},

      /**
       * Load a remote resource (sync or async)
       *
       * <p>Calls to this method imply synchronous loading when no success
       * callback has been set</p>
       *
       * @param name {String} name of the wanted resource
       * @param thisArg {Object ? null} optional context for callbacks, may be <code>null</code>
       * @param successCallback {Function} optional function to be called on asynchronous load success
       * @param failCallback {Function} optional function to be called on asynchronous load failure
       */
      loadResource: function loadResource(name, thisArg, successCallback, failCallback) {}
    }
  });
  qookery.IResourceLoader.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.IResourceLoader": {
        "require": true
      },
      "qx.util.ResourceManager": {},
      "qx.bom.request.Xhr": {},
      "qx.util.Request": {},
      "qx.log.Logger": {},
      "qx.lang.String": {}
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
  qx.Class.define("qookery.impl.DefaultResourceLoader", {
    type: "singleton",
    extend: qx.core.Object,
    implement: [qookery.IResourceLoader],
    members: {
      resolveResourceUri: function resolveResourceUri(name) {
        if (name.charAt(0) === "/") return name; // Input argument is an absolute path

        return qx.util.ResourceManager.getInstance().toUri(name);
      },
      loadResource: function loadResource(name, thisArg, successCallback, failCallback) {
        var asynchronous = true;

        if (!successCallback) {
          successCallback = this._defaultSuccessCallback;
          asynchronous = false;
        }

        if (!failCallback) {
          failCallback = this._defaultFailCallback;
        }

        var result;
        var resourceUri = this.resolveResourceUri(name);
        var xhrRequest = new qx.bom.request.Xhr();

        xhrRequest.onerror = xhrRequest.ontimeout = function () {
          result = failCallback.call(thisArg, xhrRequest, name);
        };

        xhrRequest.onload = function () {
          var statusCode = xhrRequest.status;
          var wasSuccessful = qx.util.Request.isSuccessful(statusCode);
          if (wasSuccessful) result = successCallback.call(thisArg, xhrRequest.responseText, name);else result = failCallback.call(thisArg, xhrRequest, name);
        };

        try {
          xhrRequest.open("GET", resourceUri, asynchronous); // When debugging, disable browser cache

          xhrRequest.setRequestHeader("If-Modified-Since", "Thu, 1 Jan 1970 00:00:00 GMT");
          xhrRequest.send();
          return result;
        } catch (e) {
          qx.log.Logger.error(this, "I/O error loading resource", name, e);
          result = failCallback.call(thisArg, xhrRequest, name);
        }

        return result;
      },
      _defaultFailCallback: function _defaultFailCallback(xhrRequest, name) {
        throw new Error(qx.lang.String.format("Error %1 loading resource '%2': %3", [xhrRequest.status, name, xhrRequest.statusText]));
      },
      _defaultSuccessCallback: function _defaultSuccessCallback(responseText, name) {
        return responseText;
      }
    }
  });
  qookery.impl.DefaultResourceLoader.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
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
   * Validators are used by components to instanciate validation functions
   */
  qx.Interface.define("qookery.IValidator", {
    members: {
      /**
       * Create a validation function
       *
       * @param component {qookery.IComponent} component that will receive the new validation
       * @param invalidMessage {String?} message that will be displayed when validation fails
       * @param options {Map?} optional map with validator-specific arguments
       */
      createValidation: function createValidation(component, invalidMessage, options) {}
    }
  });
  qookery.IValidator.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qookery.IValidator": {
        "require": true
      },
      "qx.locale.Manager": {},
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
  qx.Class.define("qookery.internal.validators.ArrayValidator", {
    extend: qx.core.Object,
    implement: [qookery.IValidator],
    type: "singleton",
    construct: function construct() {
      qx.core.Object.constructor.call(this);
    },
    members: {
      createValidation: function createValidation(component, invalidMessage, options) {
        return function (value) {
          if (value === null) return null;
          var message = null;

          if (options["minimumLength"] && value.length < parseInt(options["minimumLength"], 10)) {
            message = invalidMessage || qx.locale.Manager.tr("qookery.internal.validators.ArrayValidator.minimumLength", options["minimumLength"]);
          } else if (options["maximumLength"] && value.length > parseInt(options["maximumLength"], 10)) {
            message = invalidMessage || qx.locale.Manager.tr("qookery.internal.validators.ArrayValidator.maximumLength", options["maximumLength"]);
          }

          if (!message) return null;
          return new qookery.util.ValidationError(component, message, null);
        };
      }
    }
  });
  qookery.internal.validators.ArrayValidator.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qookery.IValidator": {
        "require": true
      },
      "qx.locale.Manager": {},
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
  qx.Class.define("qookery.internal.validators.ComparisonValidator", {
    extend: qx.core.Object,
    implement: [qookery.IValidator],
    type: "singleton",
    construct: function construct() {
      qx.core.Object.constructor.call(this);
    },
    members: {
      createValidation: function createValidation(component, invalidMessage, options) {
        var operator = options["operator"] || "eq";
        var expectedValue = options["value"];
        return function (value) {
          if (value === null) return null;

          switch (operator) {
            case "eq":
              if (value == expectedValue) return null;
              if (!invalidMessage) invalidMessage = qx.locale.Manager.tr("qookery.internal.validators.ComparisonValidator.eq", expectedValue);
              break;

            case "ne":
              if (value != expectedValue) return null;
              if (!invalidMessage) invalidMessage = qx.locale.Manager.tr("qookery.internal.validators.ComparisonValidator.ne", expectedValue);
              break;

            case "gt":
              if (value > expectedValue) return null;
              if (!invalidMessage) invalidMessage = qx.locale.Manager.tr("qookery.internal.validators.ComparisonValidator.gt", expectedValue);
              break;

            case "ge":
              if (value >= expectedValue) return null;
              if (!invalidMessage) invalidMessage = qx.locale.Manager.tr("qookery.internal.validators.ComparisonValidator.ge", expectedValue);
              break;

            case "le":
              if (value <= expectedValue) return null;
              if (!invalidMessage) invalidMessage = qx.locale.Manager.tr("qookery.internal.validators.ComparisonValidator.le", expectedValue);
              break;

            case "lt":
              if (value < expectedValue) return null;
              if (!invalidMessage) invalidMessage = qx.locale.Manager.tr("qookery.internal.validators.ComparisonValidator.lt", expectedValue);
              break;
          }

          return new qookery.util.ValidationError(component, invalidMessage, null);
        };
      }
    }
  });
  qookery.internal.validators.ComparisonValidator.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qookery.IValidator": {
        "require": true
      },
      "qx.locale.Manager": {},
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
  qx.Class.define("qookery.internal.validators.NotNullValidator", {
    extend: qx.core.Object,
    implement: [qookery.IValidator],
    type: "singleton",
    construct: function construct() {
      qx.core.Object.constructor.call(this);
    },
    members: {
      createValidation: function createValidation(component, invalidMessage, options) {
        return function (value) {
          if (value !== null) return null;
          if (!invalidMessage) invalidMessage = qx.locale.Manager.tr("qookery.internal.validators.NotNullValidator.invalidMessage");
          return new qookery.util.ValidationError(component, invalidMessage, null);
        };
      }
    }
  });
  qookery.internal.validators.NotNullValidator.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qookery.IValidator": {
        "require": true
      },
      "qx.locale.Manager": {},
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
  qx.Class.define("qookery.internal.validators.StringValidator", {
    extend: qx.core.Object,
    implement: [qookery.IValidator],
    type: "singleton",
    construct: function construct() {
      qx.core.Object.constructor.call(this);
    },
    members: {
      createValidation: function createValidation(component, invalidMessage, options) {
        return function (value) {
          if (value === null) return null;
          var message = null;

          if (options["regularExpression"] && !options["regularExpression"].test(value)) {
            message = invalidMessage || qx.locale.Manager.tr("qookery.internal.validators.StringValidator.regularExpression");
          } else if (options["minimumLength"] && value.length < parseInt(options["minimumLength"], 10)) {
            message = invalidMessage || qx.locale.Manager.tr("qookery.internal.validators.StringValidator.minimumLength", options["minimumLength"]);
          } else if (options["maximumLength"] && value.length > parseInt(options["maximumLength"], 10)) {
            message = invalidMessage || qx.locale.Manager.tr("qookery.internal.validators.StringValidator.maximumLength", options["maximumLength"]);
          }

          if (!message) return null;
          return new qookery.util.ValidationError(component, message, null);
        };
      }
    }
  });
  qookery.internal.validators.StringValidator.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Assert": {},
      "qookery.IAttributeSet": {}
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
   * Implementations of this interface create layout managers according to input arguments
   */
  qx.Interface.define("qookery.ILayoutFactory", {
    members: {
      /**
       * Create a new layout
       *
       * @param attributes {qookery.IAttributeSet} set of attributes that may be of use for configuring new layout
       *
       * @return {qx.ui.layout.Abstract} created layout
       */
      createLayout: function createLayout(attributes) {
        qx.core.Assert.assertArgumentsCount(arguments, 1, 1);
        qx.core.Assert.assertInterface(attributes, qookery.IAttributeSet);
      }
    }
  });
  qookery.ILayoutFactory.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.layout.Basic": {}
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
  qx.Class.define("qookery.internal.layouts.BasicLayoutFactory", {
    extend: qx.core.Object,
    implement: [qookery.ILayoutFactory],
    type: "singleton",
    members: {
      createLayout: function createLayout(attributes) {
        var layout = new qx.ui.layout.Basic();
        return layout;
      }
    }
  });
  qookery.internal.layouts.BasicLayoutFactory.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.Qookery": {},
      "qx.ui.layout.Flow": {}
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
  qx.Class.define("qookery.internal.layouts.FlowLayoutFactory", {
    extend: qx.core.Object,
    implement: [qookery.ILayoutFactory],
    type: "singleton",
    members: {
      createLayout: function createLayout(attributes) {
        var defaultSpacingX = qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_LAYOUT_SPACING_X, 0);
        var defaultSpacingY = qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_LAYOUT_SPACING_Y, 0);
        var layout = new qx.ui.layout.Flow(defaultSpacingX, defaultSpacingY, "left");
        var alignX = attributes.getAttribute("layout-align-x");
        if (alignX != null) layout.setAlignX(alignX);
        var alignY = attributes.getAttribute("layout-align-y");
        if (alignY != null) layout.setAlignY(alignY);
        var reversed = attributes.getAttribute("reversed");
        if (reversed != null) layout.setReversed(reversed);
        var spacing = attributes.getAttribute("spacing");

        if (spacing != null) {
          layout.setSpacingX(spacing);
          layout.setSpacingY(spacing);
        }

        var spacingX = attributes.getAttribute("spacing-x");
        if (spacingX != null) layout.setSpacingX(spacingX);
        var spacingY = attributes.getAttribute("spacing-y");
        if (spacingY != null) layout.setSpacingY(spacingY);
        return layout;
      }
    }
  });
  qookery.internal.layouts.FlowLayoutFactory.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.Qookery": {},
      "qx.ui.layout.Grid": {},
      "qx.util.StringSplit": {}
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
  qx.Class.define("qookery.internal.layouts.GridLayoutFactory", {
    extend: qx.core.Object,
    implement: [qookery.ILayoutFactory],
    type: "singleton",
    statics: {
      /* Patch layout with automatic child row-column assignment code*/
      __patchLayout: function __patchLayout(layout, attributes) {
        var configureFunction = function configureFunction(widget) {
          qookery.internal.layouts.GridLayoutFactory.__configureWidget.call(configureFunction, widget);
        };

        configureFunction.rowArray = null;
        configureFunction.currentRow = 0;
        configureFunction.currentColumn = 0;
        var columnCount = attributes.getAttribute("column-count", 1);

        if (columnCount !== "auto") {
          configureFunction.rowArray = [];

          for (var i = 0; i < columnCount; i++) configureFunction.rowArray.push(0);
        }

        layout.configureWidget = configureFunction;
      },

      /* Perform automatic row-column assignment for a new child, if needed */
      __configureWidget: function __configureWidget(widget) {
        var properties = widget.getLayoutProperties();
        if (properties["row"] != null && properties["column"] != null) return;
        var colSpan = properties["colSpan"] || 1;
        var rowSpan = properties["rowSpan"] || 1;

        if (this.rowArray == null) {
          widget.setLayoutProperties({
            row: 0,
            column: this.currentColumn,
            colSpan: colSpan
          });
          this.currentColumn += colSpan;
          return;
        }

        while (this.rowArray[this.currentColumn] > 0) {
          this.rowArray[this.currentColumn]--;
          this.currentColumn++;

          if (this.currentColumn >= this.rowArray.length) {
            this.currentColumn = 0;
            this.currentRow++;
          }
        }

        widget.setLayoutProperties({
          row: this.currentRow,
          column: this.currentColumn,
          colSpan: colSpan,
          rowSpan: rowSpan
        });

        for (var j = 0; j < colSpan; j++) {
          this.rowArray[this.currentColumn] += rowSpan - 1;
          this.currentColumn++;
        }

        if (this.currentColumn >= this.rowArray.length) {
          this.currentColumn = 0;
          this.currentRow++;
        }
      }
    },
    members: {
      createLayout: function createLayout(attributes) {
        var defaultSpacingX = qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_LAYOUT_SPACING_X, 0);
        var defaultSpacingY = qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_LAYOUT_SPACING_Y, 0);
        var layout = new qx.ui.layout.Grid(defaultSpacingX, defaultSpacingY);
        var spacing = attributes.getAttribute("spacing");

        if (spacing != null) {
          layout.setSpacingX(spacing);
          layout.setSpacingY(spacing);
        }

        var spacingX = attributes.getAttribute("spacing-x");
        if (spacingX != null) layout.setSpacingX(spacingX);
        var spacingY = attributes.getAttribute("spacing-y");
        if (spacingY != null) layout.setSpacingY(spacingY);
        var columnFlexes = attributes.getAttribute("column-flexes");
        if (columnFlexes != null) qx.util.StringSplit.split(columnFlexes, /\s+/).forEach(function (columnFlex, index) {
          layout.setColumnFlex(index, parseInt(columnFlex, 10));
        }, this);
        var rowFlexes = attributes.getAttribute("row-flexes");
        if (rowFlexes != null) qx.util.StringSplit.split(rowFlexes, /\s+/).forEach(function (rowFlex, index) {
          layout.setRowFlex(index, parseInt(rowFlex, 10));
        }, this);

        qookery.internal.layouts.GridLayoutFactory.__patchLayout(layout, attributes);

        return layout;
      }
    }
  });
  qookery.internal.layouts.GridLayoutFactory.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
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
      "qookery.Qookery": {},
      "qx.ui.layout.HBox": {}
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
  qx.Class.define("qookery.internal.layouts.HBoxLayoutFactory", {
    extend: qx.core.Object,
    implement: [qookery.ILayoutFactory],
    type: "singleton",
    members: {
      createLayout: function createLayout(attributes) {
        var defaultSpacingX = qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_LAYOUT_SPACING_X, 0);
        var layout = new qx.ui.layout.HBox(defaultSpacingX);
        var alignX = attributes.getAttribute("layout-align-x");
        if (alignX != null) layout.setAlignX(alignX);
        var alignY = attributes.getAttribute("layout-align-y");
        if (alignY != null) layout.setAlignY(alignY);
        var reversed = attributes.getAttribute("reversed");
        if (reversed != null) layout.setReversed(reversed);
        var separator = attributes.getAttribute("separator");
        if (separator != null) layout.setSeparator(separator);
        var spacing = attributes.getAttribute("spacing");
        if (spacing != null) layout.setSpacing(spacing);
        return layout;
      }
    }
  });
  qookery.internal.layouts.HBoxLayoutFactory.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.Qookery": {},
      "qx.ui.layout.VBox": {}
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
  qx.Class.define("qookery.internal.layouts.VBoxLayoutFactory", {
    extend: qx.core.Object,
    implement: [qookery.ILayoutFactory],
    type: "singleton",
    members: {
      createLayout: function createLayout(attributes) {
        var defaultSpacingY = qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_LAYOUT_SPACING_Y, 0);
        var layout = new qx.ui.layout.VBox(defaultSpacingY);
        var alignX = attributes.getAttribute("layout-align-x");
        if (alignX != null) layout.setAlignX(alignX);
        var alignY = attributes.getAttribute("layout-align-y");
        if (alignY != null) layout.setAlignY(alignY);
        var reversed = attributes.getAttribute("reversed");
        if (reversed != null) layout.setReversed(reversed);
        var separator = attributes.getAttribute("separator");
        if (separator != null) layout.setSeparator(separator);
        var spacing = attributes.getAttribute("spacing");
        if (spacing != null) layout.setSpacing(spacing);
        return layout;
      }
    }
  });
  qookery.internal.layouts.VBoxLayoutFactory.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
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
   * Represents a supplier of attributes
   */
  qx.Interface.define("qookery.IAttributeSet", {
    members: {
      /**
       * Return an attribute's value if defined, or a default value if missing
       *
       * <p>You may supply the <code>Error</code> JS build-in object as the default value parameter
       * in order to request that a range error is thrown when attribute is missing.</p>
       *
       * @param name {String} the name of the wanted attribute
       * @param defaultValue {any} optional default value, <code>undefined</code> will be used if not provided
       *
       * @return {any} attribute's value or requested default value if attribute is not defined within the set
       *
       * @throws {RangeError} in case attribute is not part of the set and the default value was set to <code>Error</code>
       */
      getAttribute: function getAttribute(name, defaultValue) {}
    }
  });
  qookery.IAttributeSet.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.IAttributeSet": {
        "require": true
      }
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
   * Interface implemented by all Qookery components
   */
  qx.Interface.define("qookery.IComponent", {
    extend: qookery.IAttributeSet,
    statics: {
      // Attribute names

      /** {String} Symbolic name of component, unique within its containing form */
      A_ID: "{http://www.qookery.org/ns/Form}id",

      /** {Map} Mapping of prefixes to namespace URIs to associate with component, set by parser after instantiation */
      A_NAMESPACES: "{http://www.qookery.org/ns/Form}namespaces"
    },
    properties: {
      /** Whether the component is enabled */
      enabled: {
        init: true,
        check: "Boolean"
      },

      /** Whether the component is visible */
      visibility: {
        init: "visible",
        check: ["visible", "hidden", "excluded"]
      }
    },
    members: {
      // Metadata

      /**
       * Return the component identifier, if any
       *
       * <p>This identifier is guaranteed to be unique within the defining XML document</p>
       *
       * @return {String} unique identifier or <code>null</code>
       */
      getId: function getId() {},

      /**
       * Return the type of an attribute
       *
       * @param attributeName {String} name of the attribute
       *
       * @return {String} attribute's type or <code>null</code> if unknown
       */
      getAttributeType: function getAttributeType(attributeName) {},

      /**
       * Set an attribute's value
       *
       * <p>NB: Few attributes are expected by implementations to be modified this way - be sure
       * to check component documentation for supported changes.</p>
       *
       * @param attributeName {String} the name of the attribute to change
       * @param value {any} the new attribute value, <code>undefined</code> clears attribute
       */
      setAttribute: function setAttribute(attributeName, value) {},
      // Namespaces

      /**
       * Resolve a URI namespace prefix
       *
       * @param prefix {String} the prefix to resolve
       *
       * @return {String?} namespace URI or <code>null</code> if prefix is unknown
       */
      resolveNamespacePrefix: function resolveNamespacePrefix(prefix) {},

      /**
       * Resolve a QName
       *
       * <p>The result format is "{" + Namespace URI + "}" + local part. If the namespace URI is empty,
       * only the local part is returned.</p>
       *
       * @param qName {String} the QName to resolve
       *
       * @return {String} the string representation of the resolved QName
       */
      resolveQName: function resolveQName(qName) {},
      // Lifecycle

      /**
       * Called by the form parser soon after initialization and attribute parsing
       *
       * <p>Notice: You must never call this method directly.</p>
       *
       * @param attributes {Map} preprocessed attributes found in the defining XML document
       */
      create: function create(attributes) {},

      /**
       * Called by the parser when an unknown XML element is encountered within a component's declaration
       *
       * <p>Notice: You must never call this method directly.</p>
       *
       * @param elementName {String} the resolved fully-qualified name of encountered DOM element
       * @param element {Element} the DOM element that is not understood by parser
       *
       * @return {Boolean} <code>true</code> in case the component was able to do something with input
       */
      parseXmlElement: function parseXmlElement(elementName, element) {},

      /**
       * Called by the parser after creation of the component and all its children
       *
       * <p>Notice: You must never call this method directly.</p>
       */
      setup: function setup() {},
      // Access to other components

      /**
       * Return the form containing this component
       *
       * @return {qookery.IFormComponent} the form containing this component
       */
      getForm: function getForm() {},

      /**
       * Return the parent component or <code>null</cide> if this is the root component
       *
       * @return {qookery.IComponent} parent component or <code>null</code>
       */
      getParent: function getParent() {},
      // Scripting

      /**
       * Evaluate a Qookery expression within component's scripting context
       *
       * @param expression {String} a valid JavaScript expression
       *
       * @return {any} the evaluation result
       */
      evaluateExpression: function evaluateExpression(expression) {},

      /**
       * Execute Qookery scripting code on component
       *
       * @param clientCode {String} a valid Qookery script
       * @param argumentMap {Map?} a map to be passed as arguments to the script
       *
       * @return {any} the script result
       */
      executeClientCode: function executeClientCode(clientCode, argumentMap) {},
      // User interface

      /**
       * Set the focus to this component
       */
      focus: function focus() {},

      /**
       * Return a list of widgets that are handled by this component
       *
       * @param filterName {String} if set, one of 'topMost', 'main' to restrict resulting list
       *
       * @return {qx.ui.core.Widget[]} widget list - an empty array if none found
       */
      listWidgets: function listWidgets(filterName) {},

      /**
       * Return the main widget
       *
       * <p>This method a shorthand for #listWidgets('main')[0]</p>
       *
       * @return {qx.ui.core.Widget} the main widget
       */
      getMainWidget: function getMainWidget() {},

      /**
       * Add an event handler to this component
       *
       * @param eventName {String} the name of the event to listen to
       * @param handler {Function} a function to execute when the event is triggered
       * @param onlyOnce {Boolean} if <code>true</code>, the listener will be removed as soon as it triggered for the first time
       */
      addEventHandler: function addEventHandler(eventName, handler, onlyOnce) {},
      // Actions

      /**
       * Check whether the action exist or not.
       *
       * @param actionName {String} the name of the action
       * @return {Boolean} whether the action exists
       */
      isActionSupported: function isActionSupported(actionName) {},

      /**
       * Execute an action provided by this component
       *
       * <p>It is safe to call this method for undefined actions,
       * in which case <code>null</code> is returned.</p>
       *
       * @param actionName {String} one the actions provided by component
       * @param varargs {any} any number of arguments that will be passed to action's function
       *
       * @return {any} the action's execution result
       */
      executeAction: function executeAction(actionName, varargs) {},
      // Miscellaneous

      /**
       * Request validation of component state and contents
       *
       * <p>NB: Components should not return errors when disabled, hidden or excluded.</p>
       *
       * @return {qookery.util.ValidationError} discovered validation error or <code>null</code> if component is valid
       */
      validate: function validate() {},

      /**
       * Return a translated message
       *
       * @param messageId {String} the identifier of the wanted message
       */
      tr: function tr(messageId) {},

      /**
       * Add a disposable to the list of objects that will be disposed automatically together with component
       *
       * @param disposable {Object} any object that has a <code>dispose</code> property that is a function
       */
      addToDisposeList: function addToDisposeList(disposable) {}
    }
  });
  qookery.IComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qookery.IComponent": {
        "require": true
      },
      "qookery.internal.Registry": {},
      "qx.lang.String": {},
      "qookery.util.Xml": {},
      "qx.lang.Object": {},
      "qx.lang.Array": {},
      "qookery.util.Debug": {},
      "qx.locale.Manager": {},
      "qx.lang.Type": {}
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
   * Base class for all Qookery components.
   */
  qx.Class.define("qookery.internal.components.Component", {
    type: "abstract",
    extend: qx.core.Object,
    implement: [qookery.IComponent],
    statics: {
      __LAYOUT_ITEM_PROPERTY_MAP: {
        "col-span": "colSpan",
        "column": "column",
        "flex": "flex",
        "left": "left",
        "line-break": "lineBreak",
        "row": "row",
        "row-span": "rowSpan",
        "stretch": "stretch",
        "top": "top"
      }
    },
    properties: {
      enabled: {
        init: true,
        check: "Boolean",
        inheritable: true,
        apply: "_applyEnabled"
      },
      visibility: {
        init: "visible",
        check: ["visible", "hidden", "excluded"],
        inheritable: true,
        apply: "_applyVisibility"
      }
    },
    construct: function construct(parentComponent) {
      qx.core.Object.constructor.call(this);
      this.__parentComponent = parentComponent;
      this.__attributes = {};
      this.__actions = {};
      this._widgets = [];
    },
    members: {
      __parentComponent: null,
      __attributes: null,
      __actions: null,
      __namespaceResolver: null,
      __disposeList: null,
      _widgets: null,
      // Metadata
      getId: function getId() {
        return this.getAttribute(qookery.IComponent.A_ID);
      },
      getAttributeType: function getAttributeType(attributeName) {
        return qookery.internal.Registry.getInstance().getAttributeType(attributeName);
      },
      getAttribute: function getAttribute(attributeName, defaultValue) {
        var value = this.__attributes[attributeName];
        if (value !== undefined) return value;
        if (defaultValue === Error) throw new RangeError(qx.lang.String.format("Required attribute '%1' missing from '%2'", [attributeName, this]));
        return defaultValue;
      },
      setAttribute: function setAttribute(attributeName, value) {
        if (value === undefined) delete this.__attributes[attributeName];else this.__attributes[attributeName] = value;
      },
      // Namespaces
      resolveNamespacePrefix: function resolveNamespacePrefix(prefix) {
        var namespaces = this.getAttribute(qookery.IComponent.A_NAMESPACES);

        if (namespaces != null) {
          var namespaceUri = namespaces[prefix];
          if (namespaceUri != null) return namespaceUri;
        }

        var parent = this.getParent();
        if (parent != null) return parent.resolveNamespacePrefix(prefix);
        return null;
      },
      resolveQName: function resolveQName(qName) {
        var resolver = this.__namespaceResolver;
        if (resolver == null) resolver = this.__namespaceResolver = this.resolveNamespacePrefix.bind(this);
        return qookery.util.Xml.resolveQName(resolver, qName);
      },
      // Lifecycle
      create: function create(attributes) {
        // Attention: If overriden, base must be called early in order to setup initial attributes
        for (var attributeName in attributes) {
          this.setAttribute(attributeName, attributes[attributeName]);
        }

        this._widgets = this._createWidgets();

        this._registerWithWidgets();

        this._applyAttribute("enabled", this, "enabled");

        this._applyAttribute("visibility", this, "visibility");
      },
      parseXmlElement: function parseXmlElement(elementName, xmlElement) {
        // Override to implement custom elements
        return false;
      },
      setup: function setup() {// Nothing to do here, override if needed
      },
      // Access to other components
      getForm: function getForm() {
        if (!this.__parentComponent) return null;
        return this.__parentComponent.getForm();
      },
      getParent: function getParent() {
        return this.__parentComponent;
      },
      setAction: function setAction(actionName, scriptFunction) {
        this.__actions[actionName] = scriptFunction;
      },
      listWidgets: function listWidgets(filterName) {
        return this._widgets;
      },
      getMainWidget: function getMainWidget() {
        return this.listWidgets("main")[0];
      },
      focus: function focus() {
        this.getMainWidget().focus();
      },
      addEventHandler: function addEventHandler(eventName, handler, onlyOnce) {
        var receiver = null;

        if (qx.Class.supportsEvent(this.constructor, eventName)) {
          receiver = this;
        } else {
          var mainWidget = this.getMainWidget();
          if (mainWidget != null && qx.Class.supportsEvent(mainWidget.constructor, eventName)) receiver = mainWidget;
        }

        if (!receiver) throw new Error(qx.lang.String.format("Event '%1' not supported", [eventName]));
        var methodName = onlyOnce ? "addListenerOnce" : "addListener";
        receiver[methodName](eventName, handler, this);
      },
      executeAction: function executeAction(actionName, varargs) {
        var actionFunction = this.__actions[actionName];
        if (actionFunction == null) return null;
        var actionArguments = Array.prototype.slice.call(arguments, 1);
        return actionFunction.apply(this, actionArguments);
      },
      evaluateExpression: function evaluateExpression(expression) {
        return this.executeClientCode("return (" + expression + ");", null);
      },
      executeClientCode: function executeClientCode(clientCode, argumentMap) {
        var clientCodeContext = this.getForm().getScriptingContext();

        try {
          argumentMap = argumentMap || {};
          var keys = Object.keys(argumentMap);
          var values = qx.lang.Object.getValues(argumentMap);
          qx.lang.Array.insertAt(keys, "$", 0);
          qx.lang.Array.insertAt(values, clientCodeContext, 0);
          var clientFunction = new Function(keys, clientCode);
          return clientFunction.apply(this, values);
        } catch (error) {
          qookery.util.Debug.logScriptError(this, clientCode, error);
          throw error;
        }
      },
      isActionSupported: function isActionSupported(actionName) {
        return this.__actions[actionName] !== undefined;
      },
      validate: function validate() {
        // Override to implement component validation
        return null;
      },
      tr: function tr(messageId, varArgs) {
        if (!messageId) return null;
        var manager = qx.locale.Manager;
        if (!manager) return messageId;
        if (messageId.charAt(0) === ".") messageId = (this.getForm().getTranslationPrefix() || "") + messageId;else if (messageId.charAt(0) === "$") messageId = this.classname + messageId;
        var formatArguments = qx.lang.Array.fromArguments(arguments, 1);
        return qx.locale.Manager.getInstance().translate(messageId, formatArguments);
      },
      addToDisposeList: function addToDisposeList(disposable) {
        if (!this.__disposeList) this.__disposeList = [];

        this.__disposeList.push(disposable);
      },
      toString: function toString() {
        var hash = this.getId() || this.$$hash;
        var form = this.getForm();
        if (form != null && form.getId() != null) hash = form.getId() + "#" + hash;
        return this.classname + "[" + hash + "]";
      },
      // Protected methods for internal use
      _createWidgets: function _createWidgets() {
        // Subclasses are advised to implement this method instead of overriding create()
        return this._widgets;
      },

      /**
       * Add component information to its widgets
       */
      _registerWithWidgets: function _registerWithWidgets() {
        if (this._widgets.length === 0) throw new Error("Component failed to create at least one widget");

        for (var i = 0; i < this._widgets.length; i++) this._widgets[i].setUserData("qookeryComponent", this);

        if (this.getId()) this.getMainWidget().getContentElement().setAttribute("qkid", this.getId());
      },
      _applyAttribute: function _applyAttribute(attributeName, target, propertyName, defaultValue) {
        var value = this.getAttribute(attributeName, defaultValue);
        if (value === undefined) return false;

        if (qx.lang.Type.isFunction(propertyName)) {
          propertyName.call(target, value);
          return true;
        }

        if (propertyName == null) {
          propertyName = attributeName.replace(/-([a-z])/g, function (g) {
            return g[1].toUpperCase();
          });
        }

        target.set(propertyName, value);
        return true;
      },

      /**
       * Apply common attributes to a widget
       *
       * @param widget {qx.ui.core.Widget} widget to receive layout properties
       */
      _applyWidgetAttributes: function _applyWidgetAttributes(widget) {
        // Size and position
        this._applyAttribute("width", widget, "width");

        this._applyAttribute("height", widget, "height");

        this._applyAttribute("min-width", widget, "minWidth");

        this._applyAttribute("min-height", widget, "minHeight");

        this._applyAttribute("max-width", widget, "maxWidth");

        this._applyAttribute("max-height", widget, "maxHeight");

        this._applyAttribute("align-x", widget, "alignX");

        this._applyAttribute("align-y", widget, "alignY");

        this._applyAttribute("allow-grow", widget, "allowGrowX");

        this._applyAttribute("allow-grow", widget, "allowGrowY");

        this._applyAttribute("allow-grow-x", widget, "allowGrowX");

        this._applyAttribute("allow-grow-y", widget, "allowGrowY");

        this._applyAttribute("allow-shrink", widget, "allowShrinkX");

        this._applyAttribute("allow-shrink", widget, "allowShrinkY");

        this._applyAttribute("allow-shrink-x", widget, "allowShrinkX");

        this._applyAttribute("allow-shrink-y", widget, "allowShrinkY");

        this._applyAttribute("allow-stretch", widget, "allowStretchX");

        this._applyAttribute("allow-stretch", widget, "allowStretchY");

        this._applyAttribute("allow-stretch-x", widget, "allowStretchX");

        this._applyAttribute("allow-stretch-y", widget, "allowStretchY");

        this._applyAttribute("margin", widget, "margin");

        this._applyAttribute("margin-top", widget, "marginTop");

        this._applyAttribute("margin-right", widget, "marginRight");

        this._applyAttribute("margin-bottom", widget, "marginBottom");

        this._applyAttribute("margin-left", widget, "marginLeft");

        this._applyAttribute("padding", widget, "padding");

        this._applyAttribute("padding-top", widget, "paddingTop");

        this._applyAttribute("padding-right", widget, "paddingRight");

        this._applyAttribute("padding-bottom", widget, "paddingBottom");

        this._applyAttribute("padding-left", widget, "paddingLeft"); // Appearance


        this._applyAttribute("appearance", widget, "appearance");

        this._applyAttribute("cursor", widget, "cursor");

        this._applyAttribute("decorator", widget, "decorator");

        this._applyAttribute("font", widget, "font");

        this._applyAttribute("text-color", widget, "textColor");

        this._applyAttribute("background-color", widget, "backgroundColor");

        this._applyAttribute("tool-tip-text", widget, "toolTipText");

        this._applyAttribute("tool-tip-icon", widget, "toolTipIcon"); // Miscellaneous


        this._applyAttribute("draggable", widget, "draggable");

        this._applyAttribute("droppable", widget, "droppable");

        this._applyAttribute("focusable", widget, "focusable");

        this._applyAttribute("tab-index", widget, "tabIndex"); // Layout item properties


        var layoutProperties = null;
        var layoutPropertyMap = qookery.internal.components.Component.__LAYOUT_ITEM_PROPERTY_MAP;

        for (var attributeName in layoutPropertyMap) {
          var value = this.getAttribute(attributeName, undefined);
          if (value === undefined) continue;
          if (layoutProperties == null) layoutProperties = {};
          layoutProperties[layoutPropertyMap[attributeName]] = value;
        }

        if (layoutProperties != null) widget.setLayoutProperties(layoutProperties);
      },
      _applyEnabled: function _applyEnabled(enabled) {
        var widgets = this.listWidgets();

        for (var i = 0; i < widgets.length; i++) {
          var widget = widgets[i];
          widget.setEnabled(enabled);
        }
      },
      _applyVisibility: function _applyVisibility(visibility) {
        var widgets = this.listWidgets();

        for (var i = 0; i < widgets.length; i++) {
          var widget = widgets[i];
          widget.setVisibility(visibility);
        }
      }
    },
    destruct: function destruct() {
      this._disposeArray("__disposeList");

      var widgets = this.listWidgets();

      for (var i = 0; i < widgets.length; i++) {
        var widget = widgets[i];
        if (widget == null) continue;
        widget.destroy();
      }

      delete this.__actions;
      this.__parentComponent = null;
      this.__attributes = null;
    }
  });
  qookery.internal.components.Component.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      }
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
  qx.Class.define("qookery.internal.components.AtomComponent", {
    type: "abstract",
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "center":
            return "Boolean";

          case "gap":
            return "Number";

          case "rich":
            return "Boolean";

          case "show":
            return "String";
        }

        return qookery.internal.components.AtomComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createWidgets: function _createWidgets() {
        var atom = this._createAtomWidget();

        return [atom];
      },
      _createAtomWidget: function _createAtomWidget() {
        throw new Error("Override _createAtomWidget() to provide implementation specific code");
      },
      _applyAtomAttributes: function _applyAtomAttributes(atom) {
        this._applyAttribute("center", atom, "center");

        this._applyAttribute("gap", atom, "gap");

        this._applyAttribute("icon", atom, "icon");

        this._applyAttribute("icon-position", atom, "iconPosition");

        this._applyAttribute("label", atom, "label");

        this._applyAttribute("rich", atom, "rich");

        this._applyAttribute("show", atom, "show");

        this._applyAttribute("text-align", this, function (textAlign) {
          atom.getChildControl("label").setAllowGrowX(true);
          atom.getChildControl("label").setTextAlign(textAlign);
        });

        this._applyWidgetAttributes(atom);
      },
      getLabel: function getLabel() {
        return this.getMainWidget().getLabel();
      },
      setLabel: function setLabel(label) {
        this.getMainWidget().setLabel(label);
      },
      getIcon: function getIcon() {
        return this.getMainWidget().getIcon();
      },
      setIcon: function setIcon(icon) {
        this.getMainWidget().setIcon(icon);
      }
    }
  });
  qookery.internal.components.AtomComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.AtomComponent": {
        "construct": true,
        "require": true
      },
      "qookery.Qookery": {},
      "qx.ui.form.Button": {}
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
  qx.Class.define("qookery.internal.components.ButtonComponent", {
    extend: qookery.internal.components.AtomComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AtomComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createAtomWidget: function _createAtomWidget() {
        var button = this._createButton();

        this._applyAttribute("command", this, function (commandName) {
          var command = qookery.Qookery.getRegistry().getCommand(commandName);
          if (command == null) throw new Error("Undefined command " + commandName);
          button.setCommand(command);
        });

        this._applyAtomAttributes(button);

        return button;
      },
      _createButton: function _createButton() {
        return new qx.ui.form.Button();
      },
      setValue: function setValue(buttonLabelValue) {
        // BCC Qookery: Method kept for compatibilty with former way of setting label
        this.getMainWidget().setLabel(buttonLabelValue);
      },
      getCommand: function getCommand() {
        return this.getMainWidget().getCommand();
      },
      setCommand: function setCommand(command) {
        this.getMainWidget().setCommand(command);
      },
      execute: function execute() {
        this.getMainWidget().execute();
      }
    }
  });
  qookery.internal.components.ButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.IComponent": {
        "require": true
      }
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
   * Interface for components that support value editing
   */
  qx.Interface.define("qookery.IEditableComponent", {
    extend: qookery.IComponent,
    properties: {
      /** Component's current value */
      value: {
        event: "changeValue"
      },

      /** Label which will be displayed close to component's interactive widgets */
      label: {
        check: "String",
        nullable: true
      },

      /** Tooltip text to display when the user hovers the mouse over the component's interactive widgets */
      toolTipText: {
        check: "String",
        nullable: true
      },

      /** Whether the component's value is required */
      required: {
        check: "Boolean",
        nullable: false,
        init: false
      },

      /** Whether the component's widget state is valid or not */
      valid: {
        check: "Boolean",
        nullable: false,
        init: true
      },

      /** A format to be used when displaying values */
      format: {
        check: "qx.util.format.IFormat",
        nullable: true
      },

      /** If true, this editor's value cannot be altered by its UI widgets */
      readOnly: {
        check: "Boolean",
        nullable: false,
        init: false
      }
    },
    members: {
      // User interface

      /**
       * Update the component's user interface to reflect given value
       *
       * <p>This method will do nothing in case an update is already in progress or the component has been disposed</p>
       *
       * @param value {any?} if <code>undefined</code>, automatically use component's current value
       *
       * @retun {Boolean} <code>true</code> in case the update was performed
       */
      updateUI: function updateUI(value) {},
      // Model connection

      /**
       * Create a two way binding between form's model and component's value
       *
       * <p>This method will automatically disconnect existing connection, if any.</p>
       *
       * @param connectionSpecification {String} a model-provider specific specification, instrumenting connection
       */
      connect: function connect(connectionSpecification) {},

      /**
       * Remove connection created by #connect(), if any
       */
      disconnect: function disconnect() {},
      // Validation

      /**
       * Add a validation to this component
       *
       * @param validatorType {String} name of a registered Qookery validator
       * @param invalidMessage {String?null} error message to use in case of validation failure, <code>null</code> for default one(s)
       * @param options {Map?null} validator specific options
       *
       * @return {any} an opaque handle that may be used to remove the validation in the future
       */
      addValidation: function addValidation(validatorType, invalidMessage, options) {},

      /**
       * Remove a validation from this component
       *
       * @param validation {Object} the value returned by a former call to #addValidation()
       */
      removeValidation: function removeValidation(validation) {},

      /**
       * Remove all validations from this component
       */
      removeAllValidations: function removeAllValidations() {}
    }
  });
  qookery.IEditableComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.IEditableComponent": {
        "require": true
      },
      "qookery.internal.components.Component": {
        "construct": true,
        "require": true
      },
      "qx.ui.basic.Label": {},
      "qx.lang.String": {},
      "qookery.Qookery": {},
      "qx.lang.Array": {},
      "qx.core.ValidationError": {},
      "qx.type.BaseError": {},
      "qookery.util.ValidationError": {},
      "qx.lang.Type": {},
      "qx.data.Conversion": {}
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
   * Extend this class if you want to create a new component that bind a value.
   */
  qx.Class.define("qookery.internal.components.EditableComponent", {
    type: "abstract",
    implement: [qookery.IEditableComponent],
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
      this.__validations = [];
    },
    properties: {
      value: {
        init: null,
        inheritable: true,
        nullable: true,
        apply: "_applyValue",
        transform: "_transformValue",
        event: "changeValue"
      },
      label: {
        check: "String",
        inheritable: true,
        nullable: true,
        apply: "_applyLabel"
      },
      toolTipText: {
        check: "String",
        inheritable: true,
        nullable: true,
        apply: "_applyToolTipText"
      },
      required: {
        check: "Boolean",
        inheritable: true,
        nullable: false,
        init: false,
        apply: "_applyRequired"
      },
      readOnly: {
        check: "Boolean",
        inheritable: true,
        nullable: false,
        init: false,
        apply: "_applyReadOnly"
      },
      format: {
        check: "qx.util.format.IFormat",
        inheritable: true,
        nullable: true,
        init: null,
        apply: "_applyFormat",
        transform: "_transformFormat"
      },
      valid: {
        check: "Boolean",
        nullable: false,
        apply: "_applyValid"
      }
    },
    members: {
      _disableValueEvents: false,
      __validations: null,
      __requiredValidation: null,
      __connection: null,
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "create-label":
            return "Boolean";

          default:
            return qookery.internal.components.EditableComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      // Initialization
      create: function create(attributes) {
        qookery.internal.components.EditableComponent.prototype.create.base.call(this, attributes);

        this._applyAttribute("required", this, "required", false);

        this._applyAttribute("read-only", this, "readOnly", false);

        this._applyAttribute("format", this, "format");

        this._applyAttribute("label", this, "label");

        var liveValidate = this.getAttribute("live-validate", "false");

        switch (liveValidate) {
          case "component":
            this.addListener("changeValue", function () {
              this.validate();
            }, this);
            break;

          case "form":
            this.addListener("changeValue", function () {
              this.getForm().validate();
            }, this);
            break;
        }
      },
      _createWidgets: function _createWidgets() {
        var mainWidget = this._createMainWidget();

        if (this.getAttribute("create-label", true)) {
          var label = new qx.ui.basic.Label();

          this._setupLabelAppearance(label);

          return [mainWidget, label];
        }

        return [mainWidget];
      },
      _createMainWidget: function _createMainWidget() {
        throw new Error("Override _createMainWidget() to provide implementation specific code");
      },
      setup: function setup() {
        var connectionSpecification = this.getAttribute("connect");

        if (connectionSpecification != null) {
          this.connect(connectionSpecification);
        }

        var initializeClientCode = this.getAttribute("initialize");

        if (initializeClientCode) {
          var initialValue = this.executeClientCode(qx.lang.String.format("return (%1);", [initializeClientCode]));
          this.setValue(initialValue);
        }

        return qookery.internal.components.EditableComponent.prototype.setup.base.call(this);
      },
      // Widget access
      listWidgets: function listWidgets(filterName) {
        var mainWidget = this._widgets[0];
        if (filterName == "main") return [mainWidget];
        var labelWidget = this._widgets[1];
        if (!labelWidget) return [mainWidget]; // Reverse order of main and label widget since
        // we want to present the label in front of the editor

        return [labelWidget, mainWidget];
      },
      getEditableWidget: function getEditableWidget() {
        return this.getMainWidget();
      },
      getLabelWidget: function getLabelWidget() {
        return this._widgets[1];
      },
      // Model connection and UI
      connect: function connect(connectionSpecification) {
        this.disconnect();
        var modelProvider = this.getForm().getModelProvider();
        if (modelProvider == null) throw new Error("Install a model provider to handle connections in XML forms");
        var connection = modelProvider.connectComponent(this, connectionSpecification);
        if (connection == null) throw new Error("Model provider failed to provide a connection");

        this._applyConnection(modelProvider, connection);

        this.__connection = connection;
      },
      disconnect: function disconnect() {
        if (this.__connection == null) return;
        this.getForm().removeConnection(this.__connection);
        this.__connection = null;
      },
      updateUI: function updateUI(value) {
        if (this._disableValueEvents || this.isDisposed()) return false;
        if (value === undefined) value = this.getValue();
        this._disableValueEvents = true;

        try {
          this._updateUI(value);

          return true;
        } catch (e) {
          throw e;
        } finally {
          this._disableValueEvents = false;
        }
      },
      _applyConnection: function _applyConnection(modelProvider, connection) {
        // Subclasses may extend or override below functionality to support more attributes
        if (this.getLabel() == null) {
          var connectionLabel = connection.getAttribute("label");
          if (connectionLabel != null) this.setLabel(connectionLabel);
        }

        if (this.getFormat() == null) {
          var formatSpecification = connection.getAttribute("format");
          if (formatSpecification != null) this.setFormat(qookery.Qookery.getRegistry().createFormat(formatSpecification));
        }

        if (this.getToolTipText() == null) {
          var toolTipText = connection.getAttribute("tool-tip-text");
          if (toolTipText != null) this.setToolTipText(toolTipText);
        }
      },
      _updateUI: function _updateUI(value) {// Override to update UI according to new value
      },
      // Validation
      addValidation: function addValidation(validatorType, invalidMessage, options) {
        var validator = qookery.Qookery.getRegistry().getValidator(validatorType);
        if (!validator) throw new Error(qx.lang.String.format("Validator %1 not found", [validatorType]));
        if (!options) options = {};
        var validation = validator.createValidation(this, invalidMessage, options);

        this.__validations.push(validation);

        return validation;
      },
      removeValidation: function removeValidation(validation) {
        qx.lang.Array.remove(this.__validations, validation);
      },
      removeAllValidations: function removeAllValidations() {
        this.__validations.length = 0;
      },
      setInvalidMessage: function setInvalidMessage(invalidMessage) {
        var widget = this.getEditableWidget();

        if (typeof widget.setInvalidMessage !== "function") {
          this.debug("Unable to set property 'invalidMessage' of broken editable component");
          return;
        }

        widget.setInvalidMessage(invalidMessage);
      },
      validate: function validate() {
        if (!this.getEnabled()) return null;

        var errors = this._runValidations();

        return this._applyValidationErrors(errors);
      },

      /**
       * Call all installed validations and return possibly empty array of discovered errors
       */
      _runValidations: function _runValidations() {
        var errors = [];

        for (var i = 0; i < this.__validations.length; i++) {
          var validation = this.__validations[i];
          var error = null;

          try {
            var value = this.getValue();
            error = validation.call(this, value);
          } catch (e) {
            if (!(e instanceof qx.core.ValidationError)) throw e; // Rethrow unknown exception

            var message = e.message && e.message != qx.type.BaseError.DEFAULTMESSAGE ? e.message : e.getComment();
            error = new qookery.util.ValidationError(this, message);
          }

          if (error == null) continue;
          errors.push(error);
        }

        return errors;
      },

      /**
       * Update component state according to (possibly empty) array of validation errors
       *
       * @return {qookery.util.ValidationError} merged validation error or <code>null</code> if no errors passed
       */
      _applyValidationErrors: function _applyValidationErrors(errors) {
        if (errors == null || errors.length === 0) {
          this.setValid(true);
          return null;
        } else {
          var componentLabel = this.getLabel() || "";
          var message = this.tr("qookery.internal.components.EditableComponent.componentError", componentLabel);
          var error = new qookery.util.ValidationError(this, message, errors);
          this.setValid(false);
          this.setInvalidMessage(error.getFormattedMessage());
          return error;
        }
      },
      // Apply methods
      _applyValid: function _applyValid(value) {
        var widget = this.getEditableWidget();

        if (typeof widget.setValid !== "function") {
          this.debug("Unable to apply property 'valid' of broken editable component");
          return;
        }

        widget.setValid(value);
      },
      _applyFormat: function _applyFormat(format) {// Override to handle formats
      },
      _applyValue: function _applyValue(value) {
        if (this.__connection != null) {
          var model = this.getForm().getModel();
          if (model != null) this.__connection.setModelValue(model, value);
        }

        this.updateUI(value);
      },
      _applyLabel: function _applyLabel(label) {
        var labelWidget = this.getLabelWidget();
        if (!labelWidget) return;
        labelWidget.setValue(label);
      },
      _applyToolTipText: function _applyToolTipText(toolTipText) {
        var mainWidget = this.getMainWidget();
        if (!mainWidget) return;
        mainWidget.setToolTipText(toolTipText);
      },
      _applyRequired: function _applyRequired(required) {
        var labelWidget = this.getLabelWidget();

        if (required && !this.__requiredValidation) {
          this.__requiredValidation = this.addValidation("notNull");
          if (labelWidget) labelWidget.addState("required");
        }

        if (!required && this.__requiredValidation) {
          this.removeValidation(this.__requiredValidation);
          this.__requiredValidation = null;
          if (labelWidget) labelWidget.removeState("required");
        }
      },
      _applyReadOnly: function _applyReadOnly(readOnly) {
        // Subclasses should extend this method to implement the read only property
        var labelWidget = this.getLabelWidget();

        if (labelWidget) {
          if (readOnly) labelWidget.addState("readOnly");else labelWidget.removeState("readOnly");
        }
      },
      // Transform methods
      _transformValue: function _transformValue(value) {
        // Override to transform value
        return value;
      },
      _transformFormat: function _transformFormat(value) {
        if (qx.lang.Type.isString(value)) {
          return qookery.Qookery.getRegistry().createFormat(value);
        }

        return value;
      },
      // Utility methods for subclasses

      /**
       * Ask model provider to return a human friendly label for value
       *
       * @param value {any} the value for which a label is needed
       * @param labelType {String?} optional symbolic name of needed label type
       *
       * @return {String} produced label for user interface needs
       */
      _getLabelOf: function _getLabelOf(value, labelType) {
        if (value == null) return "";
        var format = this.getFormat();
        if (format != null) return format.format(value);
        var modelProvider = this.getForm().getModelProvider();
        if (modelProvider != null) return modelProvider.getLabel(value, labelType);
        return qx.data.Conversion.toString(value);
      },

      /**
       * Perform all operation about align, width and height for a label
       *
       * @param widget {qx.ui.basic.Label} label widget
       */
      _setupLabelAppearance: function _setupLabelAppearance(labelWidget) {
        var currentWidth = labelWidget.getWidth();
        labelWidget.setMinWidth(currentWidth);
        labelWidget.setAllowStretchX(false);
        labelWidget.setAllowStretchY(false);
        labelWidget.setAlignX("left");
        labelWidget.setAlignY("middle");
      },
      _setValueSilently: function _setValueSilently(value) {
        this._disableValueEvents = true;

        try {
          this.setValue(value);
        } catch (e) {
          throw e;
        } finally {
          this._disableValueEvents = false;
        }
      }
    },
    destruct: function destruct() {
      this.disconnect();
    }
  });
  qookery.internal.components.EditableComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.form.CheckBox": {}
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
  qx.Class.define("qookery.internal.components.CheckFieldComponent", {
    extend: qookery.internal.components.EditableComponent,
    properties: {
      triState: {
        init: false,
        inheritable: true,
        check: "Boolean",
        nullable: true,
        apply: "__applyTriState"
      }
    },
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "check-box-label":
            return "ReplaceableString";

          case "tri-state":
            return "Boolean";
        }

        return qookery.internal.components.CheckFieldComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Creation
      create: function create(attributes) {
        qookery.internal.components.CheckFieldComponent.prototype.create.base.call(this, attributes);

        this._applyAttribute("tri-state", this, "triState");
      },
      _createMainWidget: function _createMainWidget() {
        var checkBox = new qx.ui.form.CheckBox();
        var label = this.getAttribute("check-box-label");
        if (label !== undefined) checkBox.setLabel(label);
        checkBox.addListener("changeValue", function (event) {
          if (this._disableValueEvents) return;
          this.setValue(event.getData());
        }, this); // Below hack works around chechbox shortcomings with triple state values

        if (this.getAttribute("tri-state", false)) {
          checkBox.__availableStates = [true, false, null];

          checkBox.toggleValue = function () {
            this.__currentState = this.__availableStates.indexOf(this.getValue());
            this.__currentState = this.__currentState >= 2 ? 0 : this.__currentState + 1;
            this.setValue(this.__availableStates[this.__currentState]);
          }.bind(checkBox);
        }

        this._applyWidgetAttributes(checkBox);

        return checkBox;
      },
      // Component implementation
      _updateUI: function _updateUI(value) {
        this.getMainWidget().setValue(value);
      },
      _applyEnabled: function _applyEnabled(enabled) {
        var labelWidget = this.getLabelWidget();
        if (labelWidget != null) labelWidget.setEnabled(enabled);

        this.__updateEnabled();
      },
      _applyReadOnly: function _applyReadOnly(readOnly) {
        qookery.internal.components.CheckFieldComponent.prototype._applyReadOnly.base.call(this, readOnly);

        this.__updateEnabled();
      },
      __updateEnabled: function __updateEnabled() {
        var isEnabled = this.getEnabled();
        var isReadOnly = this.getReadOnly();
        this.getMainWidget().setEnabled(isEnabled && !isReadOnly);
      },
      // Internals
      __applyTriState: function __applyTriState(triState) {
        this.getMainWidget().setTriState(triState);
        this.getMainWidget().setValue(null);
      }
    }
  });
  qookery.internal.components.CheckFieldComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.Qookery": {},
      "qx.ui.form.ListItem": {},
      "qx.data.Array": {},
      "qx.lang.Type": {},
      "qx.data.Conversion": {}
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
  qx.Class.define("qookery.internal.components.AbstractSelectBoxComponent", {
    type: "abstract",
    extend: qookery.internal.components.EditableComponent,
    statics: {
      _NULL_ITEM_MODEL: ""
    },
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "keep-sorted":
            return "Boolean";

          case "map":
            return "String";

          case "max-list-height":
            return "Number";

          case "null-item-label":
            return "ReplaceableString";
        }

        return qookery.internal.components.AbstractSelectBoxComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _applySelectBoxAttributes: function _applySelectBoxAttributes(selectBox) {
        this._applyAttribute("max-list-height", selectBox, "maxListHeight");

        this._applyWidgetAttributes(selectBox);
      },
      _applyConnection: function _applyConnection(modelProvider, connection) {
        if (this.getAttribute("map") === undefined) {
          var mapName = connection.getAttribute("map");
          if (mapName != null) this.setItems(qookery.Qookery.getRegistry().getMap(mapName));
        }

        qookery.internal.components.AbstractSelectBoxComponent.prototype._applyConnection.base.call(this, modelProvider, connection);
      },
      setup: function setup() {
        var mapName = this.getAttribute("map");
        if (mapName !== undefined) this.setItems(qookery.Qookery.getRegistry().getMap(mapName));
        qookery.internal.components.AbstractSelectBoxComponent.prototype.setup.base.call(this);
      },
      // Public methods
      addItem: function addItem(model, label, icon) {
        if (label == null) label = this._getLabelOf(model);
        var item = new qx.ui.form.ListItem(label, icon, model);
        var selectBox = this.getMainWidget();

        if (this.getAttribute("keep-sorted", true)) {
          var existingItems = selectBox.getChildren();

          for (var index = 0; index < existingItems.length; index++) {
            var existingItem = existingItems[index];
            if (existingItem.getModel() === qookery.internal.components.AbstractSelectBoxComponent._NULL_ITEM_MODEL) continue;
            if (existingItem.getLabel() > label) break;
          }

          selectBox.addAt(item, index);
        } else selectBox.add(item);
      },
      addNullItem: function addNullItem(label, icon) {
        if (label === undefined) label = this.getAttribute("null-item-label", "");
        if (icon === undefined) icon = null;
        var item = new qx.ui.form.ListItem(label, icon, qookery.internal.components.AbstractSelectBoxComponent._NULL_ITEM_MODEL);
        this.getMainWidget().add(item);
      },
      removeAllItems: function removeAllItems() {
        this.getMainWidget().removeAll().forEach(function (item) {
          item.destroy();
        });
      },
      getItems: function getItems() {
        return this.getMainWidget().getChildren();
      },
      setItems: function setItems(items) {
        this._disableValueEvents = true;

        try {
          this.removeAllItems();

          if (this.getAttribute("null-item-label") !== undefined) {
            this.addNullItem();
          }

          if (items instanceof qx.data.Array) {
            items = items.toArray();
          }

          if (qx.lang.Type.isArray(items)) {
            for (var i = 0; i < items.length; i++) {
              var item = items[i];
              if (item instanceof qx.ui.form.ListItem) this.getMainWidget().add(item);else this.addItem(item);
            }
          } else if (qx.lang.Type.isObject(items)) {
            for (var model in items) {
              var label = items[model];
              this.addItem(model, qx.data.Conversion.toString(label));
            }
          }
        } finally {
          this._disableValueEvents = false;
        }

        this._updateUI(this.getValue());
      },
      // Internals
      _applyEnabled: function _applyEnabled(enabled) {
        var labelWidget = this.getLabelWidget();
        if (labelWidget != null) labelWidget.setEnabled(enabled);

        this.__updateEnabled();
      },
      _applyReadOnly: function _applyReadOnly(readOnly) {
        qookery.internal.components.AbstractSelectBoxComponent.prototype._applyReadOnly.base.call(this, readOnly);

        this.__updateEnabled();
      },
      __updateEnabled: function __updateEnabled() {
        var isEnabled = this.getEnabled();
        var isReadOnly = this.getReadOnly();
        this.getMainWidget().setEnabled(isEnabled && !isReadOnly);
      }
    }
  });
  qookery.internal.components.AbstractSelectBoxComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.AbstractSelectBoxComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.ComboBox": {}
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
  qx.Class.define("qookery.internal.components.ComboBoxComponent", {
    extend: qookery.internal.components.AbstractSelectBoxComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AbstractSelectBoxComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "placeholder":
            return "ReplaceableString";

          case "text-align":
            return "String";
        }

        return qookery.internal.components.ComboBoxComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createMainWidget: function _createMainWidget() {
        var comboBox = new qx.ui.form.ComboBox();

        this._applySelectBoxAttributes(comboBox);

        this._applyAttribute("placeholder", comboBox, "placeholder");

        var textField = comboBox.getChildControl("textfield");
        textField.addListener("changeValue", function (event) {
          if (this._disableValueEvents) return;
          var text = event.getData();
          if (text != null && text.trim().length === 0) text = null;
          var format = this.getFormat();
          var value = format != null ? format.parse(text) : text;
          this.getEditableWidget().setValue(this._getLabelOf(value));

          this._setValueSilently(value);
        }, this);

        this._applyAttribute("text-align", textField, "textAlign");

        return comboBox;
      },
      // Behavior
      _updateUI: function _updateUI(value) {
        this.getEditableWidget().setValue(this._getLabelOf(value));
      }
    }
  });
  qookery.internal.components.ComboBoxComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.IComponent": {
        "require": true
      }
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
   * Interface for components that are containers of other components
   */
  qx.Interface.define("qookery.IContainerComponent", {
    extend: qookery.IComponent,
    members: {
      /**
       * Add component into this container
       *
       * @param component {qookery.IComponent} the component to add into this component
       *
       * @throw an exception is thrown in case this component does not support operation
       */
      add: function add(component) {},

      /**
       * Remove component from this container
       *
       * @param component {qookery.IComponent} component to remove
       */
      remove: function remove(component) {},

      /**
       * Test whether given component is a member of this container
       *
       * @param component {qookery.IComponent} component to look for
       *
       * @return {Boolean} <code>true</code> if component is a member of this container
       */
      contains: function contains(component) {},

      /**
       * Return an array of all contained components
       *
       * @return {Array} contained components
       */
      listChildren: function listChildren() {}
    }
  });
  qookery.IContainerComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
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
      "qx.ui.container.Composite": {}
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
   * Component wrapping a Qooxdoo qx.ui.container.Composite
   */
  qx.Class.define("qookery.internal.components.CompositeComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createContainerWidget: function _createContainerWidget() {
        var container = new qx.ui.container.Composite();

        this._applyWidgetAttributes(container);

        return container;
      }
    }
  });
  qookery.internal.components.CompositeComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.form.DateField": {},
      "qookery.Qookery": {},
      "qx.lang.Type": {},
      "qx.lang.String": {}
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
  qx.Class.define("qookery.internal.components.DateFieldComponent", {
    extend: qookery.internal.components.EditableComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
      this.__regularExpression = /(\d{1,2})[\.\-\/\\\:](\d{1,2})([\.\-\/\\\:](\d?\d?\d\d))?/;
      this.__inputIndexMap = {
        year: 4,
        month: 2,
        date: 1,
        hours: 0,
        minutes: 0,
        seconds: 0
      };
      this.__userTyped = false;
    },
    members: {
      __regularExpression: null,
      __inputIndexMap: null,
      __userTyped: null,
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "placeholder":
            return "ReplaceableString";
        }

        return qookery.internal.components.DateFieldComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      create: function create(attributes) {
        qookery.internal.components.DateFieldComponent.prototype.create.base.call(this, attributes);

        this._applyAttribute("input-specification", this, function (specification) {
          this.__regularExpression = this.__parseSpecification(specification);
        });
      },
      _createMainWidget: function _createMainWidget() {
        var widget = new qx.ui.form.DateField();

        this._applyAttribute("native-context-menu", widget, "nativeContextMenu", qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_NATIVE_CONTEXT_MENU));

        widget.getChildControl("textfield").addListener("focusout", function (event) {
          if (this.__userTyped) {
            this.__userTyped = false;

            this.__parseInput();
          }
        }, this);
        widget.addListener("keypress", function (event) {
          this.__userTyped = true;
          if (event.getKeyIdentifier() != "Enter" && event.getKeyIdentifier() != "Tab") return;

          this.__parseInput();
        }, this);
        widget.addListener("changeValue", function (event) {
          if (!event.getData()) this.getMainWidget().resetValue();
          if (this._disableValueEvents) return;
          this.setValue(event.getData());
        }, this);

        this._applyWidgetAttributes(widget);

        this._applyAttribute("placeholder", widget, "placeholder");

        return widget;
      },
      _updateUI: function _updateUI(value) {
        this.__userTyped = false;
        var dateField = this.getMainWidget();

        if (!value) {
          dateField.resetValue();
          return;
        }

        if (!qx.lang.Type.isDate(value)) {
          if (qx.lang.Type.isString(value)) value = new Date(Date.parse(value));else throw new Error("Unsupported value type");
        }

        dateField.setValue(value);
      },
      _applyFormat: function _applyFormat(format) {
        this.getMainWidget().setDateFormat(format);
      },
      __parseInput: function __parseInput() {
        var textField = this.getMainWidget().getChildControl("textfield");
        var text = textField.getValue();
        text = this.__parseDateTime(text);
        if (!text || text === "") return;

        var res = this.__regularExpression.exec(text);

        if (!res) return;
        var year = parseInt(res[this.__inputIndexMap.year], 10);
        var month = parseInt(res[this.__inputIndexMap.month], 10) - 1;
        if (month < 0 || month > 11) return;
        var date = parseInt(res[this.__inputIndexMap.date], 10);
        if (date < 1 || date > 31) return;
        var hours = parseInt(this.__inputIndexMap.hours, 10) !== 0 ? parseInt(res[this.__inputIndexMap.hours], 10) : 0;
        if (hours < 0 || hours > 23) return;
        var minutes = parseInt(this.__inputIndexMap.minutes, 10) !== 0 ? parseInt(res[this.__inputIndexMap.minutes], 10) : 0;
        if (minutes < 0 || minutes > 59) return;
        var seconds = parseInt(this.__inputIndexMap.seconds, 10) !== 0 ? parseInt(res[this.__inputIndexMap.seconds], 10) : 0;
        if (seconds < 0 || seconds > 59) return;
        var inputDate = new Date(year, month, date, hours, minutes, seconds);
        this.setValue(inputDate);
      },
      __parseDateTime: function __parseDateTime(string) {
        if (string == null) return "";
        var dateParts = string.split(/ +/);
        var datePart = "";
        var timePart = "00:00"; //user give only time

        if (dateParts[0].indexOf(":") != -1) {
          datePart = qx.lang.String.format("%1/%2/%3", [new Date().getDate(), new Date().getMonth() + 1, new Date().getFullYear()]);
          timePart = dateParts[0];
        } else {
          datePart = dateParts.length >= 1 ? this.__parseDate(dateParts[0]) : "";

          if (dateParts.length === 2 && parseInt(this.__inputIndexMap.minutes, 10) !== 0 && parseInt(this.__inputIndexMap.hours, 10) !== 0) {
            if (dateParts[1].indexOf(":") != -1) {
              timePart = dateParts[1];
            } else if (dateParts[1].indexOf(":") == -1 && dateParts[1] > 0) {
              timePart = qx.lang.String.format("%1:%2", [dateParts[1], "00"]);
            }
          }
        }

        return qx.lang.String.format("%1 %2", [datePart, timePart]);
      },
      __parseDate: function __parseDate(string) {
        var date = string.split("/");
        if (date.length == 1) date = string.split("-");

        switch (date.length) {
          case 1:
            string = qx.lang.String.format("01/%1/%2", [string, new Date().getFullYear()]);
            break;

          case 2:
            if (date[1].length == 4) string = qx.lang.String.format("01/%1/%2", [date[0], date[1]]);else string = qx.lang.String.format("%1/%2/%3", [date[0], date[1], new Date().getFullYear()]);
            break;

          case 3:
            if (date[2].length == 2) {
              date[2] = parseInt(date[2], 10) < this.constructor.THRESHOLD ? (date[2].length == 1 ? "200" : "20") + date[2] : (date[2].length == 1 ? "190" : "19") + date[2];
            }

            string = qx.lang.String.format("%1/%2/%3", [date[0], date[1], date[2]]);
            break;

          default:
            string = qx.lang.String.format("%1/%2/%3", [new Date().getDate(), new Date().getMonth() + 1, new Date().getFullYear()]);
            break;
        }

        return string;
      },
      __parseSpecification: function __parseSpecification(specification) {
        var result = specification.split(" ", 7);
        if (!result || result.length != 7) return null;
        this.__inputIndexMap = {
          year: result[0],
          month: result[1],
          date: result[2],
          hours: result[3],
          minutes: result[4],
          seconds: result[5]
        };
        return new RegExp(result[6], "i");
      }
    }
  });
  qookery.internal.components.DateFieldComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
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
   * Interface for classes that provide the value of variables when asked
   */
  qx.Interface.define("qookery.IVariableProvider", {
    members: {
      /**
       * Get a variable's value
       *
       * @param variableName {String} the name of the variable
       *
       * @return {any} variable value or <code>undefined</code>
       */
      getVariable: function getVariable(variableName) {},

      /**
       * Set a variable's value
       *
       * @param variableName {String} the name of the variable
       * @param value {any} the new variable value
       */
      setVariable: function setVariable(variableName, value) {}
    }
  });
  qookery.IVariableProvider.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.IContainerComponent": {
        "require": true
      },
      "qookery.IVariableProvider": {
        "require": true
      }
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
   * Forms are container components that provide a number of facilities to their descendants
   *
   * <p>Descendant components can rely on their containing form to:</p>
   *
   * <ul>
   *	<li>Maintain and resolve URI prefixes</li>
   *	<li>Resolve services via dependency injection</li>
   *	<li>Require, define or otherwise access form-level variables</li>
   *	<li>Execute JavaScript source code into a common scripting context</li>
   *	<li>Interact with a model, either directly of through connections</li>
   *	<li>Use unique, in the scope of the form, component identifiers</li>
   *	<li>Run form-level validation of current model</li>
   *	<li>Translate messages using form-local translation identifiers</li>
   *	<li>Register objects for disposal on form destruction</li>
   *</ul>
   */
  qx.Interface.define("qookery.IFormComponent", {
    extend: [qookery.IContainerComponent, qookery.IVariableProvider],
    statics: {
      // Attribute names

      /** {Function} The service resolver associated with form */
      A_SERVICE_RESOLVER: "{http://www.qookery.org/ns/Form}service-resolver",

      /** {String} A string to prepend to all form-local translation message IDs */
      A_TRANSLATION_PREFIX: "{http://www.qookery.org/ns/Form}translation-prefix",

      /** {Map} Additional variables provided by the caller of the form parser */
      A_VARIABLES: "{http://www.qookery.org/ns/Form}variables"
    },
    events: {
      /** This event is fired when the form has been closed. Its value is set to the form's <code>result</code> variable. */
      "close": "qx.event.type.Data"
    },
    properties: {
      /** An icon for UI elements that present this form */
      icon: {
        check: "String",
        nullable: true
      },

      /** The form's model for data binding */
      model: {
        nullable: true,
        dereference: true,
        event: "changeModel"
      },

      /** A title for UI elements that present this form */
      title: {
        check: "String",
        nullable: true
      },

      /** A boolean value set to <code>false</code> when the most recent validation failed */
      valid: {
        check: "Boolean",
        nullable: false,
        init: true,
        event: "changeValid"
      }
    },
    members: {
      // Lifecycle

      /**
       * Test if form is ready for processing user input
       *
       * <p>A form's readiness is asserted by the application via the markAsReady() method.</p>
       */
      isReady: function isReady() {},

      /**
       * Assert that the form is ready for processing user input
       */
      markAsReady: function markAsReady() {},
      // Access to other components

      /**
       * Return a component registered within this form
       *
       * @param componentId {String} the unique identifier of the requested component
       * @param required {Boolean?} if <code>true</code>, throw an error in case component is not found
       *
       * @return {qookery.IComponent} component or <code>null</code> if not found
       */
      getComponent: function getComponent(componentId, required) {},

      /**
       * Return the form that is the parent of this form, or <code>null</code> if no such linkage exists
       */
      getParentForm: function getParentForm() {},
      // Services

      /**
       * Return the form's model provider if set, or the default one otherwise
       */
      getModelProvider: function getModelProvider() {},

      /**
       * Attempt to resolve a service by using installed service resolver
       *
       * <p>This method will delegate the request to parent form if service is unavailable</p>
       *
       * @param serviceName {String} the name of wanted service
       *
       * @return {any} required service or <code>null</code> if not available
       */
      resolveService: function resolveService(serviceName) {},
      // Scripting

      /**
       * Return the JavaScript context that is used by Qookery scripting code
       *
       * @return {Object} a suitable JavaScript context
       */
      getScriptingContext: function getScriptingContext() {},
      // Operations

      /**
       * Validate form contents
       *
       * @return {qookery.util.ValidationError?} error found or <code>null</code> in case form is valid
       */
      validate: function validate() {},

      /**
       * Close the form
       *
       * @param result {any} optional value to set into the <code>result</code> variable
       */
      close: function close(result) {}
    }
  });
  qookery.IFormComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.core.Environment": {
        "defer": "load",
        "require": true
      },
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.CompositeComponent": {
        "construct": true,
        "require": true
      },
      "qookery.IFormComponent": {
        "require": true
      },
      "qookery.Qookery": {},
      "qx.locale.LocalizedString": {},
      "qx.bom.client.Device": {},
      "qx.lang.String": {},
      "qx.lang.Type": {},
      "qookery.util.ValidationError": {},
      "qx.lang.Object": {},
      "qookery.util.Xml": {},
      "qx.dom.Element": {},
      "qx.xml.Element": {},
      "qx.dom.Hierarchy": {},
      "qx.dom.Node": {},
      "qx.locale.Manager": {},
      "qookery.IVariableProvider": {},
      "qookery.internal.util.Connection": {}
    },
    "environment": {
      "provided": [],
      "required": {
        "device.touch": {
          "className": "qx.bom.client.Device"
        }
      }
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
  qx.Class.define("qookery.internal.components.FormComponent", {
    extend: qookery.internal.components.CompositeComponent,
    implement: [qookery.IFormComponent],
    construct: function construct(parentComponent) {
      qookery.internal.components.CompositeComponent.constructor.call(this, parentComponent);
      this.__status = "NEW";
      this.__components = {};
      this.__connections = [];
    },
    events: {
      "close": "qx.event.type.Data"
    },
    properties: {
      "icon": {
        nullable: true
      },
      "title": {
        nullable: true,
        check: "String",
        event: "changeTitle"
      },
      "valid": {
        nullable: false,
        check: "Boolean",
        init: true,
        event: "changeValid"
      },
      "model": {
        nullable: true,
        dereference: true,
        event: "changeModel",
        apply: "_applyModel"
      }
    },
    members: {
      __status: null,
      __components: null,
      __connections: null,
      __scriptingContext: null,
      __serviceResolver: null,
      __translationPrefix: null,
      __operationQueue: null,
      __modelProvider: null,
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "title":
            return "ReplaceableString";
        }

        return qookery.internal.components.FormComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      setAttribute: function setAttribute(attributeName, value) {
        switch (attributeName) {
          case qookery.IFormComponent.A_SERVICE_RESOLVER:
            this.__serviceResolver = value;
            return;

          case qookery.IFormComponent.A_TRANSLATION_PREFIX:
            this.__translationPrefix = value;
            return;

          case qookery.IFormComponent.A_VARIABLES:
            this.__scriptingContext = this.$ = this.__createScriptingContext(value);
            return;
        }

        return qookery.internal.components.FormComponent.prototype.setAttribute.base.call(this, attributeName, value);
      },
      // Lifecycle
      create: function create(attributes) {
        this.__enableOperationQueuing();

        this.debug("Created");
        qookery.internal.components.FormComponent.prototype.create.base.call(this, attributes);
        this.__modelProvider = qookery.Qookery.getRegistry().getModelProvider(this.getAttribute("model-provider"));

        this._applyAttribute("icon", this, "icon");
      },
      setup: function setup() {
        var title = this.getAttribute("title");
        if (title !== undefined) this.setTitle(title instanceof qx.locale.LocalizedString ? title.translate() : title);

        this.__flushOperationQueue();

        return qookery.internal.components.FormComponent.prototype.setup.base.call(this);
      },
      focus: function focus() {
        // Do not handle form focus on touch devices - this is a hack to prevent the virtual keyboard from
        // popping up when the XML author sets the focus to text fields (and other components)
        if (qx.core.Environment.get("device.touch")) return;
        this.executeAction("onFocusReceived");
      },
      isReady: function isReady() {
        return this.__status === "READY";
      },
      markAsReady: function markAsReady() {
        this.__status = "READY";
      },
      // Getters and setters
      getForm: function getForm() {
        return this;
      },
      getParentForm: function getParentForm() {
        var parentForm = this.getVariable("parentForm");
        if (parentForm != null) return parentForm;
        var parentComponent = this.getParent();
        if (!parentComponent) return null;
        return parentComponent.getForm();
      },
      getTranslationPrefix: function getTranslationPrefix() {
        return this.__translationPrefix;
      },
      getModelProvider: function getModelProvider() {
        return this.__modelProvider;
      },
      // Services
      resolveService: function resolveService(serviceName) {
        var resolver = this.__serviceResolver;

        if (resolver != null) {
          var service = resolver(serviceName);
          if (service != null) return service;
        }

        var parentForm = this.getParentForm();
        if (parentForm != null) return parentForm.resolveService(serviceName);
        return qookery.Qookery.getService(serviceName, false);
      },
      // Variables
      getVariable: function getVariable(variableName, defaultValue) {
        var value = this.__scriptingContext[variableName];
        if (value !== undefined) return value;
        return defaultValue;
      },
      setVariable: function setVariable(variableName, value) {
        this.__scriptingContext[variableName] = value;
      },
      // Component registration
      getComponent: function getComponent(componentId, required) {
        var component = this.__components[componentId];
        if (component == null && required === true) throw new Error(qx.lang.String.format("Reference to unregistered component '%1'", [componentId]));
        return component;
      },
      putComponent: function putComponent(componentId, component) {
        this.__components[componentId] = component;
      },
      // Client scripting context
      getScriptingContext: function getScriptingContext() {
        var context = this.__scriptingContext;
        if (context == null) throw new Error("Scripting context is not available");
        return context;
      },
      // Validation
      validate: function validate() {
        if (this.__queueOperation(this.validate)) return null;
        var baseError = qookery.internal.components.FormComponent.prototype.validate.base.call(this);
        var actionError = this.executeAction("validate");

        if (baseError == null && actionError == null) {
          this.setValid(true);
          return null;
        }

        var errors = [];
        if (baseError) errors.push(baseError);

        if (actionError) {
          if (qx.lang.Type.isString(actionError)) errors.push(new qookery.util.ValidationError(this, actionError));else errors.push(actionError);
        }

        this.setValid(false);
        var message = this.tr("qookery.internal.components.FormComponent.validationErrors", this.getTitle());
        return new qookery.util.ValidationError(this, message, errors);
      },
      parseXmlElement: function parseXmlElement(elementName, xmlElement) {
        switch (elementName) {
          case "{http://www.qookery.org/ns/Form}import":
            this.__parseImport(xmlElement);

            return true;

          case "{http://www.qookery.org/ns/Form}translation":
            this.__parseTranslation(xmlElement);

            return true;

          case "{http://www.qookery.org/ns/Form}variable":
            this.__parseVariable(xmlElement);

            return true;
        }

        return false;
      },
      // Internals
      __createScriptingContext: function __createScriptingContext(variables) {
        var context = function (selector) {
          if (selector == null) {
            return this;
          }

          if (selector === ":parent") {
            return this.getParentForm();
          }

          if (selector.charAt(0) === "#") {
            return this.getComponent(selector.substr(1));
          }

          return null;
        }.bind(this);

        context["form"] = // Deprecated, use capitalized version $.Form
        context["Form"] = this;
        if (variables != null) qx.lang.Object.mergeWith(context, variables, false);
        return context;
      },
      __parseImport: function __parseImport(importElement) {
        var name = null,
            getter = null;
        var className = qookery.util.Xml.getAttribute(importElement, "class");

        if (className != null) {
          name = className;

          getter = function getter() {
            return qx.Class.getByName(className);
          };
        }

        var formName = qookery.util.Xml.getAttribute(importElement, "form");

        if (formName != null) {
          name = formName;

          getter = function () {
            var form = this;

            do {
              if (form.getId() === formName) return form;
              form = form.getParentForm();
            } while (form != null);
          }.bind(this);
        }

        var serviceName = qookery.util.Xml.getAttribute(importElement, "service");

        if (serviceName != null) {
          name = serviceName;
          getter = this.resolveService.bind(this, serviceName);
        }

        var singletonName = qookery.util.Xml.getAttribute(importElement, "singleton");

        if (singletonName != null) {
          name = singletonName;

          getter = function getter() {
            return qx.Class.getByName(singletonName).getInstance();
          };
        }

        if (name == null || getter == null) {
          throw new Error("Invalid <import> element");
        }

        var variableName = qookery.util.Xml.getAttribute(importElement, "variable");

        if (variableName == null) {
          variableName = name.substring(name.lastIndexOf(".") + 1);
        }

        if (this.__scriptingContext.hasOwnProperty(variableName)) {
          throw new Error("Variable '" + variableName + "' has already been defined");
        }

        var isRequired = qookery.util.Xml.getAttribute(importElement, "optional") !== "true";
        var onDemand = qookery.util.Xml.getAttribute(importElement, "resolution") === "on-demand";

        if (!onDemand) {
          var value = getter();
          if (value == null && isRequired) throw new Error("Unable to resolve required import '" + name + "'");

          getter = function getter() {
            return value;
          };
        } else if (isRequired) {
          var g = getter;

          getter = function getter() {
            var value = g();
            if (value == null) throw new Error("Unable to resolve required import '" + name + "'");
            return value;
          };
        }

        Object.defineProperty(this.__scriptingContext, variableName, {
          configurable: false,
          enumerable: false,
          get: getter,
          set: function set(v) {
            throw new Error("Illegal write access to form import");
          }
        });
      },
      __parseTranslation: function __parseTranslation(translationElement) {
        if (!qx.dom.Element.hasChildren(translationElement)) return;
        var languageCode = qx.xml.Element.getAttributeNS(translationElement, "http://www.w3.org/XML/1998/namespace", "lang");
        if (languageCode == null) throw new Error("Language code missing");
        var messages = {};
        var children = qx.dom.Hierarchy.getChildElements(translationElement);

        for (var i = 0; i < children.length; i++) {
          var messageElement = children[i];
          var elementName = qx.dom.Node.getName(messageElement);
          if (elementName != "message") throw new Error(qx.lang.String.format("Unexpected XML element '%1' in translation block", [elementName]));
          var messageId = qookery.util.Xml.getAttribute(messageElement, "id", Error);
          if (this.__translationPrefix != null) messageId = this.__translationPrefix + "." + messageId;
          messages[messageId] = qookery.util.Xml.getNodeText(messageElement);
        }

        qx.locale.Manager.getInstance().addTranslation(languageCode, messages);
      },
      __parseVariable: function __parseVariable(variableElement) {
        var variableName = qookery.util.Xml.getAttribute(variableElement, "name", Error);
        var providerName = qookery.util.Xml.getAttribute(variableElement, "provider", "Form");
        var provider = this.__scriptingContext[providerName];
        if (provider == null || !qx.Class.hasInterface(provider.constructor, qookery.IVariableProvider)) throw new Error("Variable provider '" + providerName + "' missing from scripting context");
        var value = provider.getVariable(variableName);

        if (value == null) {
          var defaultValue = qookery.util.Xml.getNodeText(variableElement);
          if (defaultValue == null) defaultValue = qookery.util.Xml.getAttribute(variableElement, "default");

          if (defaultValue != null) {
            var typeName = qookery.util.Xml.getAttribute(variableElement, "type", "Expression");
            value = qookery.util.Xml.parseValue(this, typeName, defaultValue);
          }

          if (value === undefined) value = null;
          if (value === null && qookery.util.Xml.getAttribute(variableElement, "required") === "true") throw new Error("Value for required variable '" + variableName + "' is missing");
          provider.setVariable(variableName, value);
        }

        if (provider === this) return;
        var writable = qookery.util.Xml.getAttribute(variableElement, "writable") !== "false";
        var setFunction = writable ? function (v) {
          provider.setVariable(variableName, v);
        } : function (v) {
          throw new Error("Illegal attempt to modify non-writable variable '" + variableName + "'");
        };
        Object.defineProperty(this.__scriptingContext, variableName, {
          configurable: false,
          enumerable: true,
          get: function get() {
            return provider.getVariable(variableName);
          },
          set: setFunction
        });
      },
      // Operations
      close: function close(result) {
        if (this.isDisposed()) return;
        if (result !== undefined) this.__scriptingContext["result"] = result;
        this.fireDataEvent("close", result);
      },
      // Model connection
      addConnection: function addConnection(editableComponent, modelPropertyPath) {
        var connection = new qookery.internal.util.Connection(editableComponent, modelPropertyPath);

        this.__connections.push(connection);

        connection.connect(this.getModel()); // Attempt model connection immediately

        return connection;
      },
      removeConnection: function removeConnection(connection) {
        connection.disconnect();

        for (var i = 0; i < this.__connections.length; i++) {
          if (connection.equals(this.__connections[i])) this.__connections.splice(i, 1);
        }
      },
      _applyModel: function _applyModel(model) {
        for (var i = 0; i < this.__connections.length; i++) {
          var connection = this.__connections[i];
          connection.connect(model);
        }
      },
      // Miscellaneous implementations
      toString: function toString() {
        var hash = this.getId() || this.$$hash;
        return this.classname + "[" + hash + "]";
      },
      // Operation queuing
      __enableOperationQueuing: function __enableOperationQueuing() {
        this.__operationQueue = [];
      },
      __queueOperation: function __queueOperation(operation) {
        if (this.__operationQueue === null) return false;
        if (this.__operationQueue.indexOf(operation) === -1) this.__operationQueue.push(operation);
        return true;
      },
      __flushOperationQueue: function __flushOperationQueue() {
        if (this.__operationQueue === null) return;
        var queue = this.__operationQueue;
        this.__operationQueue = null;
        if (queue.length === 0) return;

        for (var i = 0; i < queue.length; i++) {
          var operation = queue[i];
          operation.call(this);
        }
      }
    },
    destruct: function destruct() {
      this.__status = "DISPOSED";

      for (var i = 0; i < this.__connections.length; i++) this.__connections[i].disconnect();

      this.debug("Destructed");
    }
  });
  qookery.internal.components.FormComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.AtomComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.HoverButton": {}
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
  qx.Class.define("qookery.internal.components.HoverButtonComponent", {
    extend: qookery.internal.components.AtomComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AtomComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "interval":
            return "Integer";
        }

        return qookery.internal.components.HoverButtonComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createAtomWidget: function _createAtomWidget() {
        var button = new qx.ui.form.HoverButton();

        this._applyAttribute("interval", button, "interval");

        this._applyAtomAttributes(button);

        return button;
      },
      // Public methods
      getCommand: function getCommand() {
        return this.getMainWidget().getCommand();
      },
      setCommand: function setCommand(command) {
        this.getMainWidget().setCommand(command);
      },
      execute: function execute() {
        this.getMainWidget().execute();
      }
    }
  });
  qookery.internal.components.HoverButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.embed.Html": {},
      "qx.xml.Element": {}
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
  qx.Class.define("qookery.internal.components.HtmlComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      _createWidgets: function _createWidgets() {
        var html = new qx.ui.embed.Html(this.getAttribute("html", null));

        this._applyAttribute("overflow-x", html, "overflowX");

        this._applyAttribute("overflow-y", html, "overflowY");

        this._applyAttribute("css-class", html, "cssClass");

        this._applyWidgetAttributes(html);

        return [html];
      },
      parseXmlElement: function parseXmlElement(elementName, xmlElement) {
        if (elementName.indexOf("{http://www.w3.org/1999/xhtml}") !== 0) return false;
        var html = qx.xml.Element.serialize(xmlElement);
        this.setHtml(html);
        return true;
      },
      getHtml: function getHtml() {
        return this.getMainWidget().getHtml();
      },
      setHtml: function setHtml(html) {
        this.getMainWidget().setHtml(html);
      },
      getDomElement: function getDomElement() {
        return this.getMainWidget().getContentElement().getDomElement();
      },
      updateAppearance: function updateAppearance() {
        this.getMainWidget().updateAppearance();
      }
    }
  });
  qookery.internal.components.HtmlComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
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

//
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
      "qx.ui.basic.Label": {}
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
  qx.Class.define("qookery.internal.components.LabelComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "rich":
            return "Boolean";

          case "wrap":
            return "Boolean";
        }

        return qookery.internal.components.LabelComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createWidgets: function _createWidgets() {
        var label = new qx.ui.basic.Label(this.getAttribute("label", ""));

        this._applyAttribute("rich", label, "rich");

        this._applyAttribute("wrap", label, "wrap");

        this._applyAttribute("text-align", label, "textAlign");

        this._applyWidgetAttributes(label);

        return [label];
      },
      getValue: function getValue() {
        return this.getMainWidget().getValue();
      },
      setValue: function setValue(value) {
        this.getMainWidget().setValue(value);
      },
      getRich: function getRich() {
        return this.getMainWidget().getRich();
      },
      setRich: function setRich(value) {
        this.getMainWidget().setRich(value);
      }
    }
  });
  qookery.internal.components.LabelComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.form.List": {},
      "qookery.Qookery": {},
      "qx.ui.form.ListItem": {},
      "qx.data.Array": {},
      "qx.lang.Type": {},
      "qx.data.Conversion": {}
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
  qx.Class.define("qookery.internal.components.ListComponent", {
    extend: qookery.internal.components.EditableComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "map":
            return "String";

          case "spacing":
            return "Integer";

          case "orientation":
            return "String";
        }

        return qookery.internal.components.ListComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createMainWidget: function _createMainWidget() {
        var list = new qx.ui.form.List();

        this._applyAttribute("scrollbar-x", list, "scrollbarX");

        this._applyAttribute("scrollbar-y", list, "scrollbarY");

        this._applyAttribute("selection-mode", list, "selectionMode");

        this._applyAttribute("spacing", list, "spacing");

        list.addListener("changeSelection", function (event) {
          if (this._disableValueEvents) return;
          var selection = event.getData();

          switch (this.getMainWidget().getSelectionMode()) {
            case "single":
            case "one":
              var item = selection[0];
              this.setValue(item ? item.getModel() : null);
              return;

            case "multi":
            case "additive":
              var value = selection.map(function (item) {
                return item.getModel();
              });
              this.setValue(value.length > 0 ? value : null);
              return;
          }
        }, this);

        this._applyWidgetAttributes(list);

        return list;
      },
      _applyConnection: function _applyConnection(modelProvider, connection) {
        if (this.getAttribute("map") === undefined) {
          var mapName = connection.getAttribute("map");
          if (mapName != null) this.setItems(qookery.Qookery.getRegistry().getMap(mapName));
        }

        qookery.internal.components.ListComponent.prototype._applyConnection.base.call(this, modelProvider, connection);
      },
      setup: function setup() {
        var mapName = this.getAttribute("map");
        if (mapName !== undefined) this.setItems(qookery.Qookery.getRegistry().getMap(mapName));
        qookery.internal.components.ListComponent.prototype.setup.base.call(this);
      },
      _updateUI: function _updateUI(value) {
        if (!value) {
          this.getMainWidget().resetSelection();
          return;
        }

        var selection = [];

        switch (this.getMainWidget().getSelectionMode()) {
          case "single":
          case "one":
            var item = this.__findItem(value);

            if (item) selection.push(item);
            break;

          case "multi":
          case "additive":
            for (var i = 0; i < value.length; i++) {
              var item = this.__findItem(value[i]);

              if (item) selection.push(item);
            }

            break;
        }

        if (selection.length > 0) this.getMainWidget().setSelection(selection);else this.getMainWidget().resetSelection();
      },
      addItem: function addItem(model, label, icon) {
        if (!label) label = this._getLabelOf(model);
        var item = new qx.ui.form.ListItem(label, icon, model);
        var textAlign = this.getAttribute("text-align", null);

        if (textAlign != null) {
          item.getChildControl("label").setAllowGrowX(true);
          item.getChildControl("label").setTextAlign(textAlign);
        }

        this.getMainWidget().add(item);
      },
      setItems: function setItems(items) {
        this.removeAllItems();
        if (items instanceof qx.data.Array) items = items.toArray();

        if (qx.lang.Type.isArray(items)) {
          for (var i = 0; i < items.length; i++) {
            var model = items[i];

            var label = this._getLabelOf(model);

            this.addItem(model, label);
          }
        } else if (qx.lang.Type.isObject(items)) {
          for (var model in items) {
            var label = items[model];
            this.addItem(model, qx.data.Conversion.toString(label));
          }
        }
      },
      removeAllItems: function removeAllItems() {
        this.getMainWidget().removeAll().forEach(function (widget) {
          widget.dispose();
        });
      },
      setSelection: function setSelection(itemNumber) {
        var selectablesItems = this.getMainWidget().getSelectables(true);
        if (!selectablesItems || selectablesItems[itemNumber] === undefined) return;
        this.getMainWidget().setSelection([selectablesItems[itemNumber]]);
      },
      __findItem: function __findItem(model) {
        var items = this.getMainWidget().getChildren();
        var modelProvider = this.getForm().getModelProvider();

        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var model2 = item.getModel();
          if (!modelProvider.areEqual(model, model2)) continue;
          return item;
        }
      }
    }
  });
  qookery.internal.components.ListComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.ButtonComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.MenuButton": {}
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
  qx.Class.define("qookery.internal.components.MenuButtonComponent", {
    extend: qookery.internal.components.ButtonComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ButtonComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Creation
      _createButton: function _createButton() {
        return new qx.ui.form.MenuButton();
      }
    }
  });
  qookery.internal.components.MenuButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.Qookery": {},
      "qx.bom.Event": {}
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
  qx.Class.define("qookery.internal.components.FieldComponent", {
    type: "abstract",
    extend: qookery.internal.components.EditableComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "filter":
            return "RegularExpression";

          case "max-length":
            return "Integer";

          case "placeholder":
            return "ReplaceableString";

          case "text-align":
            return "String";
        }

        return qookery.internal.components.FieldComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      create: function create(attributes) {
        qookery.internal.components.FieldComponent.prototype.create.base.call(this, attributes);
      },
      _setupTextField: function _setupTextField(widget) {
        this._applyAttribute("native-context-menu", widget, "nativeContextMenu", qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_NATIVE_CONTEXT_MENU));

        widget.addListener("changeValue", function (event) {
          if (this._disableValueEvents) return;
          var text = event.getData();
          if (text != null && text.trim().length === 0) text = null;
          var format = this.getFormat();
          var value = format != null ? format.parse(text) : text;
          this.getEditableWidget().setValue(this._getLabelOf(value));

          this._setValueSilently(value);
        }, this);
        widget.addListener("keypress", function (event) {
          if (this.isReadOnly() || !event.isShiftPressed() || event.isAltPressed() || event.isCtrlPressed()) return;

          switch (event.getKeyIdentifier()) {
            case "Delete":
            case "Backspace":
              this.setValue(null);
              return;
          }
        }, this);
        var liveUpdate = this.getAttribute("live-update", qookery.Qookery.getOption(qookery.Qookery.OPTION_DEFAULT_LIVE_UPDATE));

        if (liveUpdate) {
          widget.addListenerOnce("appear", function () {
            var component = this;
            qx.bom.Event.addNativeListener(widget.getContentElement().getDomElement(), "paste", function () {
              component.setValue(this.value);
            });
          }, this);
          widget.addListener("blur", function (event) {
            if (this._disableValueEvents) return;
            var format = this.getFormat();
            if (format == null) return;
            var text = this.getEditableWidget().getValue();
            var value = format.parse(text);
            text = format.format(value);
            this.getEditableWidget().setValue(text);
          }, this);
          widget.setLiveUpdate(true);
        }

        this._applyAttribute("filter", widget, "filter");

        this._applyAttribute("max-length", widget, "maxLength");

        this._applyAttribute("placeholder", widget, "placeholder");

        this._applyAttribute("text-align", widget, "textAlign");

        return widget;
      },
      _updateUI: function _updateUI(value) {
        this.getEditableWidget().setValue(this._getLabelOf(value));
      },
      _applyReadOnly: function _applyReadOnly(readOnly) {
        qookery.internal.components.FieldComponent.prototype._applyReadOnly.base.call(this, readOnly);

        var editableWidget = this.getEditableWidget();
        if (editableWidget != null) editableWidget.setReadOnly(readOnly);
      }
    }
  });
  qookery.internal.components.FieldComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.FieldComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.TextField": {}
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
  qx.Class.define("qookery.internal.components.TextFieldComponent", {
    extend: qookery.internal.components.FieldComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.FieldComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createMainWidget: function _createMainWidget() {
        var widget = new qx.ui.form.TextField();

        this._setupTextField(widget);

        this._applyWidgetAttributes(widget);

        return widget;
      }
    }
  });
  qookery.internal.components.TextFieldComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.TextFieldComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.PasswordField": {}
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
  qx.Class.define("qookery.internal.components.PasswordFieldComponent", {
    extend: qookery.internal.components.TextFieldComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.TextFieldComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createMainWidget: function _createMainWidget() {
        var widget = new qx.ui.form.PasswordField();

        this._setupTextField(widget);

        this._applyWidgetAttributes(widget);

        return widget;
      }
    }
  });
  qookery.internal.components.PasswordFieldComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.ButtonComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.RadioButton": {},
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
  qx.Class.define("qookery.internal.components.RadioButtonComponent", {
    extend: qookery.internal.components.ButtonComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ButtonComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createAtomWidget: function _createAtomWidget() {
        var radioButton = new qx.ui.form.RadioButton();

        this._applyAtomAttributes(radioButton);

        return radioButton;
      },
      setup: function setup() {
        var model = this.getAttribute("model");

        if (model != null) {
          var type = this.getAttribute("model-type", "String");
          this.setModel(qookery.util.Xml.parseValue(this, type, model));
        }

        return qookery.internal.components.RadioButtonComponent.prototype.setup.base.call(this);
      },
      getModel: function getModel() {
        return this.getMainWidget().getModel();
      },
      setModel: function setModel(model) {
        this.getMainWidget().setModel(model);
      }
    }
  });
  qookery.internal.components.RadioButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
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
      "qx.ui.container.Scroll": {},
      "qx.ui.container.Composite": {}
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
   * Component wrapping a Qooxdoo qx.ui.container.Scroll
   */
  qx.Class.define("qookery.internal.components.ScrollComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      __composite: null,
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

          case "scrollbar-x":
            return "String";

          case "scrollbar-y":
            return "String";
        }

        return qookery.internal.components.ScrollComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createContainerWidget: function _createContainerWidget() {
        var scroll = new qx.ui.container.Scroll();
        this.__composite = new qx.ui.container.Composite();
        scroll.add(this.__composite);

        this._applyAttribute("content-padding", scroll, "contentPadding");

        this._applyAttribute("content-padding-top", scroll, "contentPaddingTop");

        this._applyAttribute("content-padding-right", scroll, "contentPaddingRight");

        this._applyAttribute("content-padding-bottom", scroll, "contentPaddingBottom");

        this._applyAttribute("content-padding-left", scroll, "contentPaddingLeft");

        this._applyAttribute("scrollbar-x", scroll, "scrollbarX");

        this._applyAttribute("scrollbar-y", scroll, "scrollbarY");

        this._applyWidgetAttributes(scroll);

        return scroll;
      },
      getAttribute: function getAttribute(attributeName, defaultValue) {
        if (attributeName === "layout") return "none";
        return qookery.internal.components.ScrollComponent.prototype.getAttribute.base.call(this, attributeName, defaultValue);
      },
      getMainWidget: function getMainWidget() {
        return this.__composite;
      }
    }
  });
  qookery.internal.components.ScrollComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.AbstractSelectBoxComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.SelectBox": {}
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
   * Component for {@link qx.ui.form.SelectBox}
   */
  qx.Class.define("qookery.internal.components.SelectBoxComponent", {
    extend: qookery.internal.components.AbstractSelectBoxComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AbstractSelectBoxComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createMainWidget: function _createMainWidget() {
        var selectBox = new qx.ui.form.SelectBox();
        selectBox.setFormat(this.__getListItemLabel.bind(this));
        selectBox.addListener("changeSelection", function (event) {
          if (this._disableValueEvents) return;
          var newSelection = event.getData()[0];
          var model = newSelection ? newSelection.getModel() : null;
          if (model === qookery.internal.components.AbstractSelectBoxComponent._NULL_ITEM_MODEL) model = null;
          this.setValue(model);
        }, this);
        selectBox.addListener("keypress", function (event) {
          if (event.isShiftPressed() || event.isAltPressed() || event.isCtrlPressed()) return;

          switch (event.getKeyIdentifier()) {
            case "Delete":
            case "Backspace":
              this.setValue(null);
              event.preventDefault();
              return;
          }
        }, this);

        this._applySelectBoxAttributes(selectBox);

        return selectBox;
      },
      __getListItemLabel: function __getListItemLabel(listItem) {
        if (listItem == null) return "";
        return listItem.getLabel();
      },
      _updateUI: function _updateUI(value) {
        if (value == null) value = qookery.internal.components.AbstractSelectBoxComponent._NULL_ITEM_MODEL;
        var matchingItem = null;
        var selectBox = this.getMainWidget();
        var listItems = selectBox.getChildren();
        var modelProvider = this.getForm().getModelProvider();

        for (var i = 0; i < listItems.length; i++) {
          var listItem = listItems[i];
          var item = listItem.getModel();
          if (!modelProvider.areEqual(item, value)) continue;
          matchingItem = listItem;
          break;
        }

        var showingPlaceholder = true;

        if (matchingItem != null) {
          selectBox.setSelection([matchingItem]);
          showingPlaceholder = value === qookery.internal.components.AbstractSelectBoxComponent._NULL_ITEM_MODEL;
        } else {
          selectBox.resetSelection();
        }

        if (showingPlaceholder && this.getRequired()) selectBox.addState("showingPlaceholder");else selectBox.removeState("showingPlaceholder");
      },
      setSelection: function setSelection(itemNumber) {
        var selectablesItems = this.getMainWidget().getSelectables(true);
        if (!selectablesItems || selectablesItems[itemNumber] === undefined) return;
        this.getMainWidget().setSelection([selectablesItems[itemNumber]]);
      }
    }
  });
  qookery.internal.components.SelectBoxComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.core.Widget": {}
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
  qx.Class.define("qookery.internal.components.SeparatorComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      _createWidgets: function _createWidgets() {
        var separator = new qx.ui.core.Widget();
        separator.setBackgroundColor("border-separator");

        switch (this.getAttribute("variant", "horizontal")) {
          case "horizontal":
            separator.set({
              decorator: "separator-horizontal",
              width: 10,
              height: 1,
              allowStretchX: true,
              allowStretchY: false
            });
            break;

          case "vertical":
            separator.set({
              decorator: "separator-vertical",
              width: 1,
              height: 10,
              allowStretchX: false,
              allowStretchY: true
            });
            break;

          default:
            throw new Error("Unknown separator variant");
        }

        this._applyWidgetAttributes(separator);

        return [separator];
      }
    }
  });
  qookery.internal.components.SeparatorComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.form.Slider": {}
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
  qx.Class.define("qookery.internal.components.SliderComponent", {
    extend: qookery.internal.components.EditableComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
    },
    members: {
      _createMainWidget: function _createMainWidget() {
        var widget = new qx.ui.form.Slider();

        this._applyWidgetAttributes(widget);

        this._applyAttribute("minimum", widget, "minimum");

        this._applyAttribute("maximum", widget, "maximum");

        this._applyAttribute("page-step", widget, "pageStep");

        this._applyAttribute("single-step", widget, "singleStep");

        widget.addListener("changeValue", function (event) {
          if (this._disableValueEvents) return;
          this.setValue(event.getData());
        }, this);
        return widget;
      },
      _updateUI: function _updateUI(value) {
        if (!value) this.getMainWidget().resetValue();else this.getMainWidget().setValue(value);
      }
    }
  });
  qookery.internal.components.SliderComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.core.Spacer": {}
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
  qx.Class.define("qookery.internal.components.SpacerComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      _createWidgets: function _createWidgets() {
        var spacer = new qx.ui.core.Spacer();

        this._applyWidgetAttributes(spacer);

        return [spacer];
      },
      _applyEnabled: function _applyEnabled(enabled) {// Not supported
      }
    }
  });
  qookery.internal.components.SpacerComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.form.Spinner": {}
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
  qx.Class.define("qookery.internal.components.SpinnerComponent", {
    extend: qookery.internal.components.EditableComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
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

        return qookery.internal.components.SpinnerComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createMainWidget: function _createMainWidget() {
        var spinner = new qx.ui.form.Spinner();

        this._applyWidgetAttributes(spinner);

        spinner.setMinimum(this.getAttribute("minimum", 0));
        spinner.setMaximum(this.getAttribute("maximum", 100));
        spinner.setPageStep(this.getAttribute("page-step", 10));
        spinner.setSingleStep(this.getAttribute("single-step", 1));
        spinner.addListener("changeValue", function (event) {
          if (this._disableValueEvents) return;
          var value = event.getData();
          if (value !== null) value = parseInt(value, 10);

          this._setValueSilently(value);
        }, this);
        spinner.getChildControl("textfield").setTextAlign(this.getAttribute("text-align", null));

        this._applyAttribute("content-padding", spinner, "contentPadding");

        this._applyAttribute("content-padding-top", spinner, "contentPaddingTop");

        this._applyAttribute("content-padding-right", spinner, "contentPaddingRight");

        this._applyAttribute("content-padding-bottom", spinner, "contentPaddingBottom");

        this._applyAttribute("content-padding-left", spinner, "contentPaddingLeft");

        return spinner;
      },
      _updateUI: function _updateUI(value) {
        if (value === null) this.getMainWidget().resetValue();else this.getMainWidget().setValue(parseInt(value, 10));
      },
      _applyFormat: function _applyFormat(format) {
        this.getMainWidget().setNumberFormat(format);
      }
    }
  });
  qookery.internal.components.SpinnerComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.form.SplitButton": {},
      "qookery.Qookery": {}
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
  qx.Class.define("qookery.internal.components.SplitButtonComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "show":
            return "String";
        }

        return qookery.internal.components.SplitButtonComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Lifecycle
      _createWidgets: function _createWidgets() {
        var button = new qx.ui.form.SplitButton();

        this._applyAttribute("command", this, function (commandName) {
          var command = qookery.Qookery.getRegistry().getCommand(commandName);
          if (command == null) throw new Error("Undefined command " + commandName);
          button.setCommand(command);
        });

        this._applyAttribute("icon", button, "icon");

        this._applyAttribute("label", button, "label");

        this._applyAttribute("show", button, "show");

        this._applyWidgetAttributes(button);

        return [button];
      }
    }
  });
  qookery.internal.components.SplitButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.splitpane.Pane": {}
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
  qx.Class.define("qookery.internal.components.SplitPaneComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "flexes":
            return "IntegerList";
        }

        return qookery.internal.components.SplitPaneComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Creation
      _createContainerWidget: function _createContainerWidget() {
        var orientation = this.getAttribute("orientation", "horizontal");
        var pane = new qx.ui.splitpane.Pane(orientation);

        this._applyWidgetAttributes(pane);

        return pane;
      },
      getAttribute: function getAttribute(attributeName, defaultValue) {
        if (attributeName === "layout") return "none";
        return qookery.internal.components.SplitPaneComponent.prototype.getAttribute.base.call(this, attributeName, defaultValue);
      },
      add: function add(childComponent) {
        this._addChildComponent(childComponent);

        var flexes = this.getAttribute("flexes");
        var flex = flexes ? flexes[this.listChildren().length - 1] : 0;
        this.getMainWidget().add(childComponent.getMainWidget(), flex);
      }
    }
  });
  qookery.internal.components.SplitPaneComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.container.Stack": {}
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
  qx.Class.define("qookery.internal.components.StackComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    properties: {
      dynamic: {
        check: "Boolean",
        nullable: false,
        apply: "_applyDynamic"
      }
    },
    members: {
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "dynamic":
            return "Boolean";

          default:
            return qookery.internal.components.StackComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      create: function create(attributes) {
        qookery.internal.components.StackComponent.prototype.create.base.call(this, attributes);

        this._applyAttribute("dynamic", this, "dynamic");
      },
      _createContainerWidget: function _createContainerWidget() {
        var stack = new qx.ui.container.Stack();

        this._applyWidgetAttributes(stack);

        return stack;
      },
      getAttribute: function getAttribute(attributeName, defaultValue) {
        if (attributeName === "layout") return "none";
        return qookery.internal.components.StackComponent.prototype.getAttribute.base.call(this, attributeName, defaultValue);
      },
      setSelection: function setSelection(component) {
        var container = this.getMainWidget();
        var widget = component.getMainWidget();
        if (!container || !widget) return;
        container.setSelection([widget]);
      },
      getSelection: function getSelection() {
        var container = this.getMainWidget();
        if (!container) return null;
        var selection = container.getSelection();
        if (!selection || selection.length === 0) return null;
        return selection[0].getUserData("qookeryComponent");
      },
      selectNext: function selectNext() {
        var container = this.getMainWidget();
        var index = 0;
        var children = container.getChildren();
        var selection = container.getSelection();

        if (selection && selection.length === 1) {
          index = children.indexOf(selection[0]) + 1;
          if (index >= children.length) index = 0;
        }

        container.setSelection([children[index]]);
      },
      _applyDynamic: function _applyDynamic(dynamic) {
        var container = this.getMainWidget();
        if (!container) return null;
        container.setDynamic(dynamic);
      }
    }
  });
  qookery.internal.components.StackComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.tabview.TabView": {}
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
  qx.Class.define("qookery.internal.components.TabViewComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "bar-position":
            return "String";

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

          default:
            return qookery.internal.components.TabViewComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      // Construction
      _createContainerWidget: function _createContainerWidget() {
        var tabView = new qx.ui.tabview.TabView();

        this._applyAttribute("bar-position", tabView, "barPosition");

        this._applyAttribute("content-padding", tabView, "contentPadding");

        this._applyAttribute("content-padding-top", tabView, "contentPaddingTop");

        this._applyAttribute("content-padding-right", tabView, "contentPaddingRight");

        this._applyAttribute("content-padding-bottom", tabView, "contentPaddingBottom");

        this._applyAttribute("content-padding-left", tabView, "contentPaddingLeft");

        this._applyWidgetAttributes(tabView);

        return tabView;
      },
      getAttribute: function getAttribute(attributeName, defaultValue) {
        if (attributeName === "layout") return "none";
        return qookery.internal.components.TabViewComponent.prototype.getAttribute.base.call(this, attributeName, defaultValue);
      },
      getSelection: function getSelection() {
        var selection = this.getMainWidget().getSelection();
        if (!selection || selection.length !== 1) return null;
        return selection[0].getUserData("qookeryComponent");
      },
      setSelection: function setSelection(page) {
        this.getMainWidget().setSelection(page ? [page.getMainWidget()] : []);
      }
    }
  });
  qookery.internal.components.TabViewComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.tabview.Page": {}
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
  qx.Class.define("qookery.internal.components.TabViewPageComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "show-close-button":
            return "Boolean";
        }

        return qookery.internal.components.TabViewPageComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createContainerWidget: function _createContainerWidget() {
        var page = new qx.ui.tabview.Page(this.getAttribute("label", null), this.getAttribute("icon", null));

        this._applyAttribute("show-close-button", page, "showCloseButton");

        this._applyWidgetAttributes(page);

        return page;
      }
    }
  });
  qookery.internal.components.TabViewPageComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qx.ui.table.Table": {},
      "qx.ui.table.columnmodel.Resize": {},
      "qx.ui.table.selection.Model": {},
      "qookery.util.Xml": {},
      "qx.lang.Type": {},
      "qookery.Qookery": {},
      "qookery.IRegistry": {},
      "qookery.impl.DefaultTableModel": {}
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
  qx.Class.define("qookery.internal.components.TableComponent", {
    extend: qookery.internal.components.EditableComponent,
    events: {
      "changeSelection": "qx.event.type.Data"
    },
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
      this.__columns = [];
    },
    properties: {
      value: {
        refine: true,
        init: []
      }
    },
    members: {
      __columns: null,
      __tableModel: null,
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "column-visibility-button-visible":
            return "Boolean";

          case "editable":
            return "Boolean";

          case "flex":
            return "Integer";

          case "header-cells-visible":
            return "Boolean";

          case "header-click":
            return "ReplaceableString";

          case "header-icon":
            return "String";

          case "row-height":
            return "Number";

          case "show-cell-focus-indicator":
            return "Boolean";

          case "sortable":
            return "Boolean";

          case "status-bar-visible":
            return "Boolean";

          default:
            return qookery.internal.components.TableComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      // Creation
      _createMainWidget: function _createMainWidget() {
        var table = new qx.ui.table.Table(null, {
          tableColumnModel: function tableColumnModel(_table) {
            return new qx.ui.table.columnmodel.Resize(_table);
          }
        });
        var selectionMode;

        switch (this.getAttribute("selection-mode", "single")) {
          case "none":
            selectionMode = qx.ui.table.selection.Model.NO_SELECTION;
            break;

          case "single":
            selectionMode = qx.ui.table.selection.Model.SINGLE_SELECTION;
            break;

          case "single-interval":
            selectionMode = qx.ui.table.selection.Model.SINGLE_INTERVAL_SELECTION;
            break;

          case "multiple-interval":
            selectionMode = qx.ui.table.selection.Model.MULTIPLE_INTERVAL_SELECTION;
            break;

          case "multiple-interval-toggle":
            selectionMode = qx.ui.table.selection.Model.MULTIPLE_INTERVAL_SELECTION_TOGGLE;
            break;
        }

        var selectionModel = table.getSelectionModel();
        selectionModel.setSelectionMode(selectionMode);
        selectionModel.addListener("changeSelection", function (event) {
          var isSingleSelection = event.getTarget().getSelectionMode() === qx.ui.table.selection.Model.SINGLE_SELECTION;
          var eventData = isSingleSelection ? this.getSingleSelection() : this.getSelection();
          this.fireDataEvent("changeSelection", eventData);
        }, this);

        this._applyWidgetAttributes(table);

        this._applyAttribute("column-visibility-button-visible", table, "columnVisibilityButtonVisible");

        this._applyAttribute("row-height", table, "rowHeight");

        this._applyAttribute("status-bar-visible", table, "statusBarVisible");

        this._applyAttribute("show-cell-focus-indicator", table, "showCellFocusIndicator");

        this._applyAttribute("header-cells-visible", table, "headerCellsVisible");

        return table;
      },
      parseXmlElement: function parseXmlElement(elementName, xmlElement) {
        switch (elementName) {
          case "{http://www.qookery.org/ns/Form}table-model":
            if (this.__tableModel) throw new Error("Table model has already been created");
            var tableModelClassName = qookery.util.Xml.getAttribute(xmlElement, "class", Error);
            var tableModelClass = qx.Class.getByName(tableModelClassName);
            this.__tableModel = new tableModelClass(this, xmlElement);
            return true;

          case "{http://www.qookery.org/ns/Form}table-column":
            var column = qookery.util.Xml.parseAllAttributes(this, xmlElement);
            this.addColumn(column);
            return true;
        }

        return false;
      },
      setup: function setup() {
        if (this.__columns.length === 0) throw new Error("Table must have at least one column");
        var table = this.getMainWidget();
        var tableModel = this.getTableModel();

        if (qx.lang.Type.isFunction(tableModel["setup"])) {
          // Give model a chance to perform last minute changes
          tableModel["setup"].call(tableModel, table, this.__columns);
        }

        table.setTableModel(tableModel);
        var columnModel = table.getTableColumnModel();
        var resizeBehavior = columnModel.getBehavior();

        for (var i = 0; i < this.__columns.length; i++) {
          var column = this.__columns[i];
          if (column["visibility"] == "excluded") continue;

          if (column["width"] != null || column["flex"] != null) {
            var width = column["width"];
            if (width == null) width = undefined;else if (qx.lang.Type.isNumber(width)) ;else if (qx.lang.Type.isString(width)) {
              if (width.endsWith("*") || width.endsWith("%")) ;else width = parseInt(width, 10);
            } else throw new Error("Illegal value set as column width");
            var flex = column["flex"];
            if (flex == null) flex = undefined;else if (qx.lang.Type.isNumber(flex)) ;else if (qx.lang.Type.isString(flex)) flex = parseInt(flex, 10);else throw new Error("Illegal value set as column flex");
            resizeBehavior.setWidth(i, width, flex);
          }

          if (column["min-width"]) {
            resizeBehavior.setMinWidth(i, column["min-width"]);
          }

          if (column["max-width"]) {
            resizeBehavior.setMaxWidth(i, column["max-width"]);
          }

          var headerWidget = table.getPaneScroller(0).getHeader().getHeaderWidgetAtColumn(i);

          if (column["header-icon"]) {
            headerWidget.setIcon(column["header-icon"]);
          }

          if (column["tool-tip-text"]) {
            headerWidget.setToolTipText(column["tool-tip-text"]);
          }

          if (column["header-click"]) {
            headerWidget.addListener("tap", function (event) {
              column["header-click"](event);
            });
          }

          if (column["text-align"]) {
            headerWidget.getChildControl("label").setTextAlign(column["text-align"]);
          }

          if (column["cell-editor"]) {
            var cellEditorName = this.resolveQName(column["cell-editor"]);
            var cellEditorFactory = qookery.Qookery.getRegistry().get(qookery.IRegistry.P_CELL_EDITOR_FACTORY, cellEditorName, true);
            var cellEditor = cellEditorFactory(this, column);
            columnModel.setCellEditorFactory(i, cellEditor);
          }

          var cellRendererName = this.resolveQName(column["cell-renderer"] || "{http://www.qookery.org/ns/Form}model");
          var cellRendererFactory = qookery.Qookery.getRegistry().get(qookery.IRegistry.P_CELL_RENDERER_FACTORY, cellRendererName, true);
          var cellRenderer = cellRendererFactory(this, column);
          columnModel.setDataCellRenderer(i, cellRenderer);

          if (column["visibility"] == "hidden") {
            columnModel.setColumnVisible(i, false);
          }
        }

        qookery.internal.components.TableComponent.prototype.setup.base.call(this);
      },
      // Public methods
      getTableModel: function getTableModel() {
        if (this.__tableModel == null) this.__tableModel = new qookery.impl.DefaultTableModel(this);
        return this.__tableModel;
      },
      setTableModel: function setTableModel(tableModel) {
        if (this.__tableModel != null) this.__tableModel.dispose();
        this.__tableModel = tableModel;
      },
      addColumn: function addColumn(column) {
        this.__columns.push(column);
      },
      getColumns: function getColumns() {
        return this.__columns;
      },
      setColumns: function setColumns(columns) {
        this.__columns = columns;
      },
      isSelectionEmpty: function isSelectionEmpty() {
        var selectionModel = this.getMainWidget().getSelectionModel();
        return selectionModel.isSelectionEmpty();
      },
      getSelection: function getSelection() {
        var selection = [];
        if (!this.__tableModel) return selection;
        var selectionModel = this.getMainWidget().getSelectionModel();
        selectionModel.iterateSelection(function (rowIndex) {
          var rowData = this.__tableModel.getRowData(rowIndex);

          if (rowData !== null) selection.push(rowData);
        }, this);
        return selection;
      },
      resetSelection: function resetSelection() {
        this.getMainWidget().getSelectionModel().resetSelection();
      },
      getSingleSelection: function getSingleSelection() {
        var selection = this.getSelection();
        if (selection.length !== 1) return null;
        return selection[0];
      },
      getSelectedRowIndex: function getSelectedRowIndex() {
        var selectedRowIndex = null;
        this.getMainWidget().getSelectionModel().iterateSelection(function (rowIndex) {
          selectedRowIndex = rowIndex;
        });
        return selectedRowIndex;
      },
      setSelectedRowIndex: function setSelectedRowIndex(rowIndex, setFocus) {
        this.getMainWidget().getSelectionModel().setSelectionInterval(rowIndex, rowIndex);
        if (setFocus) this.getMainWidget().setFocusedCell(0, rowIndex, true);
      },
      selectAll: function selectAll() {
        this.getMainWidget().getSelectionModel().setSelectionInterval(0, this.getTableModel().getRowCount() - 1);
      },
      // Component overrides
      _updateUI: function _updateUI(value) {
        // Setting the model data requires some cooperation from the model implementation
        var tableModel = this.getTableModel();

        if (tableModel && tableModel.setData && typeof tableModel.setData == "function") {
          tableModel.setData(value);
        }
      },
      addEventHandler: function addEventHandler(eventName, handler, onlyOnce) {
        switch (eventName) {
          case "dataChanged":
            var methodName = onlyOnce ? "addListenerOnce" : "addListener";
            this.getTableModel()[methodName]("dataChanged", handler, this);
            return;
        }

        qookery.internal.components.TableComponent.prototype.addEventHandler.base.call(this, eventName, handler, onlyOnce);
      },
      _applyValid: function _applyValid() {// Overriden in order to prevent default handling
      },
      _applyRequired: function _applyRequired() {// Overriden in order to prevent default handling
        // TODO Qookery: Add a validator that checks that table is not empty
      }
    },
    destruct: function destruct() {
      this.__columns.length = 0;

      this._disposeObjects("__tableModel");
    }
  });
  qookery.internal.components.TableComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.internal.components.FieldComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.TextArea": {}
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
  qx.Class.define("qookery.internal.components.TextAreaComponent", {
    extend: qookery.internal.components.FieldComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.FieldComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "auto-size":
            return "Boolean";

          case "minimal-line-height":
            return "Integer";

          case "single-step":
            return "Integer";

          case "wrap":
            return "Boolean";
        }

        return qookery.internal.components.TextAreaComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Construction
      _createMainWidget: function _createMainWidget() {
        var widget = new qx.ui.form.TextArea();

        this._setupTextField(widget);

        this._applyWidgetAttributes(widget);

        this._applyAttribute("auto-size", widget, "autoSize");

        this._applyAttribute("minimal-line-height", widget, "minimalLineHeight");

        this._applyAttribute("single-step", widget, "singleStep");

        this._applyAttribute("wrap", widget, "wrap");

        return widget;
      }
    }
  });
  qookery.internal.components.TextAreaComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "defer": "runtime",
        "require": true
      },
      "qookery.internal.components.AtomComponent": {
        "construct": true,
        "require": true
      },
      "qx.ui.form.ToggleButton": {
        "defer": "runtime"
      },
      "qookery.util.Xml": {},
      "qx.ui.form.MModelProperty": {
        "defer": "runtime"
      },
      "qx.ui.form.MForm": {
        "defer": "runtime"
      }
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
  qx.Class.define("qookery.internal.components.ToggleButtonComponent", {
    extend: qookery.internal.components.AtomComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.AtomComponent.constructor.call(this, parentComponent);
    },
    members: {
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "tri-state":
            return "Boolean";
        }

        return qookery.internal.components.ToggleButtonComponent.prototype.getAttributeType.base.call(this, attributeName);
      },
      // Creation
      _createAtomWidget: function _createAtomWidget() {
        var toggleButton = new qx.ui.form.ToggleButton();

        this._applyAtomAttributes(toggleButton);

        this._applyAttribute("tri-state", toggleButton, "triState");

        return toggleButton;
      },
      setup: function setup() {
        var model = this.getAttribute("model");

        if (model != null) {
          var type = this.getAttribute("model-type", "String");
          this.setModel(qookery.util.Xml.parseValue(this, type, model));
        }

        return qookery.internal.components.ToggleButtonComponent.prototype.setup.base.call(this);
      },
      getModel: function getModel() {
        return this.getMainWidget().getModel();
      },
      setModel: function setModel(model) {
        this.getMainWidget().setModel(model);
      },
      getValue: function getValue() {
        return this.getMainWidget().getValue();
      },
      setValue: function setValue(value) {
        this.getMainWidget().setValue(value);
      }
    },
    defer: function defer() {
      // TODO Patching a QX class goes against the "thin wrapper" spirit of Qookery- consider future removal
      qx.Class.patch(qx.ui.form.ToggleButton, qx.ui.form.MModelProperty);
      qx.Class.patch(qx.ui.form.ToggleButton, qx.ui.form.MForm);
    }
  });
  qookery.internal.components.ToggleButtonComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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

//
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

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qx.util.format.IFormat": {
        "require": true
      }
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
  qx.Class.define("qookery.internal.formats.CustomFormat", {
    extend: qx.core.Object,
    implement: [qx.util.format.IFormat],
    construct: function construct(options) {
      qx.core.Object.constructor.call(this);
      var expression = options["expression"];

      if (expression) {
        this.__formatFunction = new Function(["value"], "return(" + expression + ");");
        return;
      }

      var format = options["format"];

      if (format) {
        this.__formatFunction = format;
        return;
      }

      throw new Error("An expression or function must be provided");
    },
    members: {
      __formatFunction: null,
      format: function format(obj) {
        if (!this.__formatFunction) return obj;

        try {
          return this.__formatFunction.apply(this, [obj]);
        } catch (e) {
          this.error("Error applying custom format", e);
          return "";
        }
      },
      parse: function parse(str) {
        throw new Error("Parsing is not supported");
      }
    }
  });
  qookery.internal.formats.CustomFormat.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.util.format.DateFormat": {
        "construct": true,
        "require": true
      }
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
  qx.Class.define("qookery.internal.formats.DateFormat", {
    extend: qx.util.format.DateFormat,
    construct: function construct(options) {
      qx.util.format.DateFormat.constructor.call(this, options["format"], options["locale"]);
    }
  });
  qookery.internal.formats.DateFormat.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qx.util.format.IFormat": {
        "require": true
      },
      "qookery.Qookery": {
        "construct": true
      },
      "qx.lang.String": {
        "construct": true
      },
      "qx.data.Conversion": {}
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
  qx.Class.define("qookery.internal.formats.MapFormat", {
    extend: qx.core.Object,
    implement: [qx.util.format.IFormat],
    construct: function construct(options) {
      qx.core.Object.constructor.call(this);
      var mapName = options["map"];
      this.__map = qookery.Qookery.getRegistry().getMap(mapName);
      if (!this.__map) throw new Error(qx.lang.String.format("Map '%1' not registered", [mapName]));
      this.__fallback = options["fallback"];
    },
    members: {
      __map: null,
      __fallback: null,
      format: function format(value) {
        if (value == null) return "";
        var mappedValue = this.__map[value];
        if (mappedValue != null) value = mappedValue;else if (this.__fallback != null) value = this.__fallback;
        return qx.data.Conversion.toString(value);
      },
      parse: function parse(text) {
        return text;
      }
    }
  });
  qookery.internal.formats.MapFormat.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.util.format.NumberFormat": {
        "construct": true,
        "require": true
      }
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
  qx.Class.define("qookery.internal.formats.NumberFormat", {
    extend: qx.util.format.NumberFormat,
    construct: function construct(options) {
      qx.util.format.NumberFormat.constructor.call(this);

      this.__setOptions(options);
    },
    members: {
      __setOptions: function __setOptions(options) {
        for (var key in options) this.__setOption(key, options[key]);
      },
      __setOption: function __setOption(key, value) {
        switch (key) {
          case "groupingUsed":
            this.setGroupingUsed(!!value);
            return;

          case "prefix":
            this.setPrefix(value);
            return;

          case "postfix":
            this.setPostfix(value);
            return;

          case "fractionDigits":
            // Shorthand for setting both min and max
            this.setMinimumFractionDigits(parseInt(value));
            this.setMaximumFractionDigits(parseInt(value));
            return;

          case "minimumFractionDigits":
            this.setMinimumFractionDigits(parseInt(value));
            return;

          case "maximumFractionDigits":
            this.setMaximumFractionDigits(parseInt(value));
            return;

          case "integerDigits":
            // Shorthand for setting both min and max
            this.setMinimumIntegerDigits(parseInt(value));
            this.setMaximumIntegerDigits(parseInt(value));
            return;

          case "minimumIntegerDigits":
            this.setMinimumIntegerDigits(parseInt(value));
            return;

          case "maximumIntegerDigits":
            this.setMaximumIntegerDigits(parseInt(value));
            return;
        }
      }
    }
  });
  qookery.internal.formats.NumberFormat.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.ui.table.cellrenderer.Abstract": {
        "construct": true,
        "require": true
      },
      "qookery.Qookery": {
        "construct": true
      },
      "qx.lang.String": {
        "construct": true
      },
      "qx.bom.String": {},
      "qx.lang.Object": {}
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
  qx.Class.define("qookery.internal.components.table.CellRenderer", {
    extend: qx.ui.table.cellrenderer.Abstract,
    statics: {
      CSS_KEYS: ["text-align", "color", "font-family", "font-size", "font-style", "font-weight", "line-height", "white-space"]
    },
    construct: function construct(component, column) {
      qx.ui.table.cellrenderer.Abstract.constructor.call(this);
      this.__column = column;
      this.__component = component;
      this.__format = column["format"] != null ? qookery.Qookery.getRegistry().createFormat(column["format"]) : null;
      this.__map = column["map"] != null ? qookery.Qookery.getRegistry().getMap(column["map"]) : null;
      var styleActionName = column["cell-renderer-callback"] || null;
      if (styleActionName != null && !component.isActionSupported(styleActionName)) throw new Error(qx.lang.String.format("Cell render callback '%1' is not supported by component '%2'", [styleActionName, component.toString()]));else this.__styleActionName = styleActionName;
    },
    members: {
      __column: null,
      __format: null,
      __map: null,
      __styleActionName: null,
      __component: null,
      _getContentHtml: function _getContentHtml(cellInfo) {
        var text = this._formatValue(cellInfo);

        return qx.bom.String.escape(text);
      },
      _formatValue: function _formatValue(cellInfo) {
        var value = cellInfo.value;
        if (value == null) return "";
        if (this.__format) try {
          value = this.__format.format(value);
        } catch (e) {
          this.warn("Error formatting cell value", e);
        }

        if (this.__map != null) {
          var mappedValue = this.__map[value];
          if (mappedValue != null) value = mappedValue;
        }

        var modelProvider = this.__component.getForm().getModelProvider();

        var label = modelProvider.getLabel(value, "short");
        return label != null ? label : "";
      },
      _getCellStyle: function _getCellStyle(cellInfo) {
        var column = this.__column;
        var style = qookery.internal.components.table.CellRenderer.CSS_KEYS.reduce(function (cellStyle, key) {
          var value = column[key];
          if (value != null) cellStyle[key] = value;
          return cellStyle;
        }, {});

        if (this.__styleActionName != null) {
          var result = this.__component.executeAction(this.__styleActionName, cellInfo);

          if (result != null) qx.lang.Object.mergeWith(style, result, true);
        }

        return qookery.internal.components.table.CellRenderer.CSS_KEYS.reduce(function (cellStyle, key) {
          var value = style[key];
          if (value != null) cellStyle += key + ":" + value + ";";
          return cellStyle;
        }, "");
      },
      getColumn: function getColumn() {
        return this.__column;
      }
    },
    destruct: function destruct() {
      this._disposeObjects("__format");
    }
  });
  qookery.internal.components.table.CellRenderer.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qookery.IFormParser": {
        "require": true
      },
      "qookery.internal.Registry": {
        "usage": "dynamic",
        "require": true
      },
      "qx.dom.Element": {},
      "qx.dom.Hierarchy": {},
      "qx.dom.Node": {},
      "qx.lang.String": {},
      "qookery.util.Xml": {},
      "qookery.IComponent": {},
      "qookery.IFormComponent": {},
      "qx.lang.Type": {},
      "qx.lang.Object": {},
      "qookery.IContainerComponent": {},
      "qookery.Qookery": {},
      "qx.xml.Document": {},
      "qx.locale.Manager": {},
      "qookery.util.Debug": {},
      "qx.log.Logger": {},
      "qx.bom.MediaQuery": {}
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
   * The FormParser will parse a form XML document to create
   * a fully populated IFormComponent into a container composite
   */
  qx.Class.define("qookery.internal.FormParser", {
    extend: qx.core.Object,
    implement: [qookery.IFormParser],
    statics: {
      __REGISTRY: qookery.internal.Registry.getInstance()
    },
    construct: function construct(variables, serviceResolver) {
      qx.core.Object.constructor.call(this);
      {
        this.assertMap(variables);
        this.assertFunction(serviceResolver);
      }
      this.__variables = variables;
      this.__serviceResolver = serviceResolver;
    },
    members: {
      __variables: null,
      __serviceResolver: null,
      // IFormParser implementation
      parseXmlDocument: function parseXmlDocument(xmlDocument, parentComponent) {
        if (xmlDocument == null) throw new Error("An XML form must be supplied");

        var component = this.__parseStatementBlock(xmlDocument, parentComponent);

        if (component == null) throw new Error("No Qookery component found within XML document");
        return component;
      },
      // Internal methods
      __parseStatementBlock: function __parseStatementBlock(blockElement, component) {
        if (!qx.dom.Element.hasChildren(blockElement)) return null;
        var selectionMade = false;
        return qx.dom.Hierarchy.getChildElements(blockElement).reduce(function (previousResult, statementElement) {
          var elementQName = qx.dom.Node.getName(statementElement);
          if (elementQName === "parsererror") throw new Error(qx.lang.String.format("Parser error in statement block: %1", [qx.dom.Node.getText(statementElement)]));
          var namespaces = qookery.util.Xml.getNamespaceDeclarations(statementElement);
          var elementQName = qx.dom.Node.getName(statementElement);
          var elementName = qookery.util.Xml.resolveQName(function (prefix) {
            if (namespaces != null) {
              var namespaceUri = namespaces[prefix];
              if (namespaceUri != null) return namespaceUri;
            }

            if (component != null) {
              return component.resolveNamespacePrefix(prefix);
            }

            return null;
          }, elementQName); // First consult the component registry

          if (this.constructor.__REGISTRY.isComponentTypeAvailable(elementName)) {
            return this.__parseComponent(statementElement, component, elementName, namespaces);
          } // Assert that we are within the context of a component


          if (component == null) throw new Error("Flow control and other non-component statements must appear with the context of a component"); // Then check a number of special elements known by parser

          switch (elementName) {
            case "{http://www.qookery.org/ns/Form}else":
              if (selectionMade) return previousResult;

            /* fall through */

            case "{http://www.qookery.org/ns/Form}if":
              selectionMade = this.__parseIfElse(statementElement, component);
              return previousResult;

            case "{http://www.qookery.org/ns/Form}script":
              this.__parseScript(statementElement, component);

              return previousResult;

            case "{http://www.qookery.org/ns/Form}switch":
              this.__parseSwitch(statementElement, component);

              return previousResult;

            case "{http://www.w3.org/2001/XInclude}include":
              this.__parseXInclude(statementElement, component);

              return previousResult;
          } // Lastly, attempt to delegate element parsing to current component


          if (component.parseXmlElement(elementName, statementElement)) return previousResult; // Tough luck with this element, interrupt parser progress here

          throw new Error(qx.lang.String.format("Unexpected element '%1' encountered in statement block", [elementName]));
        }.bind(this), null);
      },
      __parseComponent: function __parseComponent(componentElement, parentComponent, componentName, namespaces) {
        // Instantiate and initialize new component
        var component = this.constructor.__REGISTRY.createComponent(componentName, parentComponent);

        try {
          // Set component attributes
          var componentId = qookery.util.Xml.getAttribute(componentElement, "id");
          if (componentId != null) component.setAttribute(qookery.IComponent.A_ID, componentId);
          if (namespaces != null) component.setAttribute(qookery.IComponent.A_NAMESPACES, namespaces); // Additional attributes applicable exclusively to forms

          if (qx.Class.implementsInterface(component.constructor, qookery.IFormComponent)) {
            component.setAttribute(qookery.IFormComponent.A_SERVICE_RESOLVER, this.__serviceResolver);
            component.setAttribute(qookery.IFormComponent.A_VARIABLES, this.__variables);
            var translationPrefix = qookery.util.Xml.getAttribute(componentElement, "translation-prefix") || componentId;
            if (translationPrefix != null) component.setAttribute(qookery.IFormComponent.A_TRANSLATION_PREFIX, translationPrefix);
          } // Register component into its form


          if (componentId != null && parentComponent != null) parentComponent.getForm().putComponent(componentId, component); // Attribute parsing

          var attributes = qookery.util.Xml.parseAllAttributes(component, componentElement);
          var useAttributes = qookery.util.Xml.getAttribute(componentElement, "use-attributes");
          if (useAttributes != null) useAttributes.split(/\s+/).forEach(function (variableName) {
            var useAttributes = component.getForm().getVariable(variableName);
            if (!qx.lang.Type.isObject(useAttributes)) throw new Error("Variable specified in use-attributes not found or of incorrect type");
            qx.lang.Object.mergeWith(attributes, useAttributes);
          }); // Component creation

          component.create(attributes); // Children parsing

          this.__parseStatementBlock(componentElement, component); // Component setup


          component.setup(); // Attach to container

          if (parentComponent != null) {
            var display = qookery.util.Xml.getAttribute(componentElement, "display", "inline");

            switch (display) {
              case "inline":
                if (!qx.Class.hasInterface(parentComponent.constructor, qookery.IContainerComponent)) throw new Error("Attempted to add a component to a non-container component");
                parentComponent.add(component);
                break;

              case "none":
                // Do nothing
                break;

              default:
                throw new Error("Unsupported display attribute value");
            }
          } // Return new component


          var c = component;
          component = null;
          return c;
        } finally {
          // Prevent memory leaks in case component creation failed midway
          if (component != null) component.dispose();
        }
      },
      __parseXInclude: function __parseXInclude(xIncludeElement, parentComponent) {
        var formUrl = qookery.util.Xml.getAttribute(xIncludeElement, "href", Error);
        formUrl = qookery.util.Xml.parseValue(parentComponent, "ReplaceableString", formUrl);
        var xmlString = qookery.Qookery.getService("qookery.IResourceLoader", true).loadResource(formUrl);
        var xmlDocument = qx.xml.Document.fromString(xmlString);
        var formParser = new qookery.internal.FormParser(this.__variables, this.__serviceResolver);

        try {
          var component = formParser.parseXmlDocument(xmlDocument, parentComponent);
          var xmlIdAttribute = xIncludeElement.attributes["xml:id"];
          if (xmlIdAttribute != null) parentComponent.getForm().putComponent(xmlIdAttribute.value, component);
          return component;
        } catch (e) {
          this.error("Error creating form editor", e);
        } finally {
          formParser.dispose();
        }
      },
      __parseIfElse: function __parseIfElse(selectionElement, component) {
        var expression = qookery.util.Xml.getAttribute(selectionElement, "expression");

        if (expression != null) {
          var result = component.evaluateExpression(expression);
          if (!result) return false;
        }

        var mediaQuery = qookery.util.Xml.getAttribute(selectionElement, "media-query");

        if (mediaQuery != null) {
          var query = this.__getMediaQuery(mediaQuery);

          if (!query.isMatching()) return false;
        }

        var language = qookery.util.Xml.getAttribute(selectionElement, "{http://www.w3.org/XML/1998/namespace}lang");

        if (language != null) {
          if (qx.locale.Manager.getInstance().getLanguage() != language) return false;
        }

        this.__parseStatementBlock(selectionElement, component);

        return true;
      },
      __parseScript: function __parseScript(scriptElement, component) {
        // Load source code
        var sourceCode = qookery.util.Xml.getNodeText(scriptElement);
        var scriptUrl = qookery.util.Xml.getAttribute(scriptElement, "source");
        if (scriptUrl != null) sourceCode = qookery.Qookery.getService("qookery.IResourceLoader", true).loadResource(scriptUrl);
        if (sourceCode == null) throw new Error("Empty <script> element"); // Compile script function

        var functionConstructorArgs = ["$"];
        var argumentNames = qookery.util.Xml.getAttribute(scriptElement, "arguments");

        if (argumentNames != null) {
          Array.prototype.push.apply(functionConstructorArgs, argumentNames.split(/\s+/));
        } else if (qookery.util.Xml.getAttribute(scriptElement, "event") != null) {
          // For backward compatibility, add the implied "event" argument
          functionConstructorArgs.push("event");
        }

        functionConstructorArgs.push(sourceCode);
        var scriptFunction;

        try {
          scriptFunction = Function.apply(null, functionConstructorArgs);
        } catch (e) {
          throw new Error("Error compiling script '" + sourceCode.truncate(50) + "': " + e.message);
        } // Preload some XML attributes


        var actionNames = qookery.util.Xml.getAttribute(scriptElement, "action");
        var functionNames = qookery.util.Xml.getAttribute(scriptElement, "name");
        var eventNames = qookery.util.Xml.getAttribute(scriptElement, "event");
        var mediaQuery = qookery.util.Xml.getAttribute(scriptElement, "media-query");
        var onlyOnce = qookery.util.Xml.getAttribute(scriptElement, "once") === "true";
        var preventRecursion = qookery.util.Xml.getAttribute(scriptElement, "recursion") === "prevent";
        var debounceMillis = parseInt(qookery.util.Xml.getAttribute(scriptElement, "debounce"), 10) || 0;
        var execute = qookery.util.Xml.getAttribute(scriptElement, "execute") === "true";
        if (!execute && actionNames == null && functionNames == null && eventNames == null && mediaQuery == null) execute = true; // Create list of target components

        var componentIds = qookery.util.Xml.getAttribute(scriptElement, "component");
        var components = componentIds == null ? [component] : componentIds.split(/\s+/).map(function (componentId) {
          return component.getForm().getComponent(componentId, true);
        }); // Apply requested operations to all target components

        components.forEach(function (component) {
          var _componentFunction = function componentFunction() {
            if (component.isDisposed()) return;
            if (preventRecursion && _componentFunction.__isRunning === true) return;
            var scriptArguments = Array.prototype.slice.call(arguments);
            scriptArguments.unshift(component.getForm().getScriptingContext());

            try {
              _componentFunction.__isRunning = true;
              return scriptFunction.apply(component, scriptArguments);
            } catch (error) {
              qookery.util.Debug.logScriptError(component, scriptFunction.toString(), error);
              throw error;
            } finally {
              _componentFunction.__isRunning = false;
            }
          };

          if (debounceMillis > 0) {
            var debounceFunction = _componentFunction;

            _componentFunction = function _componentFunction() {
              var timerId = debounceFunction.__timerId;

              if (timerId != null) {
                debounceFunction.__timerId = null;
                clearTimeout(timerId);
              }

              var bindArguments = [this];
              Array.prototype.push.apply(bindArguments, arguments);
              var setTimoutFunction = Function.prototype.bind.apply(debounceFunction, bindArguments);
              debounceFunction.__timerId = setTimeout(setTimoutFunction, debounceMillis);
            };
          }

          if (mediaQuery != null) {
            var query = this.__getMediaQuery(mediaQuery);

            if (!(execute && onlyOnce)) {
              var methodName = onlyOnce ? "addListenerOnce" : "addListener";
              var listenerId = query[methodName]("change", function (data) {
                _componentFunction(data["matches"], data["query"]);
              });
              component.addToDisposeList({
                dispose: function dispose() {
                  query.removeListenerById(listenerId);
                }
              });
            }

            if (execute) _componentFunction(query.isMatching(), mediaQuery);
          } else {
            if (functionNames != null) functionNames.split(/\s+/).forEach(function (functionName) {
              component.getForm().getScriptingContext()[functionName] = _componentFunction;
            });
            if (actionNames != null) actionNames.split(/\s+/).forEach(function (actionName) {
              component.setAction(actionName, _componentFunction);
            });
            if (eventNames != null) eventNames.split(/\s+/).forEach(function (eventName) {
              // Event handlers are wrapped into try-catch blocks in order to ensure subsequent handlers will be called
              component.addEventHandler(eventName, function (varargs) {
                try {
                  _componentFunction.apply(component, arguments);
                } catch (error) {
                  qx.log.Logger.error(component, "Event handler ", eventName, " error:", error);
                }
              }, onlyOnce);
            });
            if (execute) _componentFunction();
          }
        }, this);
      },
      __parseSwitch: function __parseSwitch(switchElement, component) {
        if (!qx.dom.Element.hasChildren(switchElement)) return;
        var switchExpression = qookery.util.Xml.getAttribute(switchElement, "expression", Error);
        var switchResult = component.evaluateExpression(switchExpression);
        var children = qx.dom.Hierarchy.getChildElements(switchElement);

        for (var i = 0; i < children.length; i++) {
          var caseElement = children[i];
          var elementName = qx.dom.Node.getName(caseElement);
          if (elementName !== "case") throw new Error(qx.lang.String.format("Unexpected element in switch block: %1", [qx.dom.Node.getText(switchElement)]));
          var caseExpression = qookery.util.Xml.getAttribute(caseElement, "expression");

          if (caseExpression != null) {
            var caseResult = component.evaluateExpression(caseExpression);
            if (caseResult != switchResult) continue;
          }

          this.__parseStatementBlock(caseElement, component);

          return true;
        }

        return false;
      },
      __getMediaQuery: function __getMediaQuery(mediaQuery) {
        var query = this.constructor.__REGISTRY.getMediaQuery(mediaQuery);

        if (query != null) return query;
        return new qx.bom.MediaQuery(mediaQuery);
      }
    }
  });
  qookery.internal.FormParser.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.ui.window.Window": {
        "construct": true,
        "require": true
      },
      "qx.ui.layout.Grow": {
        "construct": true
      },
      "qx.xml.Document": {},
      "qookery.Qookery": {},
      "qx.lang.Object": {}
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
   * Window implementation that uses a Qookery form for its contents
   */
  qx.Class.define("qookery.impl.FormWindow", {
    extend: qx.ui.window.Window,

    /**
     * Create a new Qookery form window
     *
     * @param title { String } title of the window
     * @param icon { uri } icon of the window
     * @param options {Map ? null} options as defined below
     * @param thisArg {Object ? null} an object to set as <code>this</code> for callbacks
     *
     * @option caption {String ? null} a caption for the created Window instance
     * @option icon {String ? null} an icon for the created Window instance
     * @option onClose {Function ? null} a callback that will receive the form's result property when window is closed
     */
    construct: function construct(caption, icon, options, thisArg) {
      qx.ui.window.Window.constructor.call(this, caption, icon);
      this.setLayout(new qx.ui.layout.Grow());
      this.set({
        modal: true,
        showMinimize: false,
        showMaximize: false,
        contentPadding: 10
      });

      if (options) {
        if (options["icon"] !== undefined) this.setIcon(options["icon"]);
        if (options["caption"] !== undefined) this.setCaption(options["caption"]);
        if (options["allowClose"] !== undefined) this.setAllowClose(options["allowClose"]);
        if (options["onClose"] !== undefined) this.__onClose = options["onClose"].bind(thisArg);
        if (options["showMaximize"] !== undefined) this.setShowMaximize(options["showMaximize"]);
        if (options["contentPadding"] !== undefined) this.setContentPadding(options["contentPadding"]);
        if (options["openMaximized"] === true) this.maximize();
      }
    },
    members: {
      __formComponent: null,
      __disposeForm: false,
      __onClose: null,

      /**
       * Create and open Qookery window
       *
       * @param formXml {String} the XML source of the form to create
       * @param model {Object} an initial model to set, or <code>null</code> if not needed
       */
      createAndOpen: function createAndOpen(formXml, model, variables) {
        var xmlDocument = qx.xml.Document.fromString(formXml);
        var parser = qookery.Qookery.createFormParser(this.__createVariables(variables));

        try {
          this.__formComponent = parser.parseXmlDocument(xmlDocument);
          this.__disposeForm = true;
          this.openForm(this.__formComponent, model);
        } catch (e) {
          this.error("Error creating form window", e);
        } finally {
          parser.dispose();
        }
      },
      openForm: function openForm(formComponent, model) {
        this.__formComponent = formComponent;
        this.getContentElement().setAttribute("qkid", formComponent.getId());
        this.addListenerOnce("appear", function (event) {
          formComponent.focus();
        }, this);
        formComponent.addListenerOnce("close", function (event) {
          formComponent.setModel(null);
          if (this.__onClose) this.__onClose(event.getData());
          this.destroy();
        }, this);
        formComponent.addListener("changeTitle", function (event) {
          if (event.getData()) this.setCaption(event.getData());
        }, this);

        if (!this.getCaption()) {
          var formTitle = formComponent.getTitle();
          if (formTitle) this.setCaption(formTitle);else this.setCaption(this._getFallbackCaption());
        }

        var formIcon = formComponent.getIcon();
        if (formIcon && !this.getIcon()) this.setIcon(formIcon);
        if (model) formComponent.setModel(model);
        this.add(formComponent.getMainWidget());
        this.open();
        this.addListenerOnce("appear", function () {
          this.center();
        }, this);
      },
      getFormComponent: function getFormComponent() {
        return this.__formComponent;
      },
      _getFallbackCaption: function _getFallbackCaption() {
        // Override to provide a fallback caption
        return "";
      },
      _onCloseButtonTap: function _onCloseButtonTap(event) {
        this.__formComponent.close();
      },
      __createVariables: function __createVariables(variables) {
        variables = variables != null ? qx.lang.Object.clone(variables, false) : {};
        if (variables.hasOwnProperty("window")) throw new Error("Variable named 'window' is reserved");
        variables["window"] = this;
        return variables;
      }
    },
    destruct: function destruct() {
      if (this.__disposeForm) this._disposeObjects("__formComponent");else this.remove(this.__formComponent.getMainWidget());
    }
  });
  qookery.impl.FormWindow.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.MLogging": {
        "require": true
      },
      "qookery.Qookery": {},
      "qx.lang.String": {},
      "qx.bom.request.Script": {},
      "qx.util.TimerManager": {}
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
  qx.Class.define("qookery.internal.util.Library", {
    extend: Object,
    include: [qx.core.MLogging],
    construct: function construct(name, resourceNames, dependencies, postLoadCallback) {
      this.__name = name;
      this.__resourceNames = resourceNames;
      this.__dependencies = dependencies;
      this.__isLoaded = false;
      this.__continuations = [];
      this.__postLoadCallback = postLoadCallback;
    },
    members: {
      __name: null,
      __resourceNames: null,
      __dependencies: null,
      __isLoaded: null,
      __continuations: null,
      __postLoadCallback: null,
      getName: function getName() {
        return this.__name;
      },
      addResource: function addResource(resourceName) {
        if (this.__isLoaded) throw new Error("Adding resource URIs to an already loaded library is not possible");

        this.__resourceNames.push(resourceName);
      },
      isLoaded: function isLoaded() {
        return this.__isLoaded;
      },
      load: function load(continuation, thisArg) {
        // If loaded, just call the continuation
        if (this.__isLoaded) {
          continuation.call(thisArg, null);
          return;
        } // Push continuation to the queue


        this.__continuations.push(continuation.bind(thisArg)); // If not the first continuation, return since loading has been already started


        var isLoading = this.__continuations.length !== 1;
        if (isLoading) return; // Start the library loading

        this.__loadLibrary();
      },
      __loadLibrary: function __loadLibrary() {
        // In case there are dependencies, load them
        if (this.__dependencies != null && this.__dependencies.length > 0) return this.__loadNextDependency(); // In case there are needed resources, load them

        if (this.__resourceNames != null && this.__resourceNames.length > 0) return this.__loadNextResource(); // Invoke the post-load continuation, if set

        if (this.__postLoadCallback != null) try {
          var finished = this.__postLoadCallback(this.__onLibraryLoaded.bind(this));

          if (finished === false) // Callback requested to take over library loading sequence
            return;
        } catch (error) {
          this.__invokeContinuations(error);

          return;
        }

        this.__onLibraryLoaded();
      },
      __onLibraryLoaded: function __onLibraryLoaded() {
        // We are done loading, mark our success
        this.__isLoaded = true;
        this.debug("Loaded", this.__name); // Invoke any waiting callbacks

        this.__invokeContinuations(null);
      },
      __loadNextDependency: function __loadNextDependency() {
        var libraryName = this.__dependencies.shift();

        qookery.Qookery.getRegistry().loadLibrary(libraryName, function (error) {
          if (error != null) {
            this.__invokeContinuations(error);

            return;
          }

          this.__loadLibrary();
        }, this);
      },
      __loadNextResource: function __loadNextResource() {
        var resourceSpecification = this.__resourceNames.shift(); // Create the request


        var resourceName = resourceSpecification,
            resourceType = null;
        var atSignPosition = resourceSpecification.indexOf("@");

        if (atSignPosition !== -1 && atSignPosition <= 3) {
          resourceType = resourceSpecification.substring(0, atSignPosition);
          resourceName = resourceSpecification.substring(atSignPosition + 1);
        } else if (qx.lang.String.endsWith(resourceName, ".js")) {
          resourceType = "js";
        } else if (qx.lang.String.endsWith(resourceName, ".css")) {
          resourceType = "css";
        }

        resourceName = resourceName.replace(/\$\{([\w:-]*)\}/g, function (match, optionName) {
          return qookery.Qookery.getOption(optionName);
        });
        var resourceLoader = qookery.Qookery.getService("qookery.IResourceLoader", true);
        var resourceUri = resourceLoader.resolveResourceUri(resourceName);

        switch (resourceType) {
          case "js":
            var scriptRequest = new qx.bom.request.Script();
            scriptRequest.onload = this.__loadLibrary.bind(this);

            scriptRequest.onerror = function () {
              this.__resourceNames.unshift(resourceSpecification);

              this.__invokeContinuations(new Error("Error loading '" + resourceName + "'"));
            }.bind(this);

            scriptRequest.open("GET", resourceUri);
            scriptRequest.send();
            break;

          case "css":
            // Create a new link element and initialize it
            var linkElement = document.createElement("link");
            linkElement.type = "text/css";
            linkElement.rel = "stylesheet";
            linkElement.href = resourceUri; // Retrieve the HEAD element

            var headElement = document.getElementsByTagName("head")[0]; // Begin loading the stylesheet

            qx.util.TimerManager.getInstance().start(function () {
              headElement.appendChild(linkElement);

              this.__loadLibrary();
            }, null, this);
            break;

          default:
            throw new Error("Library uses unsupported resource type");
        }
      },
      __invokeContinuations: function __invokeContinuations(error) {
        this.__continuations.forEach(function (continuation) {
          continuation(error);
        });

        this.__continuations = [];
      }
    }
  });
  qookery.internal.util.Library.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.lang.String": {},
      "qx.dom.Node": {},
      "qx.xml.Element": {},
      "qx.data.Conversion": {}
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
   * Various utility methods helpful when working with XML documents
   */
  qx.Class.define("qookery.util.Xml", {
    statics: {
      /**
       * Return namespace declarations defined onto element, if any
       *
       * @param element {Element} the XML element to search for namespace declarations
       *
       * @return {Map?} prefix-to-URI map, or <code>null</code> if no xmlns attributes found
       */
      getNamespaceDeclarations: function getNamespaceDeclarations(element) {
        var namespaces = null,
            attributes = element.attributes;

        for (var i = 0; i < attributes.length; i++) {
          var attribute = attributes.item(i);
          var attributeName = attribute.nodeName;
          if (attributeName !== "xmlns" && attributeName.indexOf("xmlns:") !== 0) continue;
          var prefix = attributeName.length === 5 ? "" : attributeName.substr(6);
          if (namespaces == null) namespaces = {};
          namespaces[prefix] = attribute.value;
        }

        return namespaces;
      },

      /**
       * Resolve a QName using provided namespace resolver
       *
       * <p>The result format is "{" + Namespace URI + "}" + local part. If the namespace URI is empty,
       * only the local part is returned.</p>
       *
       * @param namespaceResolver {Function} A prefix => namespaceUri function, returning <code>null</code> when prefix is unknown
       * @param qName {String} the QName to resolve
       *
       * @return {String} the string representation of the resolved QName
       *
       * @throws {Error} in case the QName prefix could not be resolved
       */
      resolveQName: function resolveQName(namespaceResolver, qName) {
        if (qName.charAt(0) === "{") return qName;
        if (namespaceResolver == null) throw new Error("Namespace resolver required");
        var colonPos = qName.indexOf(":");
        var prefix = colonPos === -1 ? "" : qName.substr(0, colonPos);
        var namespaceUri = namespaceResolver(prefix);

        if (namespaceUri == null) {
          switch (prefix) {
            case "":
              // The default namespace, if not specified otherwise, is the empty string
              namespaceUri = "";
              break;

            case "xml":
              // Prefix always available, according to XML 1.0 and 1.1 specifications
              namespaceUri = "http://www.w3.org/XML/1998/namespace";
              break;

            default:
              throw new Error(qx.lang.String.format("Unable to resolve namespace prefix '%1'", [prefix]));
          }
        }

        if (namespaceUri === "") return qName;
        var localPart = qName.substring(colonPos + 1);
        return "{" + namespaceUri + "}" + localPart;
      },

      /**
       * Return the text value of an XML node, after trimming leading and trailing whitespace
       *
       * @param node {Node} XML node to get text from
       *
       * @return {String?} whitespace trimmed text or <code>null</code> if empty
       */
      getNodeText: function getNodeText(node) {
        var text = qx.dom.Node.getText(node);
        if (text == null || text.length === 0) return null;
        text = text.trim();
        if (text.length === 0) return null;
        return text;
      },

      /**
       * Return the text value of an element's attribute, after trimming leading and trailing whitespace
       *
       * <p>You may supply the <code>Error</code> build-in object as the defaultValue parameter
       * in order to request that an exception is thrown when value is missing.</p>
       *
       * @param element {Element} XML element holding required attribute
       * @param attributeName {String} name of required attribute, may be fully qualified
       * @param defaultValue {String?} the text to return in case the attribute is empty/missing
       *
       * @return {String} whitespace trimmed attribute value or the default value if empty/missing
       */
      getAttribute: function getAttribute(element, attributeName, defaultValue) {
        var namespaceUri = "",
            localPart = attributeName;

        if (attributeName.charAt(0) === "{") {
          var rightBracePos = attributeName.indexOf("}");
          if (rightBracePos === -1) throw new Error("Ill-formed attribute name");
          namespaceUri = attributeName.substring(1, rightBracePos);
          localPart = attributeName.substring(rightBracePos + 1);
        }

        var text = qx.xml.Element.getAttributeNS(element, namespaceUri, localPart);

        if (text != null) {
          text = text.trim();
          if (text.length !== 0) return text;
        }

        if (defaultValue === Error) throw new Error(qx.lang.String.format("Required attribute '%1' missing from XML element '%2'", [attributeName, element]));
        return defaultValue;
      },

      /**
       * Parse a string of specified value type against provided component
       *
       * @param component {qookery.IComponent} the component that will serve as the context for evaluations
       * @param type {String} one of the known value types
       * @param text {String} the string to parse
       *
       * @return {any} the parsing result
       */
      parseValue: function parseValue(component, type, text) {
        switch (type) {
          case "Boolean":
            switch (text.toLowerCase()) {
              case "true":
                return true;

              case "false":
                return false;
            }

            return text;

          case "Expression":
            return component.evaluateExpression(text);

          case "Integer":
            return parseInt(text, 10);

          case "IntegerList":
            return text.split(/\W+/).map(function (element) {
              return parseInt(element, 10);
            });

          case "Number":
            return qx.data.Conversion.toNumber(text);

          case "NumberList":
            return text.split(/\s+/).map(function (element) {
              return qx.data.Conversion.toNumber(element);
            });

          case "RegularExpression":
            return new RegExp(text);

          case "ReplaceableString":
            if (text.length < 2) return text;
            if (text.charAt(0) !== "%") return text;

            if (text.charAt(1) === "{" && text.charAt(text.length - 1) === "}") {
              var expression = text.substring(2, text.length - 1);
              return component.evaluateExpression(expression);
            }

            var messageId = text.substring(1);
            return component["tr"](messageId);

          case "QName":
            return component.resolveQName(text);

          case "Size":
            var v = qookery.util.Xml.__NAMED_SIZES[text];
            if (v !== undefined) return v;
            v = parseInt(text, 10);
            if (!isNaN(v)) return v;
            return text;

          case "StringList":
            return text.split(/\s+/);

          default:
            // Fallback for unknown types
            return text;
        }
      },

      /**
       * Parse XML element attributes according to component's attribute type mapping
       *
       * <p>Supported types are those of qookery.util.Xml#parseValue()</p>
       *
       * @param component {qookery.IComponent} Qookery component to serve as the base of any conversion
       * @param element {Element} XML element to read attributes from
       * @param typeMap {Map?} custom type mapping; if provided, it overrides the component's type mapping
       *
       * @return {Map} attribute name to converted attribute value map
       */
      parseAllAttributes: function parseAllAttributes(component, element, typeMap) {
        var attributes = {};
        var xmlAttributes = element.attributes;

        for (var i = 0; i < xmlAttributes.length; i++) {
          var xmlAttribute = xmlAttributes.item(i);
          var attributeQName = xmlAttribute.name;
          if (attributeQName === "xmlns" || attributeQName.indexOf("xmlns:") === 0) continue; // Namespace declarations are handled separately

          var text = xmlAttribute.value;
          if (text == null || text.length === 0) continue; // Empty attributes are ignored

          text = text.trim();
          if (text.length === 0) continue; // Empty attribute after trimming whitespace, also ignored

          var attributeName = attributeQName;
          if (attributeQName.indexOf(":") !== -1) attributeName = component.resolveQName(attributeQName);
          var value = text;
          var type = (typeMap != null ? typeMap[attributeName] : undefined) || component.getAttributeType(attributeName);
          if (type != null) value = qookery.util.Xml.parseValue(component, type, text);
          attributes[attributeName] = value;
        }

        return attributes;
      },
      __NAMED_SIZES: {
        "null": null,
        "XXS": 28,
        "XS": 46,
        "S": 74,
        "M": 120,
        "L": 194,
        "XL": 314,
        "XXL": 508
      }
    }
  });
  qookery.util.Xml.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.dev.StackTrace": {},
      "qx.log.Logger": {}
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
   * Useful debug capabilities
   */
  qx.Class.define("qookery.util.Debug", {
    type: "static",
    statics: {
      /**
       * Attempt to log a warning about an error that occurred inside a script
       *
       * <p>Implementation is browser-specific and can be improved to handle more browsers</p>
       *
       * @param object {any} an object that is the context of the log message
       * @param sourceCode {String} the script's source code
       * @param error {Error} exception thrown while running script
       * @return {undefined}
       */
      logScriptError: function logScriptError(object, sourceCode, error) {
        var stackTraceLines = qx.dev.StackTrace.getStackTraceFromError(error);
        if (stackTraceLines == null) return;
        var lineNumber = null,
            match;

        for (var i = 0; i < stackTraceLines.length; i++) {
          var stackTraceLine = stackTraceLines[i];
          match = stackTraceLine.match(/<anonymous>:([\d]+):([\d+])/);
          if (match == null) continue;
          lineNumber = parseInt(match[1]);
          break;
        }

        if (lineNumber == null) return;
        var startIndex = 0;

        for (var i = 3; i < lineNumber; i++) {
          var newLineIndex = sourceCode.indexOf("\n", startIndex);
          if (newLineIndex === -1) break;
          startIndex = newLineIndex + 1;
        }

        qx.log.Logger.warn(object, "Script error at line", match[1], ":", error["message"], "\n\n", sourceCode.substr(startIndex, 250));
      }
    }
  });
  qookery.util.Debug.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      }
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
   * Instances of this class pack helpful information about discovered validation errors
   */
  qx.Class.define("qookery.util.ValidationError", {
    extend: Error,

    /**
     * Construct a new validation error
     *
     * @param source {any} value that represents the source of error
     * @param message {String?} error message
     * @param cause {Array?} array of underlying errors
     */
    construct: function construct(source, message, cause) {
      this.__source = source;
      this.__message = message;
      this.__cause = cause;
      Object.defineProperties(this, {
        "message": {
          enumerable: false,
          get: function get() {
            return this.getFormattedMessage();
          }
        }
      });
    },
    members: {
      __source: null,
      __message: null,
      __cause: null,

      /**
       * Return the source of this error, if available
       *
       * @return {any} value that represents the source of error, may be <code>null</code>
       */
      getSource: function getSource() {
        return this.__source;
      },

      /**
       * Return a message for this error
       *
       * @return {String} error message, may be <code>null</code>
       */
      getMessage: function getMessage() {
        return this.__message;
      },

      /**
       * Return an array of errors that are the underlying cause of this error
       *
       * @return {Array} array of underlying errors or <code>null</code> if not set
       */
      getCause: function getCause() {
        return this.__cause;
      },

      /**
       * Return the computed formatted message which describes this error is more detail
       *
       * @return {String} an error message, <code>null</code> is never returned
       */
      getFormattedMessage: function getFormattedMessage() {
        var message = this.__message || "";

        if (this.__cause != null) {
          if (message) message += ": ";
          message += this.__cause.map(function (cause) {
            return cause.getFormattedMessage();
          }).join("; ");
        }

        if (!message) message = "Nondescript error";
        return message;
      }
    }
  });
  qookery.util.ValidationError.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.ObjectRegistry": {},
      "qx.data.SingleValueBinding": {},
      "qx.lang.String": {}
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
  qx.Class.define("qookery.internal.util.Connection", {
    extend: Object,
    construct: function construct(editableComponent, propertyPath) {
      this.__editableComponent = editableComponent;
      this.__propertyPath = propertyPath;
    },
    members: {
      __editableComponent: null,
      __propertyPath: null,
      __disconnectCallback: null,
      connect: function connect(model) {
        this.disconnect();
        if (qx.core.ObjectRegistry.inShutDown) return;
        var editableComponent = this.__editableComponent;
        if (model == null || editableComponent == null) return;
        var bindingId = model.bind(this.__propertyPath, editableComponent, "value");

        this.__disconnectCallback = function () {
          if (model.isDisposed()) return;
          qx.data.SingleValueBinding.removeBindingFromObject(model, bindingId);
        };
      },
      setModelValue: function setModelValue(model, value) {
        var segments = this.__propertyPath.split(".");

        for (var i = 0; i < segments.length - 1; i++) {
          model = model["get" + qx.lang.String.firstUp(segments[i])]();
          if (model == null) return;
        }

        model["set" + qx.lang.String.firstUp(segments[segments.length - 1])](value);
      },

      /**
       * Return the value of a connection's attribute, if available
       *
       * @param attributeName {String} name of wanted attribute
       *
       * @return {any} attribute value or second argument if <code>undefined</code>
       */
      getAttribute: function getAttribute(attributeName, defaultValue) {
        return defaultValue;
      },
      disconnect: function disconnect() {
        if (this.__disconnectCallback == null) return;

        this.__disconnectCallback();

        this.__disconnectCallback = null;
      },
      equals: function equals(other) {
        return other.__editableComponent === this.__editableComponent && other.__propertyPath == this.__propertyPath;
      },
      __getPropertyChainArray: function __getPropertyChainArray(propertyChain) {
        return propertyChain.replace(/\[/g, ".[").split(".").filter(function (name) {
          return name !== "";
        });
      }
    }
  });
  qookery.internal.util.Connection.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "qx.ui.table.ITableModel": {
        "require": true
      },
      "qx.lang.Array": {},
      "qx.data.Array": {},
      "qx.lang.Type": {},
      "qx.data.SingleValueBinding": {},
      "qx.lang.String": {},
      "qookery.Qookery": {}
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
  qx.Class.define("qookery.impl.DefaultTableModel", {
    extend: qx.core.Object,
    implement: qx.ui.table.ITableModel,
    statics: {
      nullAccessor: {
        getLength: function getLength(data) {
          return 0;
        },
        getRowData: function getRowData(data, index) {
          return null;
        },
        appendRow: function appendRow(data, rowData) {
          return false;
        },
        replaceRow: function replaceRow(data, index, rowData) {
          return false;
        },
        insertRow: function insertRow(data, index, rowData) {
          return false;
        },
        removeRow: function removeRow(data, index) {
          return false;
        }
      },
      jsArrayAccessor: {
        getLength: function getLength(data) {
          return data.length;
        },
        getRowData: function getRowData(data, index) {
          var rowData = data[index];
          if (rowData === undefined) return null;
          return rowData;
        },
        appendRow: function appendRow(data, rowData) {
          data.push(rowData);
          return true;
        },
        replaceRow: function replaceRow(data, index, rowData) {
          data[index] = rowData;
          return true;
        },
        insertRow: function insertRow(data, index, rowData) {
          qx.lang.Array.insertAt(data, rowData, index);
          return false;
        },
        removeRow: function removeRow(data, index) {
          return qx.lang.Array.removeAt(data, index);
        }
      },
      qxDataArrayAccessor: {
        getLength: function getLength(data) {
          return data.getLength();
        },
        getRowData: function getRowData(data, index) {
          var rowData = data.getItem(index);
          if (rowData === undefined) return null;
          return rowData;
        },
        appendRow: function appendRow(data, rowData) {
          data.push(rowData);
          return true;
        },
        replaceRow: function replaceRow(data, index, rowData) {
          data.setItem(index, rowData);
          return true;
        },
        insertRow: function insertRow(data, index, rowData) {
          data.insertAt(index, rowData);
          return false;
        },
        removeRow: function removeRow(data, index) {
          return data.removeAt(index);
        }
      }
    },
    construct: function construct(component, xmlElement) {
      qx.core.Object.constructor.call(this);
      this.__component = component;
      this.__accessor = qookery.impl.DefaultTableModel.nullAccessor;
      this.__sortColumnIndex = -1;
    },
    events: {
      "dataChanged": "qx.event.type.Data",
      "metaDataChanged": "qx.event.type.Event",
      "sorted": "qx.event.type.Data"
    },
    members: {
      // Fields
      __component: null,
      __data: null,
      __accessor: null,
      __sortColumnIndex: null,
      __sortAscending: null,
      // ITableModel implementation
      // .	Component
      getData: function getData() {
        return this.__data;
      },
      setData: function setData(data) {
        if (data instanceof qx.data.Array) this.__accessor = qookery.impl.DefaultTableModel.qxDataArrayAccessor;else if (qx.lang.Type.isArray(data)) this.__accessor = qookery.impl.DefaultTableModel.jsArrayAccessor;else this.__accessor = qookery.impl.DefaultTableModel.nullAccessor;
        this.__data = data;
        var sortColumn = this.getColumn(this.__sortColumnIndex);
        if (sortColumn) this.__sortData(sortColumn, this.__sortAscending);
        this.reloadData();
      },
      reloadData: function reloadData() {
        if (!this.hasListener("dataChanged")) return;
        this.fireDataEvent("dataChanged", {
          firstColumn: 0,
          lastColumn: this.getColumnCount() - 1,
          firstRow: 0,
          lastRow: this.getRowCount() - 1
        });
      },
      // .	Columns
      getColumn: function getColumn(columnIndex) {
        return this.__component.getColumns()[columnIndex];
      },
      getColumns: function getColumns() {
        return this.__component.getColumns();
      },
      getColumnCount: function getColumnCount() {
        return this.getColumns().length;
      },
      getColumnId: function getColumnId(columnIndex) {
        return columnIndex.toString();
      },
      getColumnIndexById: function getColumnIndexById(columnId) {
        return parseInt(columnId, 10);
      },
      getColumnName: function getColumnName(columnIndex) {
        return this.getColumn(columnIndex)["label"] || "";
      },
      isColumnEditable: function isColumnEditable(columnIndex) {
        if (columnIndex == null) return false;
        if (this.__component.getReadOnly()) return false;
        var editable = this.getColumn(columnIndex)["editable"];
        return editable !== undefined ? editable : false;
      },
      isColumnSortable: function isColumnSortable(columnIndex) {
        if (columnIndex == null) return false;
        var sortable = this.getColumn(columnIndex)["sortable"];
        return sortable !== undefined ? sortable : true;
      },
      // .	Rows
      getRowCount: function getRowCount() {
        return this.__accessor.getLength(this.__data);
      },
      getRowData: function getRowData(rowIndex) {
        return this.__accessor.getRowData(this.__data, rowIndex);
      },
      // .	Row editing
      appendRow: function appendRow(rowData) {
        if (!this.__accessor.appendRow(this.__data, rowData)) return;
        this.fireDataEvent("dataChanged", {
          firstColumn: 0,
          lastColumn: this.getColumnCount() - 1,
          firstRow: this.getRowCount() - 2,
          lastRow: this.getRowCount() - 1
        });
      },
      replaceRow: function replaceRow(rowIndex, rowData) {
        if (!this.__accessor.replaceRow(this.__data, rowIndex, rowData)) return;
        this.fireDataEvent("dataChanged", {
          firstColumn: 0,
          lastColumn: this.getColumnCount() - 1,
          firstRow: rowIndex,
          lastRow: rowIndex + 1
        });
      },
      removeRow: function removeRow(rowIndex) {
        var row = this.__accessor.removeRow(this.__data, rowIndex);

        if (row == null) return;
        this.fireDataEvent("dataChanged", {
          firstColumn: 0,
          lastColumn: this.getColumnCount() - 1,
          firstRow: rowIndex,
          lastRow: this.getRowCount() - 1
        });
        return row;
      },
      moveRowUp: function moveRowUp(rowIndex) {
        if (rowIndex <= 0) return false;

        var rowData = this.__accessor.removeRow(this.__data, rowIndex);

        if (!rowData) return false;
        var insertPosition = rowIndex - 1;

        this.__accessor.insertRow(this.__data, insertPosition, rowData);

        this.fireDataEvent("dataChanged", {
          firstColumn: 0,
          lastColumn: this.getColumnCount() - 1,
          firstRow: insertPosition,
          lastRow: insertPosition + 1
        });
        return true;
      },
      moveRowDown: function moveRowDown(rowIndex) {
        var length = this.__accessor.getLength(this.__data);

        if (rowIndex >= length - 1) return false;

        var rowData = this.__accessor.removeRow(this.__data, rowIndex);

        if (!rowData) return false;
        var insertPosition = rowIndex + 1;

        this.__accessor.insertRow(this.__data, insertPosition, rowData);

        this.fireDataEvent("dataChanged", {
          firstColumn: 0,
          lastColumn: this.getColumnCount() - 1,
          firstRow: insertPosition - 1,
          lastRow: insertPosition
        });
        return true;
      },
      // .	Cells
      getValue: function getValue(columnIndex, rowIndex) {
        var row = this.getRowData(rowIndex);
        if (row == null) return null;
        var column = this.getColumn(columnIndex);
        if (column == null) return null;
        return this.__readCellValue(column, row);
      },
      setValue: function setValue(columnIndex, rowIndex, value) {
        var row = this.getRowData(rowIndex);
        if (row == null) return;
        var column = this.getColumn(columnIndex);
        if (column == null) return;

        var modified = this.__writeCellValue(column, row, value);

        if (!modified) return;
        this.fireDataEvent("dataChanged", {
          firstColumn: columnIndex,
          lastColumn: columnIndex,
          firstRow: rowIndex,
          lastRow: rowIndex
        });
      },
      getValueById: function getValueById(columnId, rowIndex) {
        return this.getValue(this.getColumnIndexById(columnId), rowIndex);
      },
      setValueById: function setValueById(columnId, rowIndex, value) {
        this.setValue(this.getColumnIndexById(columnId), rowIndex, value);
      },
      // .	Sorting
      sortByColumn: function sortByColumn(columnIndex, ascending) {
        var column = this.getColumn(columnIndex);
        if (!column) throw new Error("Column to sort does not exist");
        this.__sortColumnIndex = columnIndex;
        this.__sortAscending = ascending;

        this.__sortData(column, ascending);

        this.fireDataEvent("sorted", {
          columnIndex: columnIndex,
          ascending: ascending
        });
        this.fireEvent("metaDataChanged");
      },
      getSortColumnIndex: function getSortColumnIndex() {
        return this.__sortColumnIndex;
      },
      isSortAscending: function isSortAscending() {
        return this.__sortAscending;
      },
      // .	Misc
      prefetchRows: function prefetchRows(firstRowIndex, lastRowIndex) {// Nothing to prefetch
      },
      // Internals
      __sortData: function __sortData(column, ascending) {
        if (!this.__data) return;

        var modelProvider = this.__component.getForm().getModelProvider();

        this.__data.sort(function (row1, row2) {
          var value1 = this.__readCellValue(column, row1);

          var value2 = this.__readCellValue(column, row2);

          var comparison = modelProvider.compare(value1, value2);
          var signum = ascending ? 1 : -1;
          return signum * comparison;
        }.bind(this));
      },
      __hasProperty: function __hasProperty(row, propertyName) {
        if (!row || !row.classname) return false;
        var clazz = qx.Class.getByName(row.classname);
        if (!clazz) return false;
        return !!qx.Class.getByProperty(clazz, propertyName);
      },

      /**
       * Read a cell's value, attempting a number of methods in sequence
       *
       * <ol>
       * <li>In case a dot appears in the connection specification, resolve as a QX property chain</li>
       * <li>In case the row is a qx.lang.Object with a properly named property, get its value</li>
       * <li>In case a getter method is available, invoke it</li>
       * <li>Fallback to direct reading of the JavaScript object key</li>
       * </ol>
       *
       * @return {any} the cell's value or <code>null</code> if not available
       */
      __readCellValue: function __readCellValue(column, row) {
        // The read function, once computed, could be cached in the column definition to improve performance
        var specification = column["connect"];
        if (specification == null) return null;
        var value;

        if (specification.indexOf(".") !== -1) {
          value = qx.data.SingleValueBinding.resolvePropertyChain(row, specification);
        } else if (this.__hasProperty(row, specification)) {
          value = row.get(specification);
        } else if (qx.lang.Type.isFunction(row["get" + qx.lang.String.firstUp(specification)])) {
          value = row["get" + qx.lang.String.firstUp(specification)]();
        } else {
          value = row[specification];
        }

        if (value == null) return null;
        var mapName = column["map"];

        if (mapName) {
          var map = qookery.Qookery.getRegistry().getMap(mapName);
          if (map) return map[value];
        }

        return value;
      },

      /**
       * Write a cell's value, attempting a number of methods in sequence
       *
       * <ol>
       * <li>In case the row is a qx.lang.Object with a properly named property, set its value</li>
       * <li>In case a setter method is available, invoke it</li>
       * <li>Fallback to direct writing of the JavaScript object key</li>
       * </ol>
       *
       * @return {Boolean} <code>true</code> if cell's value was modified
       */
      __writeCellValue: function __writeCellValue(column, row, value) {
        var specification = column["connect"];

        if (specification == null) {
          return false;
        }

        if (specification.indexOf(".") !== -1) {
          this.warn("Writing value of columns with property paths is not supported yet");
          return false;
        }

        if (this.__hasProperty(row, specification)) {
          row.set(specification, value);
        } else if (qx.lang.Type.isFunction(row["set" + qx.lang.String.firstUp(specification)])) {
          row["set" + qx.lang.String.firstUp(specification)](value);
        } else {
          row[specification] = value;
        }

        return true;
      }
    }
  });
  qookery.impl.DefaultTableModel.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Mixin": {
        "usage": "dynamic",
        "require": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);
  qx.Mixin.define("cboulanger.eventrecorder.MState", {
    properties: {
      /**
       * Whether the recorder/player is recording/playing
       */
      running: {
        check: "Boolean",
        nullable: false,
        init: false,
        event: "changeRunning"
      },

      /**
       * Whether the recorder/player is put in paused mode
       */
      paused: {
        check: "Boolean",
        nullable: false,
        init: false,
        event: "changePaused"
      }
    },
    members: {
      /**
       * Starts the recorder/player
       */
      start() {
        if (typeof this.beforeStart == "function") {
          this.beforeStart();
        }

        this.setRunning(true);
        this.setPaused(false);
      },

      /**
       * Pauses the recorder/player
       */
      pause() {
        this.setRunning(false);
        this.setPaused(true);
      },

      /**
       * Resumes recording/playing.
       */
      resume() {
        if (!this.getPaused()) {
          throw new Error("Cannot resume if not paused");
        }

        this.setRunning(true);
        this.setPaused(false);
      },

      /**
       * Stops the recording.
       */
      stop() {
        this.setRunning(false);
        this.setPaused(false);

        if (typeof this.afterStop == "function") {
          this.afterStop();
        }
      }

    }
  });
  cboulanger.eventrecorder.MState.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.bom.Element": {
        "require": true
      },
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "cboulanger.eventrecorder.MState": {
        "require": true
      },
      "cboulanger.eventrecorder.MHelperMethods": {
        "require": true
      },
      "qx.lang.Type": {},
      "qx.core.Id": {},
      "qx.core.Init": {},
      "qx.event.type.Data": {},
      "qx.data.marshal.Json": {},
      "qxl.dialog.Dialog": {},
      "qx.event.Timer": {},
      "qx.core.Assert": {},
      "qx.bom.storage.Web": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2018 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  ************************************************************************ */

  /**
   * The base class of all player types
   * @require(qx.bom.Element)
   */
  qx.Class.define("cboulanger.eventrecorder.player.Abstract", {
    extend: qx.core.Object,
    include: [cboulanger.eventrecorder.MState, cboulanger.eventrecorder.MHelperMethods],
    statics: {
      utilityFunctions: {
        /**
         * Runs the given function in the interval until it returns true or the
         * given timeout is reached. Returns a promise that will resolve once the
         * function returns true or rejects if the timeout is reached.
         * @param fn {Function} Condition function
         * @param interval {Number} The interval in which to run the function. Defaults to 100 ms.
         * @param timeout {Number} The timeout in milliseconds. Defaults to 10 seconds
         * @param timeoutMsg {String|undefined} An optional addition to the timeout error message
         * @return {Promise}
         */
        waitForCondition: function waitForCondition(fn, interval = 100, timeout = 10000, timeoutMsg) {
          return new Promise((resolve, reject) => {
            let intervalId = setInterval(() => {
              if (fn()) {
                clearInterval(intervalId);
                resolve();
              }
            }, interval);
            setTimeout(() => {
              clearInterval(intervalId);
              reject(new Error(timeoutMsg || "Timeout waiting for condition."));
            }, timeout);
          });
        },

        /**
         * Returns a promise that will resolve (with any potential event data) if
         * the given object fires an event with the given type and will reject if
         * the timeout is reached before that happens.
         *
         * @param qxObjOrId {qx.core.Object|String} If string, assume it is the object id
         * @param type {String} Type of the event
         * @param expectedData {*|undefined} The data to expect. If undefined,
         * resolve. If a regular expression, the event data as a JSON literal will
         * be matched with that regex and the promise will resolve when it matches.
         * Otherwise, the data will be compared with the actual event data both
         * serialized to JSON.
         * @param timeout {Number|undefined} The timeout in milliseconds. Defaults to 10 seconds
         * @param timeoutMsg {String|undefined} An optional addition to the timeout error message
         * @return {Promise}
         */
        waitForEvent: function waitForEvent(qxObjOrId, type, expectedData, timeout, timeoutMsg) {
          let qxObj = qxObjOrId;

          if (qx.lang.Type.isString(qxObjOrId)) {
            qxObj = qx.core.Id.getQxObject(qxObjOrId);

            if (!qxObj) {
              throw new Error("Invalid object id ".concat(qxObjOrId));
            }
          }

          timeout = timeout || this.getTimeout();
          return new Promise((resolve, reject) => {
            // create a timeout
            let timeoutId = setTimeout(() => {
              qxObj.removeListener(type, changeEventHandler);
              reject(new Error(timeoutMsg || "Timeout waiting for event \"".concat(type, ".")));
            }, timeout); // function to create a listener for the change event

            let changeEventHandler = e => {
              let app = qx.core.Init.getApplication();
              let eventdata = e instanceof qx.event.type.Data ? e.getData() : undefined;

              if (expectedData !== undefined) {
                if (eventdata === undefined) {
                  app.warn("\n--- When waiting for event '".concat(type, "' on object ").concat(qxObj, ", received 'undefined'"));
                  qxObj.addListenerOnce(type, changeEventHandler);
                  return;
                }

                if (qx.lang.Type.isArray(expectedData) && qx.lang.Type.isArray(eventdata) && expectedData.length && expectedData[0] instanceof qx.core.Object) {
                  /** a) either match array and check for "live" qooxdoo objects in the array (this is for selections), */
                  for (let [index, expectedItem] of expectedData.entries()) {
                    if (expectedItem !== eventdata[index]) {
                      app.warn("\n--- When waiting for event '".concat(type, "' on object ").concat(qxObj, ", received non-matching array of qooxdoo objects!"));
                      qxObj.addListenerOnce(type, changeEventHandler);
                      return;
                    }
                  }
                } else {
                  // convert event data to JSON
                  try {
                    eventdata = JSON.stringify(e.getData());
                  } catch (e) {
                    throw new Error("\n--- When waiting for event '".concat(type, "' on object ").concat(qxObj, ", could not stringify event data for comparison."));
                  }

                  if (qx.lang.Type.isRegExp(expectedData)) {
                    /** b) or match a regular expression, */
                    if (!eventdata.match(expectedData)) {
                      app.warn("\n--- When waiting for event '".concat(type, "' on object ").concat(qxObj, ", expected data to match '").concat(expectedData.toString(), "', got ").concat(eventdata, "!"));
                      qxObj.addListenerOnce(type, changeEventHandler);
                      return;
                    }
                  } else {
                    /* c) or compare JSON equality */
                    try {
                      expectedData = JSON.stringify(expectedData);
                    } catch (e) {
                      throw new Error("When waiting for event '".concat(type, "' on object ").concat(qxObj, ", could not stringify expected data for comparison."));
                    }

                    if (eventdata !== expectedData) {
                      app.warn("\n--- When waiting for event '".concat(type, "' on object ").concat(qxObj, ", expected '").concat(JSON.stringify(expectedData), "', got '").concat(JSON.stringify(eventdata), "'!\""));
                      qxObj.addListenerOnce(type, changeEventHandler);
                      return;
                    }
                  }
                }
              }

              app.info("\n+++ Received correct event '".concat(type, "' on object ").concat(qxObj, ".\""));
              clearTimeout(timeoutId);
              resolve(eventdata);
            }; // add a listener


            qxObj.addListenerOnce(type, changeEventHandler);
          });
        }
      }
    },
    properties: {
      /**
       * The replay mode. Possible values:
       * "test": The script is executed ignoring the "delay" commands, errors will
       * stop execution and will be thrown.
       * "presentation": The script is executed with user delays, errors will be
       * logged to the console but will not stop execution
       */
      mode: {
        check: ["test", "presentation"],
        event: "changeMode",
        init: "presentation",
        apply: "_applyMode"
      },

      /**
       * The timeout in milliseconds
       */
      timeout: {
        check: "Number",
        init: 10000
      },

      /**
       * The interval between checks if waiting for a condition to fulfil
       */
      interval: {
        check: "Number",
        init: 100
      },

      /**
       * if true, ignore user delays and use defaultDelay
       */
      useDefaultDelay: {
        check: "Boolean",
        nullable: false,
        init: false
      },

      /**
       * The maximun delay between events (limits user-generated delay)
       */
      maxDelay: {
        check: "Number",
        init: 1000
      },

      /**
       * Whether the player can replay the generated script in the browser
       */
      canReplayInBrowser: {
        check: "Boolean",
        nullable: false,
        init: false,
        event: "changeCanReplay"
      },

      /**
       * Whether the player can export code that can be used outside this application
       */
      canExportExecutableCode: {
        check: "Boolean",
        nullable: false,
        init: false,
        event: "changeCanExportExecutableCode"
      },

      /**
       * Macro data
       */
      macros: {
        check: "qx.core.Object",
        init: null,
        event: "changeMacros"
      }
    },
    events: {
      /**
       * Fired with each step of the replayed script. The event data is an array
       * containing the number of the step and the number of steps
       */
      "progress": "qx.event.type.Data"
    },

    /**
     * constructor
     */
    construct: function construct() {
      qx.core.Object.constructor.call(this);
      this.__commands = [];
      this._globalRef = "eventrecorder_player";
      window[this._globalRef] = this;
      this.resetMacros(); // inject utility functions in the statics section into the global scope
      // so that they are available in eval()

      for (let [name, fn] of Object.entries(cboulanger.eventrecorder.player.Abstract.utilityFunctions)) {
        window[name] = fn;
      }
    },

    /**
     * The methods and simple properties of this class
     */
    members: {
      /**
       * A globally accessible reference to the player implementation
       */
      _globalRef: null,

      /**
       * A list of available commands
       */
      __commands: null,

      /**
       * An array of object containing information on the macros that are currently
       * being defined (in a nested way)
       * @var {Object[]}
       */
      __macro_stack: null,

      /**
       * The index of the macro in the macro stack that is currently defined
       * @var {Integer}
       */
      __macro_stack_index: -1,

      /**
       * Contains the name of the macro that is currently being replayed, if any.
       */
      __macro_playing: null,

      /**
       * Whether the currently replayed code is an import
       */
      __import_playing: false,

      /**
       * Variables
       */
      __vars: null,

      /**
       * An array of promises which are to be awaited
       */
      __promises: null,

      /**
       * Last id addressed
       */
      __lastId: null,

      /**
       * Last command used
       */
      __lastCmd: null,

      /**
       * Returns the player type
       * @return {String}
       */
      getType() {
        throw new Error("Abstract method which needs to be implemented");
      },

      /**
       * Return the last id used
       * @return {String|null}
       */
      getLastId() {
        return this.__lastId;
      },

      /**
       * Return the last command used
       * @return {String|null}
       */
      getLastCommand() {
        return this.__lastCmd;
      },

      /**
       * Stub to be overridden if needed
       * @param value
       * @param old
       * @private
       */
      _applyMode(value, old) {},

      /**
       * NOT IMPLEMENTED
       * Adds the given array of commands
       * @param commands {Object[]}
       */
      _addCommands(commands) {
        this.__commands = this.__commands.concat(commands).sort((a, b) => a.name > b.name);
      },

      /**
       * NOT IMPLEMENTED
       * Returns the list of availabe commands
       * @return {Object[]}
       */
      getCommands() {
        return this.__commands;
      },

      /**
       * Clears all macro definitions and the macro stack
       */
      resetMacros() {
        if (this.getMacros()) {
          this.getMacros().dispose();
        }

        this.__macro_stack = [];
        this.__macro_stack_index = -1;
        let macros = qx.data.marshal.Json.createModel({
          names: [],
          definitions: [],
          descriptions: []
        }, true);
        this.setMacros(macros);
      },

      /**
       * Returns true if a macro of that name exists.
       * @param name {String}
       * @return {boolean}
       */
      macroExists(name) {
        return this.getMacros().getNames().indexOf(name) >= 0;
      },

      /**
       * Returns the names of the currently defined macros as a qx.data.Array
       * @return {qx.data.Array}
       */
      getMacroNames() {
        return this.getMacros().getNames();
      },

      /**
       * Returns an array with the lines of the macro of that name
       * @param name {String}
       * @return {Array}
       */
      getMacroDefinition(name) {
        let index = this.getMacros().getNames().indexOf(name);

        if (index < 0) {
          throw new Error("Macro '".concat(name, "' does not exist"));
        }

        return this.getMacros().getDefinitions().getItem(index);
      },

      /**
       * Returns the description of the macro
       * @param name {String}
       * @return {String}
       */
      getMacroDescription(name) {
        let index = this.getMacros().getNames().indexOf(name);

        if (index < 0) {
          throw new Error("Macro '".concat(name, "' does not exist"));
        }

        return this.getMacros().getDescriptions().getItem(index);
      },

      /**
       * Adds an empty macro of this name
       * @param name {String}
       * @param description {String|undefined}
       */
      addMacro(name, description) {
        if (this.macroExists(name)) {
          throw new Error("A macro of the name '".concat(name, "' alread exists."));
        }

        let macros = this.getMacros();
        macros.getDefinitions().push([]);
        macros.getDescriptions().push(description || "");
        macros.getNames().push(name);
      },

      /**
       * Begins the definition of a macro of that name.
       * @param name {String}
       */
      beginMacroDefintion(name) {
        let index = ++this.__macro_stack_index;
        this.__macro_stack[index] = {
          name
        };
      },

      /**
       * Returns true if the player is currently in a macro definition
       * @return {boolean}
       */
      isInMacroDefinition() {
        return this.__macro_stack_index >= 0;
      },

      /**
       * Return the name of the macro that is currently being defined
       * @return {String}
       */
      getCurrentMacroName() {
        if (!this.isInMacroDefinition()) {
          throw new Error("No macro is currently defined");
        }

        let {
          name
        } = this.__macro_stack[this.__macro_stack_index];
        return name;
      },

      /**
       * Leave the current macro, i.e. return to the including script/macro
       */
      leaveMacroDefinition() {
        this.getCurrentMacroName(); // this will throw if none is being defined

        this.__macro_stack_index--;
      },

      /**
       * Translates a single line from the intermediate code into the target
       * language. To be overridden by subclasses if neccessary. Returns a
       * single line in most cases, an array of lines in case of imports.
       *
       * @param line {String}
       * @return {String|String[]}
       * @ignore(command)
       * @ignore(args)
       */
      async _translateLine(line) {
        line = line.trim();

        if (!line) {
          return null;
        } // comment


        if (line.startsWith("#")) {
          return this.addComment(line.substr(1).trim());
        } // parse command line


        let [command, ...args] = this.tokenize(line);
        command = String(command).toLocaleLowerCase();
        this.__lastCmd = command;
        this.__lastId = args[0]; // assume first argument is id
        // run command generation implementation

        let method_name = "cmd_" + command.replace(/-/g, "_");

        if (typeof this[method_name] == "function") {
          let translatedLine = this[method_name].apply(this, args); // async translator function

          if (translatedLine && typeof translatedLine.then == "function") {
            translatedLine = await translatedLine;
          } // imports


          if (Array.isArray(translatedLine)) {
            return translatedLine;
          }

          if (translatedLine && translatedLine.startsWith("(") && this.isInAwaitBlock()) {
            this._addPromiseToAwaitStack(translatedLine);

            return null;
          }

          return translatedLine;
        }

        throw new Error("Unsupported/unrecognized command: '".concat(command, "'"));
      },

      /**
       * Given a script, return an array of lines with all variable and macro
       * declarations registered and removed. Optionally, variables are expanded.
       *
       * @param script {String}
       * @param expandVariables {Boolean} Whether to expand the found variables. Default to true
       * @return {Array}
       * @private
       */
      async _handleMeta(script, expandVariables = true) {
        this.resetMacros();
        this.__vars = {};
        let lines = [];

        for (let line of script.split(/\n/)) {
          line = line.trim();

          if (!line) {
            continue;
          } // expand variables


          let var_def = line.match(/([^=\s]+)\s*=\s*(.+)/);

          if (var_def) {
            this.__vars[var_def[1]] = var_def[2];
            continue;
          } else if (expandVariables && line.match(/\$([^\s\d\/]+)/)) {
            line = line.replace(/\$([^\s\d\/]+)/g, (...args) => this.__vars[args[1]]);
          } // register macros


          if (line.startsWith("define ")) {
            if (this.isInAwaitBlock()) {
              throw new Error("You cannot use a macro in an await block.");
            }

            await this._translateLine(line);
            continue;
          } // await block


          if (line.startsWith("await-")) {
            await this._translateLine(line);
          } // end await block or macro


          if (line === "end") {
            // macro
            if (!this.isInAwaitBlock()) {
              await this._translateLine(line);
              continue;
            } // await block


            await this._translateLine(line);
          } // add code to macro


          if (this.isInMacroDefinition()) {
            let name = this.getCurrentMacroName();
            this.getMacroDefinition(name).push(line);
            continue;
          }

          lines.push(line);
        } // remove variable registration if they have been expanded


        if (expandVariables) {
          this.__vars = {};
        }

        return lines;
      },

      /**
       * Returns the lines for the macro of the given name, with the given arguments
       * replaced (1st arg -> $1, 2nd arg -> $2, etc.). If it doesn't exist,
       * return undefined.
       * @param macro_name {String} The name of the macro
       * @param args {Array} An array of arguments to be replaced in the macro code
       * @return {Array|undefined}
       * @private
       */
      _getMacro(macro_name, args) {
        if (!this.macroExists(macro_name)) {
          return undefined;
        }

        let macro_lines = this.getMacroDefinition(macro_name); // argument placeholders

        for (let i = 0; i < args.length; i++) {
          macro_lines = macro_lines.map(l => l.replace(new RegExp("\\$" + (i + 1), "g"), JSON.stringify(args[i])));
        }

        return macro_lines;
      },

      /**
       * Returns an array of lines containing variable declarations
       * @return {string[]}
       * @private
       */
      _defineVariables() {
        return Object.getOwnPropertyNames(this.__vars).map(key => "const ".concat(key, " =\"").concat(this.__vars[key], "\";"));
      },

      /**
       * Translates variables in a line
       * @param line {String}
       * @private
       * @return {String}
       * @ignore(args)
       */
      _translateVariables(line) {
        if (line.match(/\$([^\s\d\/]+)/)) {
          line = line.replace(/\$([^\s\d\/]+)/g, (...args) => {
            let var_name = args[1];
            let var_content = this.__vars[var_name];

            if (var_content === undefined) {
              throw new Error("Variable '".concat(var_name, "' has not been defined."));
            }

            return var_content;
          });
        }

        return line;
      },

      /**
       * Returns the code of utility functions needed for the command implementations.
       * @param script {String} Optional script code to be searched for the function name.
       * If given, omit function if not present in the script code
       * @return {string[]}
       * @private
       * @ignore(fn)
       */
      _generateUtilityFunctionsCode(script) {
        return Object.entries(cboulanger.eventrecorder.player.Abstract.utilityFunctions).filter(([name]) => script ? script.match(new RegExp(name)) : true).map(([name, fn]) => fn.toString().replace(/function \(/, "function ".concat(name, "(")) // remove comments, see https://stackoverflow.com/questions/5989315/regex-for-match-replacing-javascript-comments-both-multiline-and-inline
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1").split(/\n/).map(line => line.trim()).filter(line => Boolean(line)).join(""));
      },

      /**
       * Replays a number of script lines
       * @param lines {String[]}
       * @param steps {Integer?}
       * @param step {Integer?}
       * @return {Promise<boolean>}
       * @private
       */
      async _play(lines, steps = 0, step = 0) {
        for (let index = 0; index < lines.length; index++) {
          let line = lines[index]; // stop if we're not running (user pressed "stop" button

          if (!this.getRunning()) {
            return false;
          } // ignore comments


          if (line.startsWith("#")) {
            continue;
          } // variables


          line = this._translateVariables(line); // play macros recursively

          let [command, ...args] = this.tokenize(line);

          let macro_lines = this._getMacro(command, args);

          if (macro_lines !== undefined) {
            this.__macro_playing = command;

            if (steps) {
              step++;
              this.debug("\n===== Step ".concat(step, " / ").concat(steps, ", executing macro ").concat(command, " ====="));
            }

            await this._play(macro_lines);
            this.__macro_playing = null;
            continue;
          } // count steps if given, wait doesn't count as a step


          if (steps && !line.startsWith("wait") && !line.startsWith("delay")) {
            step++; // inform listeners

            this.fireDataEvent("progress", [step, steps]);
            this.debug("\n===== Step ".concat(step, " / ").concat(steps, " ===="));
          } // ignore delay in test mode


          if (this.getMode() === "test" && line.startsWith("delay")) {
            continue;
          }

          let result, code;

          try {
            // translate
            code = await this._translateLine(line); // skip empty lines

            if (!code) {
              continue;
            } // handle multiple lines from imports


            if (Array.isArray(code)) {
              this.__import_playing = true;
              this.debug(">>>>>>>>> Start import >>>>>>>>>>>>>");
              await this._play(code, code.length, 0);
              this.__import_playing = false;
              this.debug("<<<<<<<<< End import ><<<<<<<<<<<<<<");
              continue;
            }

            this.debug("".concat(line, "\n").concat("-".repeat(40), "\n").concat(code)); // execute

            result = window.eval(code);
          } catch (e) {
            if (!e.code) {
              if (this.__macro_playing) {
                e.macro = this.__macro_playing;
              }

              if (this.__import_playing) {
                e.import = true;
              }

              e.code = code;
              e.scriptcode = line;
              e.scriptline = index + 1;
            }

            throw e;
          }

          if (result instanceof Promise) {
            try {
              await result;
            } catch (e) {
              e.code = code;
              e.scriptcode = line;
              e.scriptline = index + 1;
              throw e;
            }
          }
        }

        return true;
      },

      /**
       * Replays the given script of intermediate code
       * @param scriptOrLines {String|Array}
       *    The script to replay. If String, assume an unhandled script. If Array,
       *    assume that script has already been handled by {@link #_handleMeta) and
       *    split into lines.
       * @return {Promise} Promise which resolves when the script has been replayed, or
       * rejects with an error
       * @todo implement pausing
       */
      async replay(scriptOrLines) {
        this.setRunning(true);
        let lines = Array.isArray(scriptOrLines) ? scriptOrLines : await this._handleMeta(scriptOrLines);
        let steps = 0;
        let await_block = false;

        for (let line of lines) {
          if (line.startsWith("await-")) {
            await_block = true;
            continue;
          }

          if (line.startsWith("end")) {
            await_block = false;
            continue;
          }

          if (!await_block && !line.startsWith("wait ") && !line.startsWith("#") && !line.startsWith("delay")) {
            steps++;
          }
        } // replay it!


        try {
          await this._play(lines, steps, 0);
        } catch (e) {
          let msg; // to do: handle errors in macros and imports

          msg = "Error executing script, line ".concat(e.scriptline, ": ").concat(e.message, ".\nCheck console for more information.");
          this.error("Error executing script, line ".concat(e.scriptline, ", code:\n").concat(e.scriptcode, "\nGenerated code:\n").concat(e.code));

          switch (this.getMode()) {
            case "test":
              throw e;

            case "presentation":
              this.error(e);
              qxl.dialog.Dialog.error(msg);
          }
        }

        this.setRunning(false);
        qx.event.Timer.once(() => this.cmd_hide_info(), null, 100);
      },

      /**
       * Translates the intermediate code into the target language
       * @param scriptOrLines {String|Array}
       *    The script to translate.
       *    If String, assume an unhandled script. If Array. assume that script
       *    has already been handled by {@link #_handleMeta) and split into lines
       * @return {string} executable code
       */
      async translate(scriptOrLines) {
        return this._translate(scriptOrLines);
      },

      /**
       * Implementation for #translate(). Returns the translated lines.
       * @param scriptOrLines {String|Array}
       *    If String, assume an unhandled script. If Array. assume that script
       *    has already been handled by {@link #_handleMeta) and split into lines
       * @param includeUtilityFunctions {Boolean}
       * @return {string}
       * @private
       */
      async _translate(scriptOrLines, includeUtilityFunctions = true) {
        let lines = Array.isArray(scriptOrLines) ? scriptOrLines : await this._handleMeta(scriptOrLines);

        let translatedLines = this._defineVariables();

        for (let line of lines) {
          line = line.trim();

          if (!line) {
            continue;
          }

          let [command, ...args] = this.tokenize(line);

          let macro_lines = this._getMacro(command, args);

          let new_lines = [];

          for (let l of macro_lines || [line]) {
            let code = await this._translateLine(l);

            if (Array.isArray(code)) {
              new_lines = new_lines.concat(code);
            } else {
              new_lines.push(code);
            }
          }

          translatedLines = translatedLines.concat(new_lines.filter(l => Boolean(l)));
        }

        let translation = translatedLines.join("\n");

        if (includeUtilityFunctions) {
          return this._generateUtilityFunctionsCode(translation).concat(translatedLines).join("\n");
        }

        return translation;
      },

      /**
       * Given an async piece of code which checks for a condition or an application state,
       * return code that checks for this condition, throwing an error if the
       * condition hasn't been fulfilled within the set timeout.
       * @param condition {String} The condition expression as a string
       * @param timeoutmsg {String|undefined} An optional message to be shown if the condition hasn't been met before the timeout.
       */
      generateWaitForConditionCode(condition, timeoutmsg) {
        qx.core.Assert.assertString(condition);
        timeoutmsg = timeoutmsg || "Timeout waiting for condition '".concat(condition, "' to fulfil.\"");
        return "(waitForCondition(() => ".concat(condition, ", ").concat(this.getInterval(), ", ").concat(this.getTimeout(), ", \"").concat(timeoutmsg, "\"))");
      },

      /**
       * Generates code that returns a promise which will resolve (with any potential event data) if the given object fires
       * an event with the given type and data (if applicable) and will reject if the timeout is reached before that happens.
       * @param id {String} The id of the object to monitor
       * @param type {String} The type of the event to wait for
       * @param data {*|undefined} The data to expect. Must be serializable to JSON. Exception: if the data is a string that
       * starts with "{verbatim}", the unquoted string is used
       * @param timeoutmsg {String|undefined} An optional message to be shown if the event hasn't been fired before the timeout.
       * @return {String}
       */
      generateWaitForEventCode(id, type, data, timeoutmsg) {
        qx.core.Assert.assertString(id);
        qx.core.Assert.assertString(type);

        if (qx.lang.Type.isString(data) && data.startsWith("{verbatim}")) {
          data = data.substr(10);
        } else {
          data = JSON.stringify(data);
        }

        if (!timeoutmsg) {
          timeoutmsg = "Timeout waiting for event '".concat(type, "' on '").concat(id, "'");
        }

        return "(waitForEvent(\"".concat(id, "\", \"").concat(type, "\",").concat(data, ", ").concat(this.getTimeout(), ", \"").concat(timeoutmsg, "\"))");
      },

      /**
       * Generates code that returns a promise which will resolve (with any
       * potential event data) if the given object fires an event with the given
       * type and data (if applicable). After the timeout, it will execute the
       * given code and restart the timeout.
       *
       * @param id {String} The id of the object to monitor
       * @param type {String} The type of the event to wait for
       * @param data {*|null} The data to expect. Must be serializable to JSON. In case
       * of events that do not have data, you MUST explicitly pass 'undefined' as
       * argument if you use the following arguments
       * @param code {String} The code to execute after the timeout
       * @return {String}
       */
      generateWaitForEventTimoutFunction(id, type, data, code) {
        qx.core.Assert.assertString(id);
        qx.core.Assert.assertString(type);
        return "(new Promise(async (resolve, reject) => { \n        while (true){\n          try {\n            await waitForEvent(qx.core.Id.getQxObject(\"".concat(id, "\"), \"").concat(type, "\", ").concat(data === undefined ? "undefined" : JSON.stringify(data), ", ").concat(this.getTimeout(), ");\n            return resolve(); \n          } catch (e) {\n            console.debug(e.message);\n            ").concat(code, ";\n          }\n        }\n      }))").split(/\n/).map(l => l.trim()).join("");
      },

      /**
       * Adds a line comment to the target script
       * @param comment {String}
       * @return {string}
       */
      addComment(comment) {
        return "// " + comment;
      },

      /**
       * Escapes all characters in a string that are special characters in a regular expression
       * @param s {String} The string to escape
       * @return {String}
       */
      escapeRegexpChars(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      },

      /**
       * Creates a regular expression that matches a json string. In this string, you can use a regular expression
       * enclosed by "<!" and "!>" to replace data that cannot be known in advance, such as tokens or session ids.
       * Example: '{token:"<![A-Za-z0-9]{32}!>",user:"admin">' will match '{"token":"OnBHqQd59VHZYcphVADPhX74q0Sc6ERR","user":"admin"}'
       * @param s {string}
       */
      createRegexpForJsonComparison(s) {
        let searchExp = /<![^<][^!]+!>/g;
        let foundRegExps = s.match(searchExp);

        if (foundRegExps && foundRegExps.length) {
          let index = 0; // remove escape sequence

          foundRegExps = foundRegExps.map(m => m.slice(2, -2)); // replace placeholders

          return this.escapeRegexpChars(s).replace(searchExp, () => foundRegExps[index++]);
        }

        return this.escapeRegexpChars(s);
      },

      /**
       * Adds promise code to a list of promises that need to resolve before the
       * script proceeds
       * @param promiseCode
       */
      _addPromiseToAwaitStack(promiseCode) {
        if (!qx.lang.Type.isArray(this.__promises)) {
          throw new Error("Cannot add promise since no await block has been opened.");
        }

        this.__promises.push(promiseCode);
      },

      /**
       * Returns the file extension of the downloaded file in the target language
       * @return {string}
       */
      getExportFileExtension() {
        throw new Error("Method getExportFileExtension must be impemented in subclass");
      },

      /**
       * Whether the player is in an await block
       * @return {Boolean}
       */
      isInAwaitBlock() {
        return qx.lang.Type.isArray(this.__promises);
      },

      /**
       * Returns the storage object
       * @return {qx.bom.storage.Web}
       * @private
       */
      _getStorage() {
        return qx.bom.storage.Web.getSession();
      },

      /**
       * Saves an imported script
       * @param uri {String}
       * @param script {String}
       */
      _saveImport(uri, script) {
        this._getStorage().setItem("import:" + uri, script);
      },

      /**
       * Retrieves an imported script by its uri, if it exists
       * @param uri {String}
       * @return {String}
       */
      _getImport(uri) {
        return this._getStorage().getItem("import:" + uri);
      },

      /**
       * Removes all imported scripts
       */
      _clearImports() {
        this._getStorage().forEach(key => {
          if (key.startsWith("import:")) {
            this._getStorage().removeItem(key);
          }
        });
      },

      /*
      ============================================================================
         COMMANDS
      ============================================================================
      */

      /**
       * Imports a remote file and caches it locally
       * @param uri {String}
       * @return {Promise<array>}
       */
      async cmd_import(uri) {
        const [type, id] = uri.split(":");

        if (type !== "gist") {
          throw new Error("Currently, only gists can be imported.");
        } // use stored script or load from URI


        let remoteScript = this._getImport(uri);

        if (!remoteScript) {
          remoteScript = await this.getRawGist(id);

          this._saveImport(uri, remoteScript);
        }

        return this._translate(remoteScript, false);
      },

      /**
       * Clears locally cached imported scripts in order to force-reload them
       */
      cmd_clear_imports() {
        this._clearImports();

        return "";
      },

      /**
       * Asserts that the current url matches the given value (RegExp)
       * @param uri {String}
       */
      cmd_assert_uri(uri) {
        return "qx.core.Assert.assertEquals(window.location.href, \"".concat(uri, "\", \"Script is valid on '").concat(uri, "' only'\")");
      },

      /**
       * Asserts that the current url matches the given value (RegExp)
       * @param uri_regexp {String} A string containing a regular expression
       */
      cmd_assert_match_uri(uri_regexp) {
        if (this.getMode() === "presentation") {
          return "if(!window.location.href.match(new RegExp(\"".concat(uri_regexp, "\"))){alert(\"The eventrecorder script is meant to be played on a website that matches '").concat(uri_regexp, "'.\");window[\"").concat(this._globalRef, "\"].stop();}");
        }

        return "qx.core.Assert.assertMatch(window.location.href, \"".concat(uri_regexp, "\", \"Current URL does not match '").concat(uri_regexp, "'\")");
      },

      /**
       * Sets the player mode
       * @param mode
       * @return {string}
       */
      cmd_config_set_mode(mode) {
        return "window[\"".concat(this._globalRef, "\"].setMode(\"").concat(mode, "\");");
      },

      /**
       * Starts the definition of a macro
       * @param macro_name {String}
       * @param macro_description {String|undefined}
       * @return {null}
       */
      cmd_define(macro_name, macro_description) {
        if (this.macroExists(macro_name)) {
          throw new Error("Cannot define macro '".concat(macro_name, "' since a macro of that name already exists."));
        }

        this.addMacro(macro_name, macro_description);
        this.beginMacroDefintion(macro_name);
        return null;
      },

      /**
       * Ends the definition of a macro or a block of awaitable statements
       * @return {null}
       */
      cmd_end() {
        if (this.__promises) {
          let line = this.__promises.length ? "(Promise.all([".concat(this.__promises.join(","), "]))") : null;
          this.__promises = null;
          return line;
        }

        if (this.__macro_stack_index < 0) {
          throw new Error("Unexpected 'end'.");
        }

        this.leaveMacroDefinition();
        return null;
      },

      /**
       * Starts a block of statements that return promises. The player will wait for
       * all of the promises to resolve before proceeding.
       */
      cmd_await_all() {
        this.__promises = [];
        return null;
      },

      /**
       * Throws an error
       * @param msg {String} The error message
       */
      cmd_error(msg) {
        return "throw new Error(\"".concat(msg, "\")");
      }

    }
  });
  cboulanger.eventrecorder.player.Abstract.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Interface": {
        "usage": "dynamic",
        "require": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2019 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors:
      Christian Boulanger (cboulanger) info@bibliograph.org
  
  ************************************************************************ */

  /**
   * This interface defines the events and methods a player must implement
   */
  qx.Interface.define("cboulanger.eventrecorder.IPlayer", {
    /**
     * Events that must be declared by this interface
     */
    events: {
      /**
       * Fired with each step of the replayed script. The event data is an array
       * containing the number of the step and the number of steps
       */
      "progress": "qx.event.type.Data"
    },

    /**
     * Methonds that must be declared by this interface
     */
    members: {
      /**
       * Returns the player type
       * @return {String}
       */
      getType() {},

      /**
       * Starts the player
       */
      start() {},

      /**
       * Stops the recording.
       */
      stop() {},

      /**
       * Replays the given script of intermediate code
       * @param script {String} The script to replay
       * @return {Promise} Promise which resolves when the script has been replayed, or
       * rejecdts with an error
       */
      async replay(script) {},

      /**
       * Translates the intermediate code into the target language
       * @param script
       * @return {string} Javasc
       */
      async translate(script) {},

      /**
       * Returns the file extension of the downloaded file in the target language
       * @return {string}
       */
      getExportFileExtension() {},

      /*
      ============================================================================
         COMMANDS
      ============================================================================
      */

      /**
       * Imports a remote file and caches it locally
       * @param uri {String}
       * @return {Promise<array>}
       */
      async cmd_import(uri) {},

      /**
       * Clears locally cached imported scripts in order to force-reload them
       */
      cmd_clear_imports() {},

      /**
       * Asserts that the current url matches the given value (RegExp)
       * @param uri {String}
       */
      cmd_assert_uri(uri) {},

      /**
       * Asserts that the current url matches the given value (RegExp)
       * @param uri_regexp {String} A string containing a regular expression
       */
      cmd_assert_match_uri(uri_regexp) {},

      /**
       * Sets the player mode
       * @param mode
       * @return {string}
       */
      cmd_config_set_mode(mode) {},

      /**
       * Starts a block of statements that return promises. The player will wait for
       * all of the promises to resolve before proceeding.
       */
      cmd_await_all() {},

      /**
       * Starts the definition of a macro
       * @param macro_name
       * @return {null}
       */
      cmd_define(macro_name) {},

      /**
       * Ends the definition of a macro or a block of awaitable statements
       * @return {null}
       */
      cmd_end() {},

      /**
       * Generates code that displays an informational text centered on the screen
       * @param text {String} The text to display
       * @return {String}
       */
      cmd_info(text) {},

      /**
       * Generates code that hides the info pane
       * @return {String}
       */
      cmd_hide_info() {},

      /**
       * Generates code that displays an informational text placed next to the widget with the given id.
       * @param id {String} The id of the widget
       * @param text {String} The text to display
       * @return {String}
       */
      cmd_widget_info(id, text) {},

      /**
       * Generates code that returns a promise which resolves when the given
       * property of the object with the given id is assigned the given value.
       * This works also with properties without a change event because the
       * value is periodically checked.
       * @param id {String} The id of the object
       * @param property {String} The name of the property
       * @param value {*} The value, must be serializable to JSON
       * @return {*|string}
       */
      cmd_await_property_value(id, property, value) {},

      /**
       * Generates code that returns a promise which resolves when the following
       * condition is met: the property with the given name of the object with the
       * given id changes to a value that, if serialized to json, matches the given
       * json literal. The json can contain regular expressions enclosed in
       * <! and !> as placeholders (and validators) for unknown values
       * (See {@link cboulanger.eventrecorder.player.Abstract#createRegexpForJsonComparison}
       *
       * @param id {String} The id of the object
       * @param property {String} The name of the property
       * @param json {String} A json expression
       * @return {*|string}
       */
      cmd_await_property_match_json(id, property, json) {},

      /**
       * Generates code that causes the given delay (in milliseconds).
       * The delay is capped by the {@link cboulanger.eventrecorder.player.Abstract#maxDelay} property
       * and will only be caused in presentation mode
       * @param delayInMs {Number}
       * @return {string}
       */
      cmd_delay(delayInMs) {},

      /**
       * Generates code that waits the given time in milliseconds, regardless of player mode
       * @param timeInMs {Number}
       * @return {string}
       */
      cmd_wait(timeInMs) {},

      /**
       * Generates code that returns a promise which resolves when the object with
       * the given id fires an event with the given name.
       * @param id {String} The id of the object
       * @param type {String} The type of the event
       * @return {*|string}
       */
      cmd_await_event(id, type) {},

      /**
       * Generates code that returns a promise which resolves when the object with
       * the given id fires an event with the given name.
       * @param id {String} The id of the object
       * @param type {String} The type of the event
       * @param data {*} The data to expect. Must be serializable to JSON
       * @return {*|string}
       */
      cmd_await_event_data(id, type, data) {},

      /**
       * Generates code that returns a promise which resolves when the object with
       * the given id fires an event with the given name with event data that
       * matches, if serialized to JSON, the given json string, which can contain
       * regular expressions embedded in <! and !>
       * @param id {String} The id of the object
       * @param type {String} The type of the event
       * @param json {*} A JSON expression that can contain regular expressions
       * embedded in <! and !>
       * @return {*|string}
       */
      cmd_await_event_match_json(id, type, json) {},

      /**
       * Generates code that returns a promise with resolves when the object with the given id becomes visible and rejects
       * if the timeout is reached before that happens.
       * @param id {String}
       * @return {String}
       */
      cmd_assert_appeared(id) {},

      /**
       * Generates code that returns a promise with resolves when the object with the given id disappears and rejects
       * if the timeout is reached before that happens.
       * @param id {String}
       * @return {String}
       */
      cmd_assert_disappeared(id) {},

      /**
       * Generates code that fires an `execute` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_execute(id) {},

      /**
       * Generates code that fires a `contextmenu` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_contextmenu(id) {},

      /**
       * Generates code that fires an event with the given payload on the object with the given id (Button, Command)
       * @param id {String}
       * @param event {String}
       * @param json {*}
       * @return {String}
       */
      cmd_fire(id, event, json) {},

      /**
      /**
       * Generates code that fires an `tap` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_tap(id) {},

      /**
       * Generates code that fires an `dbltap` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_dbltap(id) {},

      /**
       * Generates code that sets the `value` property of the object with the given id
       * @param id {String}
       * @param data {String} A JSON expression
       * @return {string}
       */
      cmd_set_value(id, data) {},

      /**
       * Generates code that returns a promise which resolves when the value
       * property of the object with the given id is assigned the given value.
       * The value must be given in JSON format, i.e. strings must be quoted.
       * @param id {String} The id of the object
       * @param value {String} The value, must be serializable to JSON
       * @return {*|string}
       */
      cmd_await_value(id, value) {},

      /**
       * Generates code that opens a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
       * @param id {String} The id of the {@link qx.ui.tree.VirtualTree}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_open_tree_node(id, nodeIndex) {},

      /**
       * Generates code that closes a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_close_tree_node(id, nodeIndex) {},

      /**
       * Generates code that opens a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_open_tree_node_treevirtual(id, nodeIndex) {},

      /**
       * Generates code that closes a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_close_tree_node_treevirtual(id, nodeIndex) {},

      /**
       * Generates code that sets a selection for all objects which have a `setSelection` method that
       * takes an array of qooxdoo widgets that should be selected.
       * @param id {String} Id of the object ón which the selection is set
       * @param selectedId {String} The id of the widget that is selected. Only one widget can be selected at this time
       * @return {String}
       */
      cmd_set_selection(id, selectedId) {},

      /**
       * Generates code that awaits a selection for all objects which have a `setSelection` method that
       * takes an array of qooxdoo widgets that should be selected within the timeout
       * @param id {String} Id of the object ón which the selection is set
       * @param selectedId {String} The id of the widget that should be selected
       * @return {String}
       */
      cmd_await_selection(id, selectedId) {},

      /**
       * Generates code that sets a selection for all (virtual) widgets that have a data model
       * @param id {String} The id of the widget on which the selection is set
       * @param indexArray {String} An array literal containing the indexes of the models
       * @return {String}
       */
      cmd_set_model_selection(id, indexArray) {},

      /**
       * Generates code that sets a selection on widgets that have a `getSelectables()` method
       * @param id {String} The id of the widget on which the selection is set
       * @param index {String|Number} The index of the selection in the selectables
       * @return {String}
       */
      cmd_set_selection_from_selectables(id, index) {},

      /**
       * Generates code that awaits a selection on widgets that have a `getSelectables()` method
       * @param id {String} The id of the widget on which the selection is set
       * @param index {String|Number} The index of the selection in the selectables
       * @return {String}
       */
      cmd_await_selection_from_selectables(id, index) {},

      /**
       * Resets the selection of a widget that has a `selection` property or a `resetSelection` method.
       * @param id {String} The id of the widget
       * @return {string}
       */
      cmd_reset_selection(id) {},

      /**
       * Generates code that sets an selection interval on a {@link qx.ui.table.Table}
       * @param id {String} The id of a {@link qx.ui.table.Table}
       * @param interval {String} The first and the last row to be selected, separated by comma.
       * @return {String}
       */
      cmd_set_table_selection(id, interval) {},

      /**
       * Generates code that set the selection on a {@link qx.ui.virtual.selection.Row} object
       * @param id {String} The id of a qx.ui.virtual.selection.Row object
       * @param rowIndex {String|Number} The index of the row to be selected
       * @return {String}
       */
      cmd_set_row_selection(id, rowIndex) {}

    }
  });
  cboulanger.eventrecorder.IPlayer.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "cboulanger.eventrecorder.player.Abstract": {
        "require": true
      },
      "cboulanger.eventrecorder.IPlayer": {
        "require": true
      },
      "qx.lang.String": {},
      "qx.lang.Type": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2018 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  
  ************************************************************************ */

  /**
   * This is an event player that works in the client
   */
  qx.Class.define("cboulanger.eventrecorder.player.Qooxdoo", {
    extend: cboulanger.eventrecorder.player.Abstract,
    implement: [cboulanger.eventrecorder.IPlayer],
    properties: {
      canReplayInBrowser: {
        refine: true,
        init: true
      }
    },
    members: {
      /**
       * Returns the player type
       * @return {String}
       */
      getType() {
        return "qooxdoo";
      },

      /**
       * @inheritDoc
       */
      getExportFileExtension() {
        return "js";
      },

      /**
       * Translates the intermediate code into the target language
       * @param script
       * @return {string} executable code
       */
      async translate(script) {
        let lines = (await this._translate(script)).split(/\n/).map(line => line.startsWith("(") ? "await ".concat(line, ";") : line).filter(line => Boolean(line)).map(line => "  " + line);
        lines.unshift("async function test() {");
        lines.push("}");
        return lines.join("\n");
      },

      /*
      ============================================================================
         COMMANDS
      ============================================================================
      */

      /**
       * @inheritDoc
       */
      cmd_info(text) {
        text = text.replace(/"/g, "");

        if (this.getMode() === "presentation") {
          return "cboulanger.eventrecorder.InfoPane.getInstance().useIcon(\"info\").display(\"".concat(text, "\");");
        }

        return "console.log(\"".concat(text, "\");");
      },

      /**
       * @inheritDoc
       */
      cmd_hide_info(text) {
        if (this.getMode() === "presentation") {
          return "cboulanger.eventrecorder.InfoPane.getInstance().hide();";
        }

        return "";
      },

      /**
       * @inheritDoc
       */
      cmd_widget_info(id, text) {
        text = text.replace(/"/g, "");

        if (this.getMode() === "presentation") {
          return "cboulanger.eventrecorder.InfoPane.getInstance().useIcon(\"info\").display(\"".concat(text, "\",qx.core.Id.getQxObject(\"").concat(id, "\"));");
        }

        return "";
      },

      /**
       * Generates code that causes the given delay (in milliseconds).
       * The delay is capped by the {@link #cboulanger.eventrecorder.player.Abstract#maxDelay} property
       * and will only be caused in presentation mode
       * @param delayInMs {Number}
       * @return {string}
       */
      cmd_delay(delayInMs) {
        delayInMs = Math.min(delayInMs, this.getMaxDelay());
        return this.getMode() === "presentation" && delayInMs > 0 ? "(new Promise(resolve => setTimeout(resolve,".concat(delayInMs, ")))") : "";
      },

      /**
       * Generates code that waits the given time in milliseconds, regardless of player mode
       * @param timeInMs {Number}
       * @return {string}
       */
      cmd_wait(timeInMs) {
        return "(new Promise(resolve => setTimeout(resolve,".concat(timeInMs, ")))");
      },

      /**
       * @inheritDoc
       */
      cmd_await_property_value(id, property, value) {
        return this.generateWaitForConditionCode("JSON.stringify(qx.core.Id.getQxObject(\"".concat(id, "\").get").concat(qx.lang.String.firstUp(property), "())==='").concat(JSON.stringify(value).replace(/'/, "\\'"), "'"));
      },

      /**
       * @inheritDoc
       */
      cmd_await_property_match_json(id, property, json) {
        if (!qx.lang.Type.isString(json)) {
          json = JSON.stringify(json);
        }

        let regExLiteral = this.createRegexpForJsonComparison(json);
        let timeoutmsg = "Timeout waiting for ID(".concat(id, ").").concat(property, " to match /").concat(regExLiteral.replace(/\\/, "\\\\").replace(/"/g, "\\\""), "/.");
        let type = "change" + qx.lang.String.firstUp(property);
        return this.generateWaitForEventCode(id, type, "{verbatim}/".concat(regExLiteral, "/"), timeoutmsg);
      },

      /**
       * Generates code that returns a promise which resolves when the object with
       * the given id fires an event with the given name.
       * @param id {String} The id of the object
       * @param type {String} The type of the event
       * @return {*|string}
       */
      cmd_await_event(id, type) {
        if (this.getMode() === "presentation") {
          return this.generateWaitForEventTimoutFunction(id, type, undefined, "if (window[\"".concat(this._globalRef, "\"].isRunning()) cboulanger.eventrecorder.InfoPane.getInstance().show().animate(); else return resolve(false)"));
        }

        return this.generateWaitForEventCode(id, type);
      },

      /**
       * @inheritDoc
       */
      cmd_await_event_data(id, type, data) {
        if (data !== undefined) {
          try {
            JSON.stringify(data);
          } catch (e) {
            throw new Error("Data must be serializable to JSON");
          }
        }

        if (this.getMode() === "presentation") {
          return this.generateWaitForEventTimoutFunction(id, type, data, "if (window[\"".concat(this._globalRef, "\"].isRunning()) cboulanger.eventrecorder.InfoPane.getInstance().show().animate(); else return resolve();"));
        }

        return this.generateWaitForEventCode(id, type, data);
      },

      /**
       * @inheritDoc
       */
      cmd_await_event_match_json(id, type, json) {
        if (this.getMode() === "presentation") {
          return this.generateWaitForEventTimoutFunction(id, type, json, "if (window[\"".concat(this._globalRef, "\"].isRunning()) cboulanger.eventrecorder.InfoPane.getInstance().show().animate(); else return resolve();"));
        }

        return this.generateWaitForEventCode(id, type, json);
      },

      /**
       * Generates code that returns a promise with resolves when the object with the given id becomes visible and rejects
       * if the timeout is reached before that happens.
       * @param id {String}
       * @return {String}
       */
      cmd_assert_appeared(id) {
        return "if(!qx.core.Id.getQxObject(\"".concat(id, "\").isVisible()) throw new Error(\"Failed: Object with id ").concat(id, " is not visible.\")");
      },

      /**
       * @deprecated
       */
      cmd_check_appear: this.cmd_assert_appeared,

      /**
       * Generates code that returns a promise with resolves when the object with the given id disappears and rejects
       * if the timeout is reached before that happens.
       * @param id {String}
       * @return {String}
       */
      cmd_assert_disappeared(id) {
        return "if (qx.core.Id.getQxObject(\"".concat(id, "\").isVisible()) throw new Error(\"Failed: Object with id ").concat(id, " is visible.\")");
      },

      /**
       * @deprecated
       */
      cmd_check_disappear: this.cmd_assert_disappeared,

      /**
       * @inheritDoc
       * @return {String}
       */
      cmd_execute(id) {
        return "if(!qx.core.Id.getQxObject(\"".concat(id, "\").isEnabled()) throw new Error(\"Failed: Object with id ").concat(id, " is not enabled.\"); qx.core.Id.getQxObject(\"").concat(id, "\").fireEvent(\"execute\");");
      },

      /**
       * @inheritDoc
       * @return {String}
       */
      cmd_contextmenu(id) {
        return "if(!qx.core.Id.getQxObject(\"".concat(id, "\").isEnabled()) throw new Error(\"Failed: Object with id ").concat(id, " is not enabled.\"); let tgt = qx.core.Id.getQxObject(\"").concat(id, "\").getContentElement().getDomElement(); let r = tgt.getBoundingClientRect(), clientX=parseInt((r.right+r.left)/2), clientY=parseInt((r.bottom+r.top)/2); qx.event.Registration.fireEvent(tgt, \"contextmenu\", qx.event.type.Mouse, [new MouseEvent(\"contextmenu\", {clientX,clientY}),tgt,null,true,true]);");
      },

      /**
       * Generates code that fires an event with the given payload on the object with the given id (Button, Command)
       * @param id {String}
       * @param event {String}
       * @param json {*}
       * @return {String}
       */
      cmd_fire(id, event, json) {
        if (json) {
          if (!qx.lang.Type.isString(json)) {
            json = JSON.stringify(json);
          }

          return "qx.core.Id.getQxObject(\"".concat(id, "\").fireDataEvent(\"").concat(event, "\",").concat(json, ");");
        }

        return "qx.core.Id.getQxObject(\"".concat(id, "\").fireEvent(\"").concat(event, "\");");
      },

      /**
       * Generates code that fires an `tap` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_tap(id) {
        // doesn't work yet because it needs mouse data etc.
        return ""; //return `qx.core.Id.getQxObject("${id}").fireEvent("tap", qx.event.type.Tap);`;
      },

      /**
       * Generates code that fires an `dbltap` event on the object with the given id (Button, Command)
       * @param id {String}
       * @return {String}
       */
      cmd_dbltap(id) {
        // doesn't work yet because it needs mouse data etc.
        return ""; //return `qx.core.Id.getQxObject("${id}").fireEvent("dbltap", qx.event.type.Tap);`;
      },

      /**
       * @inheritDoc
       */
      cmd_set_value(id, data) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").setValue(").concat(JSON.stringify(data), ");");
      },

      /**
       * @inheritDoc
       */
      cmd_await_value(id, value) {
        return this.cmd_await_property_value(id, "value", value);
      },

      /**
       * Generates code that opens a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
       * @param id {String} The id of the {@link qx.ui.tree.VirtualTree}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_open_tree_node(id, nodeIndex) {
        return "let t = qx.core.Id.getQxObject(\"".concat(id, "\"); t.openNode(t.getLookupTable().getItem(").concat(nodeIndex, "));");
      },

      /**
       * Generates code that closes a the node with the given node id on the {@link qx.ui.tree.VirtualTree} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_close_tree_node(id, nodeIndex) {
        return "let t = qx.core.Id.getQxObject(\"".concat(id, "\"); t.closeNode(t.getLookupTable().getItem(").concat(nodeIndex, "));");
      },

      /**
       * Generates code that opens a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_open_tree_node_treevirtual(id, nodeIndex) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").getDataModel().setState(").concat(nodeIndex, ",{bOpened:true});");
      },

      /**
       * Generates code that closes a the node with the given node id on the {@link qx.ui.treevirtual.TreeVirtual} with the given id
       * @param id {String} Id of the {@link qx.ui.treevirtual.TreeVirtual}
       * @param nodeIndex {String|Number} The index of the node in the tree data model
       * @return {String}
       */
      cmd_close_tree_node_treevirtual(id, nodeIndex) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").getDataModel().setState(").concat(nodeIndex, ",{bOpened:false});");
      },

      /**
       * Generates code that sets a selection for all objects which have a `setSelection` method that
       * takes an array of qooxdoo widgets that should be selected.
       * @param id {String} Id of the object ón which the selection is set
       * @param selectedId {String} The id of the widget that is selected. Only one widget can be selected at this time
       * @return {String}
       */
      cmd_set_selection(id, selectedId) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").setSelection([qx.core.Id.getQxObject(\"").concat(selectedId, "\")]);");
      },

      /**
       * Generates code that awaits a selection for all objects which have a `setSelection` method that
       * takes an array of qooxdoo widgets that should be selected within the timeout
       * @param id {String} Id of the object ón which the selection is set
       * @param selectedId {String} The id of the widget that should be selected
       * @return {String}
       */
      cmd_await_selection(id, selectedId) {
        let timeoutmsg = "Timeout when waiting for selection of object '".concat(selectedId, "' on '").concat(id, "'.");
        return this.generateWaitForEventCode(id, "changeSelection", "{verbatim}[qx.core.Id.getQxObject(\"".concat(selectedId, "\")]"), timeoutmsg);
      },

      /**
       * Generates code that sets a selection for all (virtual) widgets that have a data model
       * @param id {String} The id of the widget on which the selection is set
       * @param indexArray {Array} An array containing the indexes of the models
       * @return {String}
       */
      cmd_set_model_selection(id, indexArray) {
        return "let o = qx.core.Id.getQxObject(\"".concat(id, "\"); o.setSelection(new qx.data.Array(").concat(JSON.stringify(indexArray), ".map(i => o.getModel().getItem(i))));");
      },

      /**
       * Generates code that awaits a selection for all (virtual) widgets that have a data model
       * @param id {String} The id of the widget on which the selection is set
       * @param indexArray {Array} An array containing the indexes of the models
       * @return {String}
       */
      // cmd_await_model_selection(id, indexArray) {
      //
      //   return `let o = qx.core.Id.getQxObject("${id}"); o.setSelection(new qx.data.Array(${JSON.stringify(indexArray)}.map(i => o.getModel().getItem(i))))`;
      //   return `(waitForEvent(qx.core.Id.getQxObject("${id}").getSelection(), "change",${data}, ${this.getTimeout()}, "${timeoutmsg||"Timeout waiting for event '"+type+"'"}"))`;
      // },

      /**
       * @inheritDoc
       */
      cmd_set_selection_from_selectables(id, index) {
        return "let o = qx.core.Id.getQxObject(\"".concat(id, "\"); o.setSelection([o.getSelectables()[").concat(index, "]]);");
      },

      /**
       * @inheritDoc
       */
      cmd_await_selection_from_selectables(id, index) {
        return this.generateWaitForEventCode(id, "changeSelection", "{verbatim}[qx.core.Id.getQxObject(\"".concat(id, "\").getSelectables()[").concat(index, "]]"));
      },

      /**
       * Resets the selection of a widget that has a `selection` property or a `resetSelection` method.
       * @param id {String} The id of the widget
       * @return {string}
       */
      cmd_reset_selection(id) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").resetSelection();");
      },

      /**
       * Generates code that sets an selection interval on a {@link qx.ui.table.Table}
       * @param id {String} The id of a {@link qx.ui.table.Table}
       * @param interval {String} The first and the last row to be selected, separated by comma.
       * @return {String}
       */
      cmd_set_table_selection(id, interval) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").addSelectionInterval(").concat(interval, ");");
      },

      /**
       * Generates code that set the selection on a {@link qx.ui.virtual.selection.Row} object
       * @param id {String} The id of a qx.ui.virtual.selection.Row object
       * @param rowIndex {String|Number} The index of the row to be selected
       * @return {String}
       */
      cmd_set_row_selection(id, rowIndex) {
        return "qx.core.Id.getQxObject(\"".concat(id, "\").selectItem(").concat(rowIndex, ");");
      }

    }
  });
  cboulanger.eventrecorder.player.Qooxdoo.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "cboulanger.eventrecorder.player.Qooxdoo": {
        "require": true
      },
      "cboulanger.eventrecorder.IPlayer": {
        "require": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2018 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  
  ************************************************************************ */

  /**
   * A player that replays in the browser using qooxdoo code, and which can
   * export TestCafé code
   */
  qx.Class.define("cboulanger.eventrecorder.player.Testcafe", {
    extend: cboulanger.eventrecorder.player.Qooxdoo,
    implement: [cboulanger.eventrecorder.IPlayer],
    properties: {
      /**
       * @inheritDoc
       */
      canExportExecutableCode: {
        refine: true,
        init: true
      }
    },
    members: {
      /**
       * Returns the player type
       * @return {String}
       */
      getType() {
        return "testcafe";
      },

      /**
       * overridden to disallow presentation mode
       * @param value
       * @param old
       * @private
       */
      _applyMode(value, old) {
        if (value === "presentation") {
          this.warn("Presentation mode is not supported, switching to test mode");
          this.setMode("test");
        }
      },

      /**
       * Returns the file extension of the downloaded file in the target language
       * @return {string}
       */
      getExportFileExtension() {
        return "js";
      },

      /**
       * Translates the intermediate code into the target language
       * @param script
       * @return {string} executable code
       */
      async translate(script) {
        let lines = (await this._translate(script)).split(/\n/);
        return ["fixture `Test suite title`", "  .page `" + window.location.href + "`;", "", "test('Test description', async t => {", ...lines.map(line => "  " + line), "});"].join("\n");
      },

      /**
       * @inheritDoc
       */
      _generateUtilityFunctionsCode(script) {
        return cboulanger.eventrecorder.player.Testcafe.prototype._generateUtilityFunctionsCode.base.call(this, script).map(line => "await t.eval(() => {".concat(line, "});"));
      },

      /**
       * Translates a line of intermediate script code to testcafé code
       * @param line
       * @return {*|var}
       * @private
       */
      async translateLine(line) {
        let code = cboulanger.eventrecorder.player.Testcafe.prototype.translateLine.base.call(this, line);

        if (code && !code.startsWith("await t.") && !code.startsWith("//")) {
          code = code.endsWith(";") || code.endsWith("}") ? "await t.eval(()=>{".concat(code, "});") : "await t.eval(()=>".concat(code, ");");
        }

        return code;
      },

      /*
      ============================================================================
         COMMANDS
      ============================================================================
      */

      /**
       * Generates code that causes the given delay (in milliseconds).
       * The delay is capped by the {@link #cboulanger.eventrecorder.player.Abstract#maxDelay} property
       * and will only be caused in presentation mode
       * @param delayInMs {Number}
       * @return {string}
       */
      cmd_delay(delayInMs) {
        delayInMs = Math.min(delayInMs, this.getMaxDelay());
        return this.getMode() === "presentation" && delayInMs > 0 ? "await t.wait(".concat(delayInMs, ");") : "";
      },

      /**
       * Generates code that waits the given time in milliseconds, regardless of player mode
       * @param timeInMs {Number}
       * @return {string}
       */
      cmd_wait(timeInMs) {
        return "await t.wait(".concat(timeInMs, ");");
      }

    }
  });
  cboulanger.eventrecorder.player.Testcafe.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.ui.popup.Popup": {
        "construct": true,
        "require": true
      },
      "qx.ui.layout.Canvas": {
        "construct": true
      },
      "qx.ui.basic.Atom": {
        "construct": true
      },
      "qx.bom.Document": {},
      "qx.event.Timer": {},
      "qx.bom.element.Animation": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /**
   * A singleton instance of a popup to display informational text (and optionally, an icon) to the user.
   * @asset(qx/icon/Tango/32/status/dialog-information.png)
   */
  qx.Class.define("cboulanger.eventrecorder.InfoPane", {
    type: "singleton",
    extend: qx.ui.popup.Popup,
    statics: {
      icon: {
        "waiting": "cboulanger/eventrecorder/ajax-loader.gif",
        "info": "icon/32/status/dialog-information.png"
      }
    },
    construct: function construct() {
      qx.ui.popup.Popup.constructor.call(this, new qx.ui.layout.Canvas());
      this.set({
        decorator: "window",
        minWidth: 100,
        minHeight: 30,
        padding: 10,
        backgroundColor: "#f0f0f0",
        autoHide: false
      });
      this.__atom = new qx.ui.basic.Atom();

      this.__atom.getChildControl("label").set({
        rich: true,
        wrap: true
      });

      this.add(this.__atom);
      this.addListenerOnce("appear", this.center, this);
    },
    members: {
      __atom: null,

      /**
       * Center the widget
       * @return {cboulanger.eventrecorder.InfoPane}
       */
      center() {
        if (!this.isVisible()) {
          this.addListenerOnce("appear", this.center, this);
          return this;
        }

        let bounds = this.getBounds();

        if (!bounds) {
          return this;
        }

        this.set({
          marginTop: Math.round((qx.bom.Document.getHeight() - bounds.height) / 2),
          marginLeft: Math.round((qx.bom.Document.getWidth() - bounds.width) / 2)
        });
        return this;
      },

      /**
       * Displays the given text. Can optionally be placed next to a widget
       * @param text {String|false} The text to display. If false, hide the widget
       * @param widgetToPlaceTo {qx.ui.core.Widget|undefined} If given, place the
       * info panel next to this widget
       * @return {cboulanger.eventrecorder.InfoPane}
       * @ignore(widgetToPlaceTo)
       */
      display(text, widgetToPlaceTo = false) {
        if (!text) {
          this.hide();
        }

        this.__atom.setLabel(text);

        this.show();

        if (widgetToPlaceTo) {
          this.set({
            marginTop: 0,
            marginLeft: 0
          });

          if (widgetToPlaceTo.isVisible()) {
            this.placeToWidget(widgetToPlaceTo, true);
          } else {
            widgetToPlaceTo.addListenerOnce("appear", () => {
              this.placeToWidget(widgetToPlaceTo, true);
            });
          }
        } else {
          qx.event.Timer.once(this.center, this, 100);
        }

        return this;
      },

      /**
       * Return the content of the text label
       * @return {String}
       */
      getDisplayedText() {
        return this.__atom.getLabel();
      },

      /**
       * When displaying the info, show the icon associated with the given alias
       * @param alias
       * @return {cboulanger.eventrecorder.InfoPane}
       */
      useIcon(alias) {
        let iconpath = cboulanger.eventrecorder.InfoPane.icon[alias];

        if (!iconpath) {
          throw new Error("Icon alias \"".concat(alias, "\" is invalid."));
        }

        this.__atom.setIcon(iconpath);

        return this;
      },

      /**
       * Animate the info pane to draw attention from the user
       * @return {cboulanger.eventrecorder.InfoPane}
       */
      animate() {
        if (!this.isVisible()) {
          this.addListenerOnce("appear", this.animate, this);
          return this.show();
        }

        let animation = {
          duration: 1000,
          keyFrames: {
            0: {
              scale: 1,
              rotate: "0deg"
            },
            10: {
              scale: 0.9,
              rotate: "-3deg"
            },
            20: {
              scale: 0.9,
              rotate: "-3deg"
            },
            30: {
              scale: 1.1,
              rotate: "3deg"
            },
            40: {
              scale: 1.1,
              rotate: "-3deg"
            },
            50: {
              scale: 1.1,
              rotate: "3deg"
            },
            60: {
              scale: 1.1,
              rotate: "-3deg"
            },
            70: {
              scale: 1.1,
              rotate: "3deg"
            },
            80: {
              scale: 1.1,
              rotate: "-3deg"
            },
            90: {
              scale: 1.1,
              rotate: "3deg"
            },
            100: {
              scale: 1,
              rotate: "0deg"
            }
          }
        };
        qx.bom.element.Animation.animate(this.getContentElement().getDomElement(), animation);
        return this;
      },

      /**
       * Show the info pane. Overridden to return instance & allow chaining method calls.
       * @return {cboulanger.eventrecorder.InfoPane}
       */
      show() {
        cboulanger.eventrecorder.InfoPane.prototype.show.base.call(this);
        return this;
      }

    },

    /**
     * Destructor
     */
    destruct: function destruct() {
      this._disposeObjects("__atom");
    }
  });
  cboulanger.eventrecorder.InfoPane.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      "qookery.ace.internal.AceWidget": {},
      "qookery.Qookery": {},
      "qx.lang.Array": {}
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
   * @asset(qookery/lib/ace/*)
   *
   * @ignore(ace.*)
   */
  qx.Class.define("qookery.ace.internal.AceComponent", {
    extend: qookery.internal.components.EditableComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.EditableComponent.constructor.call(this, parentComponent);
    },
    members: {
      __editor: null,
      __ignoreChangeEvents: null,
      // Metadata
      getAttributeType: function getAttributeType(attributeName) {
        switch (attributeName) {
          case "display-indent-guides":
          case "h-scroll-bar-always-visible":
          case "highlight-active-line":
          case "show-fold-widgets":
          case "show-invisibles":
          case "show-gutter":
          case "show-print-margin":
          case "use-soft-tabs":
          case "use-wrap-mode":
          case "v-scroll-bar-always-visible":
            return "Boolean";

          case "print-margin-column":
          case "tab-size":
            return "Integer";

          case "cursor-style":
          case "theme":
            return "String";

          case "auto-complete":
            return "StringList";

          default:
            return qookery.ace.internal.AceComponent.prototype.getAttributeType.base.call(this, attributeName);
        }
      },
      setAttribute: function setAttribute(attributeName, value) {
        if (this.__editor != null) {
          switch (attributeName) {
            case "mode":
              this.__editor.getSession().setMode("ace/mode/" + value);

              break;
          }
        }

        return qookery.ace.internal.AceComponent.prototype.setAttribute.base.call(this, attributeName, value);
      },
      // Construction
      _createMainWidget: function _createMainWidget() {
        var widget = new qookery.ace.internal.AceWidget(this);

        this._applyWidgetAttributes(widget);

        return widget;
      },
      setup: function setup() {
        var libraryNames = ["ace"];
        var autoComplete = this.getAttribute("auto-complete");
        if (autoComplete != null) libraryNames.push("aceLanguageTools");
        qookery.Qookery.getRegistry().loadLibrary(libraryNames, function (error) {
          if (error != null) {
            this.error("Error loading library", error);
            return;
          }

          var aceWidget = this.getMainWidget();

          if (aceWidget.getContentElement().getDomElement()) {
            this.__attachAceEditor(aceWidget);

            return;
          }

          aceWidget.addListenerOnce("appear", function () {
            this.__attachAceEditor(aceWidget);
          }, this);
        }, this);
        qookery.ace.internal.AceComponent.prototype.setup.base.call(this);
      },
      // Public methods
      getEditor: function getEditor() {
        return this.__editor;
      },
      // Component implementation
      _updateUI: function _updateUI(value) {
        if (!this.__editor) return;
        this.__ignoreChangeEvents = true;

        try {
          var value = this.getValue();
          if (value == null) value = "";

          this.__editor.getSession().setValue(value);
        } catch (e) {
          this.error("Error seting value of ACE editor", e);
        } finally {
          this.__ignoreChangeEvents = false;
        }
      },
      _applyValid: function _applyValid(valid) {
        if (!valid) this.getMainWidget().addState("invalid");else this.getMainWidget().removeState("invalid");
      },
      setInvalidMessage: function setInvalidMessage(invalidMessage) {// Overriden to block default implementation
      },
      focus: function focus() {
        this.__editor.focus();
      },
      // Internal
      __attachAceEditor: function __attachAceEditor(aceWidget) {
        var aceContainer = aceWidget.getContentElement().getDomElement();
        var editor = this.__editor = ace.edit(aceContainer);
        editor.setReadOnly(this.isReadOnly());
        editor.setHighlightActiveLine(this.getAttribute("highlight-active-line", true));
        editor.setShowFoldWidgets(this.getAttribute("show-fold-widgets", true));
        editor.setShowInvisibles(this.getAttribute("show-invisibles", false));
        editor.setShowPrintMargin(this.getAttribute("show-print-margin", true));
        editor.setOption("cursorStyle", this.getAttribute("cursor-style", "ace"));
        var autoComplete = this.getAttribute("auto-complete");

        if (autoComplete != null) {
          editor.setOption("enableBasicAutocompletion", qx.lang.Array.contains(autoComplete, "basic"));
          editor.setOption("enableLiveAutocompletion", qx.lang.Array.contains(autoComplete, "live"));
          editor.setOption("enableSnippets", qx.lang.Array.contains(autoComplete, "snippets"));
        }

        editor.$blockScrolling = Infinity;
        editor.on("change", this.__onChange.bind(this));
        var renderer = editor.renderer;
        renderer.setPrintMarginColumn(this.getAttribute("print-margin-column", 80));
        renderer.setDisplayIndentGuides(this.getAttribute("display-indent-guides", true));
        renderer.setShowGutter(this.getAttribute("show-gutter", true));
        renderer.setHScrollBarAlwaysVisible(this.getAttribute("h-scroll-bar-always-visible", false));
        renderer.setVScrollBarAlwaysVisible(this.getAttribute("v-scroll-bar-always-visible", false));
        renderer.setTheme("ace/theme/" + this.getAttribute("theme", "textmate"));
        var session = editor.getSession();
        session.setMode("ace/mode/" + this.getAttribute("mode", "plain_text"));
        session.setTabSize(this.getAttribute("tab-size", 4));
        session.setUseSoftTabs(this.getAttribute("use-soft-tabs", true));
        session.setUseWrapMode(this.getAttribute("use-wrap-mode", false));

        this._updateUI(this.getValue());

        editor.selection.moveCursorFileStart();
        renderer.scrollToX(0);
        renderer.scrollToY(0);
        this.executeAction("initializeEditor", editor);
      },
      __onChange: function __onChange(event) {
        if (this.__ignoreChangeEvents) return;

        var value = this.__editor.getSession().getValue();

        if (value === "") value = null;

        this._setValueSilently(value);
      }
    },
    destruct: function destruct() {
      this.__editor = null;
    }
  });
  qookery.ace.internal.AceComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Mixin": {
        "usage": "dynamic",
        "require": true
      },
      "qxl.dialog.Dialog": {},
      "qx.event.Timer": {},
      "qx.Interface": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2018 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  
  ************************************************************************ */

  /**
   * This mixin contains methods that are used by script editor widgets
   * @ignore(ace)
   */
  qx.Mixin.define("cboulanger.eventrecorder.editor.MEditor", {
    members: {
      __players: null,

      /**
       * Returns the editor component
       * @return {qookery.IFormComponent}
       */
      getEditorObject() {
        return this.getQxObject("editor");
      },

      /**
       * Translates the text in the left editor into the language produced by the
       * given player type. Alerts any errors that occur.
       * @param playerType {String}
       * @param mode {String}
       * @return {String|false}
       */
      async translateTo(playerType, mode) {
        const exporter = this.getPlayerByType(playerType);
        const model = this.getQxObject("editor").getModel();

        if (mode) {
          exporter.setMode(mode);
        }

        let editedScript = model.getLeftEditorContent();

        try {
          let translatedText = await exporter.translate(editedScript);
          model.setRightEditorContent(translatedText);
          return translatedText;
        } catch (e) {
          this.error(e);
          qxl.dialog.Dialog.error(e.message);
        }

        return false;
      },

      /**
       * Export the script in the given format
       * @param playerType {String}
       * @param mode {String}
       * @return {Boolean}
       */
      async exportTo(playerType, mode) {
        const exporter = this.getPlayerByType(playerType);

        if (mode) {
          exporter.setMode(mode);
        }

        let translatedScript = this.getQxObject("editor").getModel().getRightEditorContent();

        if (!translatedScript) {
          if (!this.getScript()) {
            qxl.dialog.Dialog.error("No script to export!");
            return false;
          }

          translatedScript = await this.translateTo(playerType);
        }

        qx.event.Timer.once(() => {
          let filename = this._getApplicationName();

          this._download("".concat(filename, ".").concat(exporter.getExportFileExtension()), translatedScript);
        }, null, 0);
        return true;
      },

      _applyPlayerType(playerType, old) {
        if (old) {
          old = this.getPlayerByType(old);
        }

        this.setPlayer(this.getPlayerByType(playerType));
      },

      _applyPlayer(player, old) {
        if (old) {
          old.removeAllBindings();
          formModel.removeAllBindings();
        }

        if (!player) {
          return;
        }

        if (!this.getEditorObject()) {
          console.debug("Cannot apply player since editor is not ready..."); // editor hasn't been loaded and rendered yet

          return;
        }

        const formModel = this.getEditorObject().getModel();
        formModel.bind("targetMode", player, "mode");
        player.bind("mode", formModel, "targetMode");
        formModel.setTargetScriptType(player.getType());
      },

      __initializedEditor: false,

      _updateEditor() {
        try {
          this.getEditorObject().getModel().setLeftEditorContent(this.getScript());
          const leftEditor = this.getEditorObject().getComponent("leftEditor").getEditor();
          leftEditor.resize(); // the following should not be necessary

          if (!this.__initializedEditor) {
            leftEditor.getSession().on("change", () => {
              if (leftEditor.getValue() !== this.getScript()) {
                this.setScript(leftEditor.getValue());
              }
            });
            this.__initializedEditor = true;
          }
        } catch (e) {
          //console.warn(e.message);
          console.debug("Waiting for ACE editor to become available...");
          qx.event.Timer.once(() => this._updateEditor(), this, 500);
        }
      },

      /**
       * Configures the autocomplete feature in the editor(s)
       * @private
       */
      _setupAutocomplete() {
        let langTools;

        try {
          langTools = ace.require("ace/ext/language_tools");

          if (!langTools) {
            throw new Error("language_tools not available");
          }
        } catch (e) {
          console.log("Deferring setup of autocomplete...");
          qx.event.Timer.once(() => this._setupAutocomplete(), this, 1000);
          return;
        }

        let tokens = [];
        let iface = qx.Interface.getByName("cboulanger.eventrecorder.IPlayer").$$members;

        for (let key of Object.getOwnPropertyNames(iface)) {
          if (key.startsWith("cmd_") && typeof iface[key] == "function") {
            let code = iface[key].toString();
            let params = code.slice(code.indexOf("(") + 1, code.indexOf(")")).split(/,/).map(p => p.trim());
            let caption = key.substr(4).replace(/_/g, "-");
            let snippet = caption + " " + params.map((p, i) => "${".concat(i + 1, ":").concat(p, "}")).join(" ") + "\$0";
            let meta = params.join(" ");
            let value = null;
            tokens.push({
              caption,
              type: "command",
              snippet,
              meta,
              value
            });
          }
        }

        for (let id of this.getObjectIds()) {
          tokens.push({
            caption: id,
            type: "id",
            value: id
          });
        }

        const completer = {
          getCompletions: (editor, session, pos, prefix, callback) => {
            if (prefix.length === 0) {
              callback(null, []);
              return;
            }

            let line = editor.session.getLine(pos.row).substr(0, pos.column);
            let numberOfTokens = this.tokenize(line).length;
            let options = tokens // filter on positional argument
            .filter(token => token.type === "command" && numberOfTokens === 1 || token.type === "id" && numberOfTokens === 2) // filter on word match
            .filter(token => token.caption.toLocaleLowerCase().substr(0, prefix.length) === prefix.toLocaleLowerCase()) // create popup data
            .map(token => {
              token.score = 100 - (token.caption.length - prefix.length);
              return token;
            });
            callback(null, options);
          }
        };
        langTools.addCompleter(completer);
      }

    }
  });
  cboulanger.eventrecorder.editor.MEditor.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "cboulanger.eventrecorder.player.Testcafe": {
        "require": true,
        "defer": "runtime"
      },
      "cboulanger.eventrecorder.InfoPane": {
        "require": true,
        "defer": "runtime"
      },
      "qookery.ace.internal.AceComponent": {
        "require": true,
        "defer": "runtime"
      },
      "qx.core.Environment": {
        "defer": "load",
        "require": true
      },
      "qx.Class": {
        "usage": "dynamic",
        "defer": "runtime",
        "require": true
      },
      "qx.ui.window.Window": {
        "construct": true,
        "require": true
      },
      "cboulanger.eventrecorder.MHelperMethods": {
        "require": true
      },
      "cboulanger.eventrecorder.editor.MEditor": {
        "require": true
      },
      "qx.util.AliasManager": {
        "construct": true
      },
      "qx.ui.layout.HBox": {
        "construct": true
      },
      "cboulanger.eventrecorder.recorder.Recorder": {
        "construct": true
      },
      "qx.core.Id": {
        "construct": true
      },
      "cboulanger.eventrecorder.player.Qooxdoo": {
        "construct": true
      },
      "qx.ui.menu.Menu": {},
      "qx.ui.menu.Button": {},
      "qx.ui.form.SplitButton": {},
      "cboulanger.eventrecorder.SplitToggleButton": {},
      "qx.ui.menu.CheckBox": {},
      "qx.ui.form.Button": {},
      "qx.bom.storage.Web": {},
      "qx.util.Uri": {},
      "qxl.dialog.Dialog": {},
      "qx.bom.Window": {},
      "qx.ui.layout.VBox": {},
      "qx.util.ResourceManager": {
        "defer": "runtime"
      },
      "qx.event.Timer": {},
      "qx.io.request.Jsonp": {},
      "qookery.Qookery": {
        "defer": "runtime"
      },
      "qx.bom.Lifecycle": {
        "defer": "runtime"
      },
      "qx.core.Init": {
        "defer": "runtime"
      }
    },
    "environment": {
      "provided": [],
      "required": {
        "eventrecorder.show_progress": {},
        "eventrecorder.editor.placement": {}
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2018 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  
  ************************************************************************ */

  /**
   * The UI Controller for the recorder
   * @asset(cboulanger/eventrecorder/*)
   * @asset(qxl/dialog/*)
   * @require(cboulanger.eventrecorder.player.Testcafe)
   * @require(cboulanger.eventrecorder.InfoPane)
   * @require(qookery.ace.internal.AceComponent)
   * @ignore(ace)
   */
  qx.Class.define("cboulanger.eventrecorder.UiController", {
    extend: qx.ui.window.Window,
    include: [cboulanger.eventrecorder.MHelperMethods, cboulanger.eventrecorder.editor.MEditor],
    statics: {
      CONFIG_KEY: {
        SCRIPT: "eventrecorder.script",
        PLAYER_TYPE: "eventrecorder.player_type",
        PLAYER_MODE: "eventrecorder.player_mode",
        GIST_ID: "eventrecorder.gist_id",
        AUTOPLAY: "eventrecorder.autoplay",
        SHOW_PROGRESS: "eventrecorder.show_progress",
        SCRIPTABLE: "eventrecorder.scriptable",
        RELOAD_BEFORE_REPLAY: "eventrecorder.reload_before_replay",
        SCRIPT_URL: "eventrecorder.script_url"
      },
      FILE_INPUT_ID: "eventrecorder-fileupload",
      aliases: {
        "eventrecorder.icon.record": "cboulanger/eventrecorder/media-record.png",
        "eventrecorder.icon.start": "cboulanger/eventrecorder/media-playback-start.png",
        "eventrecorder.icon.pause": "cboulanger/eventrecorder/media-playback-pause.png",
        "eventrecorder.icon.stop": "cboulanger/eventrecorder/media-playback-stop.png",
        "eventrecorder.icon.edit": "cboulanger/eventrecorder/document-properties.png",
        "eventrecorder.icon.save": "cboulanger/eventrecorder/document-save.png",
        "eventrecorder.icon.load": "cboulanger/eventrecorder/document-open.png",
        "eventrecorder.icon.export": "cboulanger/eventrecorder/emblem-symbolic-link.png",
        // need a way to automatically include this
        "qxl.dialog.icon.cancel": "qxl/dialog/icon/IcoMoonFree/272-cross.svg",
        "qxl.dialog.icon.ok": "qxl/dialog/icon/IcoMoonFree/273-checkmark.svg",
        "qxl.dialog.icon.info": "qxl/dialog/icon/IcoMoonFree/269-info.svg",
        "qxl.dialog.icon.error": "qxl/dialog/icon/IcoMoonFree/270-cancel-circle.svg",
        "qxl.dialog.icon.warning": "qxl/dialog/icon/IcoMoonFree/264-warning.svg"
      }
    },
    properties: {
      /**
       * Current mode
       */
      recorderMode: {
        check: ["player", "recorder"],
        event: "changeMode",
        init: "recorder",
        apply: "_applyRecorderMode"
      },

      /**
       * The recorder instance
       */
      recorder: {
        check: "cboulanger.eventrecorder.recorder.Recorder",
        event: "changeRecorder",
        nullable: true
      },

      /**
       * The player instance
       */
      player: {
        check: "cboulanger.eventrecorder.IPlayer",
        event: "changePlayer",
        apply: "_applyPlayer",
        nullable: true
      },

      /**
       * The recorded script
       */
      script: {
        check: "String",
        nullable: true,
        deferredInit: true,
        event: "changeScript",
        apply: "_applyScript"
      },

      /**
       * Whether the stored script should start playing after the
       * application loads
       */
      autoplay: {
        check: "Boolean",
        nullable: false,
        deferredInit: true,
        event: "changeAutoplay",
        apply: "_applyAutoplay"
      },

      /**
       * Whether the application is reloaded before the script is replayed
       */
      reloadBeforeReplay: {
        check: "Boolean",
        nullable: false,
        deferredInit: true,
        event: "changeReloadBeforeReplay",
        apply: "_applyReloadBeforeReplay"
      },

      /**
       * The id of a gist to replay a script from, if any
       */
      gistId: {
        check: "String",
        nullable: true,
        deferredInit: true,
        event: "changeGistId",
        apply: "_applyGistId"
      },

      /**
       * Whether the event recorder is scriptable
       * (only useful for demos of the eventrecorder itself)
       */
      scriptable: {
        check: "Boolean",
        nullable: false,
        deferredInit: true,
        event: "changeScriptable"
      }
    },

    /**
     * Constructor
     * @param caption {String} The caption of the window. Will be used to create
     * an object id.
     * @ignore(env)
     * @ignore(storage)
     * @ignore(uri_params)
     * @ignore(caption)
     */
    construct: function construct(caption = "Event Recorder") {
      qx.ui.window.Window.constructor.call(this); // workaround until icon theme can be mixed into application theme

      const aliasMgr = qx.util.AliasManager.getInstance();
      const aliases = aliasMgr.getAliases();

      for (let [alias, base] of Object.entries(cboulanger.eventrecorder.UiController.aliases)) {
        if (!aliases[alias]) {
          aliasMgr.add(alias, base);
        }
      } //


      this.set({
        caption,
        modal: false,
        showMinimize: false,
        showMaximize: false,
        height: 90,
        layout: new qx.ui.layout.HBox(5),
        allowGrowX: false,
        allowGrowY: false
      });
      const recorder = new cboulanger.eventrecorder.recorder.Recorder();
      this.setRecorder(recorder); // initialize application parameters

      let {
        script,
        reloadBeforeReplay,
        autoplay,
        gistId,
        scriptable,
        playerType,
        playerMode
      } = this._getParamsFromEnvironment();

      this.initScript(script);
      this.initReloadBeforeReplay(reloadBeforeReplay === null ? false : reloadBeforeReplay);
      this.initAutoplay(autoplay);
      this.initGistId(gistId);
      this.initScriptable(scriptable); // assign id to this widget from caption

      const objectId = caption.replace(/ /g, "").toLocaleLowerCase();
      this.setQxObjectId(objectId);
      qx.core.Id.getInstance().register(this, objectId); // do not record events for this widget unless explicitly requested

      if (!this.getScriptable()) {
        recorder.excludeIds(objectId);
      } // caption


      this.bind("recorder.running", this, "caption", {
        converter: v => v ? "Recording ..." : caption
      });
      this.bind("player.running", this, "caption", {
        converter: v => v ? "Replaying ..." : caption
      }); // this creates the buttons in this order and adds them to the window

      this._createControl("load");

      this._createControl("replay");

      this._createControl("record");

      let stopButton = this._createControl("stop");

      this._createControl("edit");

      this._createControl("save"); // stop button special handling


      const stopButtonState = () => {
        stopButton.setEnabled(recorder.isRunning() || Boolean(this.getPlayer()) && this.getPlayer().isRunning());
      };

      recorder.addListener("changeRunning", stopButtonState);
      this.addListener("changePlayer", e => {
        if (e.getData()) {
          this.getPlayer().addListener("changeRunning", stopButtonState);
        }
      }); // form for file uploads

      var form = document.createElement("form");
      form.setAttribute("visibility", "hidden");
      document.body.appendChild(form);
      let input = document.createElement("input");
      input.setAttribute("id", cboulanger.eventrecorder.UiController.FILE_INPUT_ID);
      input.setAttribute("type", "file");
      input.setAttribute("name", "file");
      input.setAttribute("visibility", "hidden");
      form.appendChild(input); // Player configuration

      let player = this.getPlayerByType(playerType);
      player.setMode(playerMode);

      const {
        storage
      } = this._getPersistenceProviders();

      player.addListener("changeMode", e => {
        storage.setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_MODE, e.getData());
      });
      this.setPlayer(player); // Autoplay

      if (script && !this._scriptUrlMatches()) {
        script = null;
        this.setScript("");
        this.setAutoplay(false);
      }

      if (gistId && !script) {
        this.getRawGist(gistId).then(gist => {
          // if the eventrecorder itself is scriptable, run the gist in a separate player without GUI
          if (this.getScriptable()) {
            let gistplayer = new cboulanger.eventrecorder.player.Qooxdoo();
            gistplayer.setMode(playerMode);

            if (autoplay) {
              this.setAutoplay(false);
              gistplayer.replay(gist);
            }
          } else {
            this.setScript(gist);

            if (autoplay) {
              this.setAutoplay(false);
              this.replay();
            }
          }
        }).catch(e => {
          throw new Error("Gist ".concat(gistId, " cannot be loaded: ").concat(e.message, "."));
        });
      } else if (script && autoplay) {
        this.setAutoplay(false);
        this.replay();
      }
    },

    /**
     * The methods and simple properties of this class
     */
    members: {
      /**
       * @var {qx.ui.window.Window}
       */
      __editorWindow: null,

      /**
       * Internal method to create child controls
       * @param id
       * @return {qx.ui.core.Widget}
       * @private
       */
      _createControl(id) {
        let control;
        let recorder = this.getRecorder();

        switch (id) {
          /**
           * Load Button
           */
          case "load":
            {
              let loadMenu = new qx.ui.menu.Menu();
              let loadUserGistButton = new qx.ui.menu.Button("Load user gist");
              loadUserGistButton.addListener("execute", this.loadUserGist, this);
              loadUserGistButton.setQxObjectId("fromUserGist");
              loadMenu.add(loadUserGistButton);
              let loadGistByIdButton = new qx.ui.menu.Button("Load gist by id");
              loadGistByIdButton.addListener("execute", this.loadGistById, this);
              loadGistByIdButton.setQxObjectId("fromGistById");
              loadMenu.add(loadGistByIdButton);
              control = new qx.ui.form.SplitButton();
              control.set({
                enabled: false,
                icon: "eventrecorder.icon.load",
                toolTipText: "Load script",
                menu: loadMenu
              });
              control.addOwnedQxObject(loadUserGistButton);
              control.addOwnedQxObject(loadGistByIdButton);
              control.addListener("execute", this.load, this); // enable load button only if player can replay scripts in the browser

              this.bind("recorder.running", control, "enabled", {
                converter: v => !v
              });
              break;
            }

          /**
           * Replay button
           */

          case "replay":
            {
              control = new cboulanger.eventrecorder.SplitToggleButton();
              let replayMenu = new qx.ui.menu.Menu();
              control.addOwnedQxObject(replayMenu, "menu");
              let macroButton = new qx.ui.menu.Button("Macros");
              replayMenu.add(macroButton);
              replayMenu.addOwnedQxObject(macroButton, "macros");
              let macroMenu = new qx.ui.menu.Menu();
              macroButton.setMenu(macroMenu);
              macroButton.addOwnedQxObject(macroMenu, "menu");
              this.addListener("changePlayer", () => {
                let player = this.getPlayer();

                if (!player) {
                  return;
                }

                player.addListener("changeMacros", () => {
                  this._updateMacroMenu();

                  player.getMacros().getNames().addListener("change", this._updateMacroMenu, this);
                });
              });
              replayMenu.addSeparator();
              replayMenu.add(new qx.ui.menu.Button("Options:"));
              let optionReload = new qx.ui.menu.CheckBox("Reload page before replay");
              this.bind("reloadBeforeReplay", optionReload, "value");
              optionReload.bind("value", this, "reloadBeforeReplay");
              replayMenu.add(optionReload);
              control.addListener("execute", this._startReplay, this);
              control.set({
                enabled: false,
                icon: "eventrecorder.icon.start",
                toolTipText: "Replay script",
                menu: replayMenu
              }); // show replay button only if player is attached and if it can replay a script in the browser

              this.bind("player", control, "visibility", {
                converter: player => Boolean(player) && player.getCanReplayInBrowser() ? "visible" : "excluded"
              });
              this.bind("recorder.running", control, "enabled", {
                converter: v => !v
              });
              this.bind("player.running", control, "value");
              break;
            }

          /**
           * Record Button
           */

          case "record":
            {
              let recordMenu = new qx.ui.menu.Menu();
              recordMenu.add(new qx.ui.menu.Button("Options:"));
              let debugEvents = new qx.ui.menu.CheckBox("Log event data");
              debugEvents.bind("value", this, "recorder.logEvents");
              recordMenu.add(debugEvents);
              control = new cboulanger.eventrecorder.SplitToggleButton();
              control.setIcon("eventrecorder.icon.record");
              control.setMenu(recordMenu);
              control.addListener("changeValue", this._toggleRecord, this);
              recorder.bind("running", control, "value");
              recorder.bind("running", control, "enabled", {
                converter: v => !v
              });
              this.bind("recorderMode", control, "enabled", {
                converter: v => v === "recorder"
              });
              break;
            }

          /**
           * Stop Button
           */

          case "stop":
            {
              control = new qx.ui.form.Button();
              control.set({
                enabled: false,
                icon: "eventrecorder.icon.stop",
                toolTipText: "Stop recording"
              });
              control.addListener("execute", this.stop, this);
              break;
            }

          /**
           * Edit Button
           */

          case "edit":
            {
              let editMenu = new qx.ui.menu.Menu();
              let qxWinBtn = new qx.ui.menu.Button("Open editor in this window");
              qxWinBtn.addListener("execute", () => this.edit("inside"));
              editMenu.add(qxWinBtn);
              let nativeWinBtn = new qx.ui.menu.Button("Open editor in browser window");
              nativeWinBtn.addListener("execute", () => this.edit("outside"));
              editMenu.add(nativeWinBtn);
              control = new qx.ui.form.SplitButton();
              control.set({
                enabled: true,
                icon: "eventrecorder.icon.edit",
                toolTipText: "Edit script",
                menu: editMenu
              });
              control.addOwnedQxObject(editMenu, "menu");
              control.addListener("execute", () => this.edit());
              this.bind("recorder.running", control, "enabled", {
                converter: v => !v
              }); // this.bind("script", editButton, "enabled", {
              //   converter: v => Boolean(v)
              // });

              break;
            }

          /**
           * Save Button
           */

          case "save":
            {
              control = new qx.ui.form.Button();
              control.set({
                enabled: false,
                icon: "eventrecorder.icon.save",
                toolTipText: "Save script"
              });
              control.addListener("execute", this.save, this);
              this.bind("recorder.running", control, "enabled", {
                converter: v => !v
              });
              break;
            }

          default:
            throw new Error("Control '".concat(id, " does not exist.'"));
        } // add to widget and assign object id


        this.add(control);
        this.addOwnedQxObject(control, id);
        return control;
      },

      async _updateMacroMenu() {
        const macroMenu = this.getQxObject("replay/menu/macros/menu");
        const player = this.getPlayer();
        macroMenu.removeAll();

        for (let name of player.getMacroNames().toArray()) {
          let description = player.getMacroDescription(name);
          let label = description.trim() ? name + ": " + description : name;
          let menuButton = new qx.ui.menu.Button(label);
          menuButton.addListener("execute", async () => {
            let lines = player.getMacroDefinition(name);
            await player.replay(lines);
            cboulanger.eventrecorder.InfoPane.getInstance().hide();
          });
          macroMenu.add(menuButton);
        }
      },

      /**
       * Returns a map with object providing persistence
       * @return {{env: qx.core.Environment, storage: qx.bom.storage.Web, uri_params: {}}}
       * @private
       */
      _getPersistenceProviders() {
        return {
          env: qx.core.Environment,
          storage: qx.bom.storage.Web.getSession(),
          uri_params: qx.util.Uri.parseUri(window.location.href)
        };
      },

      /**
       * Get application parameters from from environment, which can be query params,
       * local storage, or qooxdoo environment variables
       * @private
       * @ignore(env)
       * @ignore(storage)
       * @ignore(uri_params)
       */
      _getParamsFromEnvironment() {
        let {
          env,
          storage,
          uri_params
        } = this._getPersistenceProviders();

        let script = storage.getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.SCRIPT) || "";
        let autoplay = uri_params.queryKey.eventrecorder_autoplay || storage.getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.AUTOPLAY) || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.AUTOPLAY) || false;
        let reloadBeforeReplay = storage.getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.RELOAD_BEFORE_REPLAY);
        let gistId = uri_params.queryKey.eventrecorder_gist_id || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.GIST_ID) || null;
        let scriptable = Boolean(uri_params.queryKey.eventrecorder_scriptable) || qx.core.Environment.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.SCRIPTABLE) || false;
        let playerType = uri_params.queryKey.eventrecorder_type || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_TYPE) || "qooxdoo";
        let playerMode = uri_params.queryKey.eventrecorder_player_mode || storage.getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_MODE) || env.get(cboulanger.eventrecorder.UiController.CONFIG_KEY.PLAYER_MODE) || "presentation";
        let info = {
          script,
          autoplay,
          reloadBeforeReplay,
          gistId,
          scriptable,
          scriptUrl: this._getScriptUrl(),
          playerType,
          playerMode
        }; //console.debug(info);

        return info;
      },

      _applyRecorderMode(value, old) {
        if (value === "player" && !this.getPlayer()) {
          throw new Error("Cannot switch to player mode: no player has been set");
        }
      },

      /**
       * When setting the script property, store it in the browser
       * @param value
       * @param old
       * @private
       */
      _applyScript(value, old) {
        qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.SCRIPT, value);
        this.getRecorder().setScript(value);

        if (!this._getScriptUrl()) {
          this._saveScriptUrl();
        }

        if (!this.getPlayer()) {
          this.addListenerOnce("changePlayer", async () => {
            await this.getPlayer().translate(value);

            this._updateMacroMenu();
          });
        }
      },

      _getScriptUrl() {
        return qx.bom.storage.Web.getSession().getItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.SCRIPT_URL);
      },

      _saveScriptUrl() {
        qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.SCRIPT_URL, document.location.href);
      },

      _scriptUrlMatches() {
        return this._getScriptUrl() === document.location.href;
      },

      _applyGistId(value, old) {// to do: add to URI
      },

      /**
       * Apply the "autoplay" property and store it in local storage
       * @param value
       * @param old
       * @private
       */
      _applyAutoplay(value, old) {
        qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.AUTOPLAY, value);
      },

      /**
       * Apply the "reloadBeforeReplay" property and storeit in local storage
       * @param value
       * @param old
       * @private
       */
      _applyReloadBeforeReplay(value, old) {
        qx.bom.storage.Web.getSession().setItem(cboulanger.eventrecorder.UiController.CONFIG_KEY.RELOAD_BEFORE_REPLAY, value);
      },

      /**
       * Event handler for record toggle button
       * @param e
       */
      _toggleRecord(e) {
        if (e.getData()) {
          this.record();
        }
      },

      /**
       * Event handler for replay button
       * @private
       */
      _startReplay() {
        // start
        if (this.getScript() || this.getGistId()) {
          if (this.getReloadBeforeReplay()) {
            // reload
            this.setAutoplay(true);
            window.location.reload();
          } else if (this.getScript()) {
            this.replay();
          } else {
            this.getQxObject("replay").setValue(false);
          }
        }
      },

      /**
       * Uploads content to the browser. Returns the content of the file.
       * @return {Promise<String>}
       * @private
       */
      async _upload() {
        return new Promise((resolve, reject) => {
          let input = document.getElementById(cboulanger.eventrecorder.UiController.FILE_INPUT_ID);
          input.addEventListener("change", e => {
            let file = e.target.files[0];

            if (!file.name.endsWith(".eventrecorder")) {
              reject(new Error("Not an eventrecorder script"));
            }

            let reader = new FileReader();
            reader.addEventListener("loadend", () => {
              resolve(reader.result);
            });
            reader.addEventListener("error", reject);
            reader.readAsText(file);
          });
          input.click();
        });
      },

      /**
       * Donwload content
       * @param filename
       * @param text
       * @private
       */
      _download(filename, text) {
        var element = document.createElement("a");
        element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
        element.setAttribute("download", filename);
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      },

      /**
       * Returns the name of the application by using the parent directory of the
       * index.html script
       * @return {string}
       * @private
       */
      _getApplicationName() {
        return window.document.location.pathname.split("/").slice(-2, -1).join("");
      },

      /*
       ===========================================================================
         PUBLIC API
       ===========================================================================
       */

      /**
       * Return an array of object ids that have been assigned in the recorded application
       * @return {[]}
       */
      getObjectIds() {
        return this.getRecorder().getObjectIds();
      },

      /**
       * Starts recording
       */
      async record() {
        let recorder = this.getRecorder();

        if (this.getScript().trim() !== "" && !this.getScriptable()) {
          let mode = await qxl.dialog.Dialog.select("Do you want to overwrite your script or append new events?", [{
            label: "Append",
            value: "append"
          }, {
            label: "Overwrite",
            value: "overwrite"
          }]).promise();

          if (!mode) {
            this.getQxObject("record").setValue(false);
            return;
          }

          recorder.setMode(mode);
        }

        recorder.start();
      },

      /**
       * Stops recording/replaying
       */
      stop() {
        if (this.getRecorder().isRunning()) {
          this.getRecorder().stop();
          let script = this.getRecorder().getScript();

          this._saveScriptUrl();

          this.setScript(script);
        }

        if (this.getPlayer() && this.getPlayer().isRunning()) {
          this.getPlayer().stop();
        }
      },

      /**
       * Replays the current script
       * @return {Promise<void>}
       */
      async replay() {
        if (!this.getScript()) {
          throw new Error("No script to replay");
        }

        let player = this.getPlayer();

        if (!player) {
          throw new Error("No player has been set");
        }

        this.setRecorderMode("player");
        let infoPane = cboulanger.eventrecorder.InfoPane.getInstance();
        infoPane.useIcon("waiting");

        if (qx.core.Environment.get("eventrecorder.show_progress")) {
          player.addListener("progress", e => {
            let [step, steps] = e.getData();
            infoPane.display("Replaying ... (".concat(step, "/").concat(steps, ")"));
          });
        }

        let error = null;

        try {
          await player.replay(this.getScript());
        } catch (e) {
          error = e;
        }

        infoPane.hide();
        this.setRecorderMode("recorder");

        if (error) {
          throw error;
        }
      },

      __lastMode: null,

      /**
       * Edits the current script, either using the in-window editor or the
       * external editor window.
       * @param mode {String|undefined}
       */
      async edit(mode) {
        const defaultMode = qx.core.Environment.get("eventrecorder.editor.placement");

        if (mode === undefined && (this.__lastMode || defaultMode)) {
          mode = this.__lastMode || defaultMode;
        }

        if (this.__editorWindow) {
          //console.debug({mode, lastMode:this.__lastMode});
          if (mode === this.__lastMode) {
            if (mode === "inside") {
              //console.debug("Opening existing qooxdoo window.");
              this.__editorWindow.open();

              return;
            } else if (qx.bom.Window.isClosed(this.__editorWindow)) {
              //console.debug("Destroying existing closed native window and recreating it.");
              this.__editorWindow = null;
            } else {
              //console.debug("Bringing existing native window to front.");
              this.__editorWindow.focus();

              return;
            }
          } else {
            //console.debug("Windows mode has changed, creating new window...");
            try {
              this.removeOwnedQxObject("editor");
            } catch (e) {}

            if (this.__lastMode === "inside") {
              //console.debug("Destroying existing qooxdoo native window.");
              this.__editorWindow.close();

              this.__editorWindow.dispose();
            } else if (qx.bom.Window.isClosed(this.__editorWindow)) {
              //console.debug("Destroying existing closed native window.");
              this.__editorWindow = null;
            } else {
              //console.debug("Closing existing open native window...");
              this.__editorWindow.close();
            }
          }
        }

        switch (mode) {
          case "outside":
            this.__editorWindow = await this.__createBrowserEditorWindow();
            break;

          case "inside":
          default:
            this.__editorWindow = await this.__createpQxEditorWindow();
            break;
        }

        this.__lastMode = mode;
      },

      __lastData: null,
      __listenersAttached: false,

      async __createBrowserEditorWindow() {
        let popup = qx.bom.Window.open(this.getApplicationParentDir() + "/eventrecorder_scripteditor", Math.random(), {
          width: 800,
          height: 600,
          dependent: true,
          menubar: false,
          status: false,
          scrollbars: false,
          toolbar: false
        });
        window.addEventListener("beforeunload", () => {
          popup.close();
          popup = null;
        });

        const sendMessage = data => {
          if (qx.bom.Window.isClosed(popup)) {
            // remove listeners instead!!
            return;
          }

          popup.postMessage(data, "*"); //console.debug(">>> Message sent:");
          //console.debug(data);
        };

        window.addEventListener("message", e => {
          if (e.source !== popup) {
            this.warn("Ignoring message from unknown source...");
            return;
          }

          const data = e.data;
          this.__lastData = data; //console.debug(">>> Message received:");
          //console.debug(data);

          if (data.script === null) {
            //console.debug("Received initialization message from external editor.");
            // initialization message
            sendMessage({
              script: this.getScript(),
              playerType: this.getPlayer().getType(),
              objectIds: this.getObjectIds()
            });
            this.__lastData = {};

            if (!this.__listenersAttached) {
              this.addListener("changeScript", e => {
                const script = e.getData();

                if (this.__lastData.script !== script) {
                  sendMessage({
                    script
                  });
                }
              });
              this.addListener("changePlayer", e => {
                sendMessage({
                  playerType: e.getData().getType()
                });
              });
              this.__listenersAttached = true;
            }

            return;
          }

          this.set(e.data);
        });
        return popup;
      },

      /**
       * Sets up an editor in the given window itself
       * @private
       */
      async __createpQxEditorWindow() {
        let win = new qx.ui.window.Window("Edit script");
        win.set({
          layout: new qx.ui.layout.VBox(5),
          showMinimize: false,
          width: 800,
          height: 600
        });
        win.addListener("appear", () => {
          win.center();
        });
        const formUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/forms/editor.xml");
        const formComponent = await this.createQookeryComponent(formUrl);
        this.addOwnedQxObject(formComponent, "editor");
        const editorWidget = formComponent.getMainWidget();
        win.add(editorWidget);
        formComponent.addOwnedQxObject(win, "window");
        editorWidget.addListener("appear", this._updateEditor, this);
        this.bind("script", formComponent.getModel(), "leftEditorContent");
        let formModel = formComponent.getModel();
        formModel.bind("leftEditorContent", this, "script");
        formModel.addListener("changeTargetScriptType", e => this.translateTo(formModel.getTargetScriptType(), formModel.getTargetMode()));
        formModel.addListener("changeTargetMode", e => this.translateTo(formModel.getTargetScriptType(), formModel.getTargetMode()));
        win.open();
        qx.event.Timer.once(this._setupAutocomplete, this, 2000);
        return win;
      },

      /**
       * Save the current script to the local machine
       */
      save() {
        qx.event.Timer.once(() => {
          let filename = this._getApplicationName() + ".eventrecorder";

          this._download(filename, this.getScript());
        }, null, 0);
      },

      /**
       * Load a script from the local machine
       * @return {Promise<void>}
       */
      async load() {
        try {
          let script = await this._upload();
          this.setScript(script);
        } catch (e) {
          qxl.dialog.Dialog.error(e.message);
        }
      },

      /**
       * Loads a gist selected from a github user's gists
       * @return {Promise<void>}
       */
      loadUserGist: async function loadUserGist() {
        let formData = {
          username: {
            type: "Textfield",
            label: "Username"
          },
          show_all: {
            type: "Checkbox",
            value: false,
            label: "Show all scripts (even if URL does not match)"
          }
        };
        let answer = await qxl.dialog.Dialog.form("Please enter the GitHub username", formData).promise();

        if (!answer || !answer.username.trim()) {
          return;
        }

        let username = answer.username;
        cboulanger.eventrecorder.InfoPane.getInstance().useIcon("waiting").display("Retrieving data from GitHub...");
        let gist_data = await new Promise((resolve, reject) => {
          let url = "https://api.github.com/users/".concat(username, "/gists");
          let req = new qx.io.request.Jsonp(url);
          req.addListener("success", e => {
            cboulanger.eventrecorder.InfoPane.getInstance().hide();
            let response = req.getResponse();

            if (response.data && response.message) {
              reject(response.message);
            } else if (response.data) {
              resolve(response.data);
            }

            reject(new Error("Invalid response."));
          });
          req.addListener("statusError", reject);
          req.send();
        });
        let suffix = ".eventrecorder";

        if (!answer.show_all) {
          suffix = "." + this._getApplicationName() + suffix;
        }

        let options = gist_data.filter(entry => entry.description && Object.values(entry.files).some(file => file.filename.endsWith(suffix))).map(entry => ({
          label: entry.description,
          value: entry.id
        }));

        if (options.length === 0) {
          qxl.dialog.Dialog.error("No matching gists were found.");
          return;
        }

        formData = {
          id: {
            type: "SelectBox",
            label: "Script",
            options
          }
        };
        answer = await qxl.dialog.Dialog.form("Please select from the following scripts:", formData).promise();

        if (!answer || !answer.id) {
          return;
        }

        this.setScript((await this.getRawGist(answer.id)));
      },

      /**
       * Loads a gist by its id.
       * @return {Promise<void>}
       */
      async loadGistById() {
        let answer = await qxl.dialog.Dialog.prompt("Please enter the id of the gist to replay");

        if (!answer || !answer.id) {
          return;
        }

        this.setScript((await this.getRawGist(answer.id)));
        this.setGistId(answer.id);
      }

    },

    /**
     * Will be called after class has been loaded, before application startup
     */
    defer: function defer() {
      let qookeryExternalLibsUrl = qx.util.ResourceManager.getInstance().toUri("cboulanger/eventrecorder/js");
      qookery.Qookery.setOption(qookery.Qookery.OPTION_EXTERNAL_LIBRARIES, qookeryExternalLibsUrl); // called when application is ready

      qx.bom.Lifecycle.onReady(async function onReady() {
        let infoPane = cboulanger.eventrecorder.InfoPane.getInstance();
        infoPane.useIcon("waiting");
        infoPane.display("Initializing Event Recorder, please wait...");
        let dispayedText = infoPane.getDisplayedText(); // assign object ids if object id generator has been included

        if (qx.Class.isDefined("cboulanger.eventrecorder.ObjectIdGenerator")) {
          await new Promise(resolve => {
            const objIdGen = qx.Class.getByName("cboulanger.eventrecorder.ObjectIdGenerator").getInstance();
            objIdGen.addListenerOnce("done", resolve);
          });
        } // hide splash screen if it hasn't used by other code yet


        if (infoPane.getDisplayedText() === dispayedText) {
          infoPane.hide();
        } // create controller


        let controller = new cboulanger.eventrecorder.UiController();
        qx.core.Init.getApplication().getRoot().add(controller, {
          top: 0,
          right: 10
        });
        controller.show();
      });
    }
  });
  cboulanger.eventrecorder.UiController.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.ui.core.Widget": {
        "construct": true,
        "require": true
      },
      "qx.event.Timer": {
        "construct": true
      },
      "qx.html.Element": {}
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
  qx.Class.define("qookery.ace.internal.AceWidget", {
    extend: qx.ui.core.Widget,
    construct: function construct(component) {
      qx.ui.core.Widget.constructor.call(this);
      this.__component = component;
      this.addListener("resize", function () {
        qx.event.Timer.once(function () {
          if (this.isDisposed()) return;

          var editor = this.__component.getEditor();

          if (editor == null) return;
          editor.resize();
        }, this, 0);
      }, this);
    },
    members: {
      __component: null,
      _createContentElement: function _createContentElement() {
        // Create a selectable and overflow disabled <div>
        var element = new qx.html.Element("div", {
          overflowX: "hidden",
          overflowY: "hidden"
        });
        element.setSelectable(true);
        return element;
      }
    }
  });
  qookery.ace.internal.AceWidget.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.bom.Element": {
        "require": true
      },
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.core.Object": {
        "construct": true,
        "require": true
      },
      "cboulanger.eventrecorder.MHelperMethods": {
        "require": true
      },
      "cboulanger.eventrecorder.MState": {
        "require": true
      },
      "qx.core.Id": {
        "construct": true
      },
      "qx.lang.Type": {},
      "qx.core.Assert": {},
      "qx.ui.form.DateField": {},
      "qx.ui.form.ComboBox": {},
      "qx.ui.form.VirtualComboBox": {},
      "qx.ui.tree.core.FolderOpenButton": {},
      "qx.ui.core.FocusHandler": {},
      "qx.data.Array": {},
      "qx.ui.tree.VirtualTree": {},
      "qx.ui.treevirtual.TreeVirtual": {},
      "qx.ui.virtual.selection.Row": {},
      "qx.ui.table.selection.Model": {},
      "qx.lang.String": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
    UI Event Recorder
  
    Copyright:
      2018 Christian Boulanger
  
    License:
      MIT license
      See the LICENSE file in the project's top-level directory for details.
  
    Authors: Christian Boulanger
  
  ************************************************************************ */

  /**
   * The base class of all recorder types
   * @require(qx.bom.Element)
   */
  qx.Class.define("cboulanger.eventrecorder.recorder.Recorder", {
    extend: qx.core.Object,
    include: [cboulanger.eventrecorder.MHelperMethods, cboulanger.eventrecorder.MState],

    /**
     * Constructor
     */
    construct: function construct() {
      qx.core.Object.constructor.call(this);
      this.__excludeIds = [];
      this.__lines = [];
      this.addGlobalEventListener((target, event) => {
        if (!this.isRunning()) {
          return;
        }

        let id;

        if (typeof target.getAttribute == "function") {
          id = target.getAttribute("data-qx-object-id");
        } else if (target instanceof qx.core.Object) {
          id = qx.core.Id.getAbsoluteIdOf(target, true);
        } else {
          return;
        }

        if (id) {
          this.recordEvent(id, event, target);
        }
      });
    },
    properties: {
      /**
       * The recorder mode, can be "overwrite" or "append"
       */
      mode: {
        check: ["overwrite", "append"],
        nullable: false,
        init: "overwrite"
      },

      /**
       * Whether to output additional event data to the console
       */
      logEvents: {
        check: "Boolean",
        nullable: false,
        init: false
      }
    },

    /**
     * The methods and simple properties of this class
     */
    members: {
      __lines: null,
      __excludeIds: null,
      __lastEventTimestamp: null,
      __latInput: null,

      /**
       * Exclude the given id(s) from recording
       * @param ids {Array|String}
       */
      excludeIds(ids) {
        // normalize to array
        ids = qx.lang.Type.isArray(ids) ? ids : [ids]; // add ids that are not yet included by path

        for (let id of ids) {
          let found = false;

          for (let excluded of this.__excludeIds) {
            if (id.substr(0, excluded.length) === excluded) {
              found = true;
            }
          }

          if (!found) {
            this.debug("Excluding ".concat(id, " from event recording."));

            this.__excludeIds.push(id);
          }
        }
      },

      /**
       * Returns the list of excluded ids.
       * @return {String[]}
       */
      getExcludedIds() {
        return this.__excludeIds;
      },

      /**
       * Return an array of object ids that have been assigned in the current application
       * @return {[]}
       */
      getObjectIds() {
        let ids = [];

        let traverseObjectTree = function traverseObjectTree(obj) {
          if (typeof obj.getQxObjectId !== "function") {
            return;
          }

          let id = obj.getQxObjectId();

          if (id) {
            try {
              ids.push(qx.core.Id.getAbsoluteIdOf(obj));
            } catch (e) {
              this.error("Cannot get absolute ID for object with id ".concat(id, "."));
            }
          }

          for (let owned of obj.getOwnedQxObjects()) {
            traverseObjectTree(owned);
          }
        };

        try {
          let registeredObjects = qx.core.Id.getInstance().getRegisteredObjects() || {};

          for (let obj of Object.values(registeredObjects)) {
            traverseObjectTree(obj);
          }

          return ids;
        } catch (e) {
          this.error(e.message);
          return [];
        }
      },

      /**
       * Returns the recorded script
       * @return {String}
       */
      getScript() {
        return this.__lines.join("\n");
      },

      /**
       * Sets the script to which the recorder should append new events
       * @param script {String}
       */
      setScript(script) {
        if (script) {
          qx.core.Assert.assertString(script);
          this.__lines = script.split(/\n/);
        } else {
          this.__lines = [];
        }
      },

      /**
       * Called by start()
       */
      beforeStart() {
        switch (this.getMode()) {
          case "overwrite":
            this.__lines = ["config-set-mode presentation", "assert-match-uri ".concat(document.location.host + document.location.pathname), ""];
            break;

          case "append":
            this.__lines = this.__lines.concat(["", "# appended at ".concat(new Date().toLocaleString()), ""]);
            break;
        }

        this.__lastEventTimestamp = 0;
      },

      /**
       * Called by the global event listener
       * @param id {String}
       * @param event {qx.event.type.Event}
       * @param target {qx.bom.Element}
       * @private
       * @return {boolean} returns true if the event was recorded, false if
       * it was ignored because of the list of excluded ids or an opt-out.
       */
      recordEvent(id, event, target) {
        for (let excluded of this.__excludeIds) {
          if (id.substr(0, excluded.length) === excluded) {
            return false;
          }
        } // opt out of recording


        if (typeof target.getTrackEvents === "function" && !target.getTrackEvents()) {
          return false;
        }

        let delay = this._createDelay();

        let lines = this._eventToCode(id, event, target);

        if (lines.length) {
          this.__lines = this.__lines.concat(delay).concat(lines);
        }

        return true;
      },

      /**
       * Executed after stop()
       */
      afterStop() {
        this.__lastEventTimestamp = 0;
      },

      /**
       * Given an object id, the event name and the even target, return one or more
       * pieces of intermediate code from which a player can replay the user action
       * that lead to this event. Return an array, each element is one line of code.
       * This method can be overridden by subclasses. The overriding method should
       * check the event, and if it decide to not handle it, return the result from the
       * call to this method.
       * @param id {String} The id of the qooxdoo object
       * @param event {qx.event.Event} The event that was fired
       * @param target {qx.bom.Element|qx.core.Object} The event target
       * @return {String[]} An array of script lines
       */
      _eventToCode(id, event, target) {
        let lines = [];
        const type = event.getType();
        let data = typeof event.getData == "function" ? event.getData() : null;
        let owner = typeof target.getQxOwner == "function" ? target.getQxOwner() : null;

        if (this.getLogEvents()) {
          this.debug(JSON.stringify({
            id,
            owner: owner && owner.toString(),
            type: type,
            data: data,
            target: target.toString()
          }));
        }

        switch (type) {
          case "dbltap":
            return ["dbltap ".concat(id)];

          case "contextmenu":
            lines.push("assert-appeared ".concat(id));
            lines.push("contextmenu ".concat(id));
            return lines;

          case "tap":
            return ["tap ".concat(id)];

          case "execute":
            switch (true) {
              case owner instanceof qx.ui.form.DateField:
              case owner instanceof qx.ui.form.ComboBox:
              case owner instanceof qx.ui.form.VirtualComboBox:
              case target instanceof qx.ui.tree.core.FolderOpenButton:
                return [];
            }

            lines.push("assert-appeared ".concat(id));
            lines.push("execute ".concat(id));
            break;

          case "appear":
          case "disappear":
            if (qx.ui.core.FocusHandler.getInstance().isFocusRoot(qx.core.Id.getQxObject(id))) {
              return ["assert-".concat(type, "ed ").concat(id)];
            }

            return [];

          case "input":
            this.__lastInput = data;
            return [];

          case "change":
            {
              // model selection
              const isModelSelection = target instanceof qx.data.Array && target.getQxOwner() && typeof target.getQxOwner().getModel == "function";

              if (isModelSelection) {
                const owner = target.getQxOwner();
                const ownerId = qx.core.Id.getAbsoluteIdOf(owner);
                const model = owner.getModel();
                const indexes = target.toArray().map(item => model.indexOf(item));
                lines.push("set-model-selection ".concat(ownerId, " ").concat(JSON.stringify(indexes)));
                break;
              } // form fields


              if (qx.lang.Type.isString(data) && data === this.__lastInput) {
                lines.push("set-value ".concat(id, " \"").concat(data, "\""));
              }

              break;
            }

          case "open":
          case "close":
            {
              if (target instanceof qx.ui.tree.VirtualTree) {
                let row = target.getLookupTable().indexOf(data);

                if (row < 0) {
                  return [];
                }

                lines.push("".concat(type, "-tree-node ").concat(id, " ").concat(row));
              }

              break;
            }
          // qx.ui.treevirtual.TreeVirtual

          case "treeClose":
          case "treeOpenWithContent":
          case "treeOpenWhileEmpty":
            lines.push("".concat(type === "treeClose" ? "close-tree-node-treevirtual" : "open-tree-node-treevirtual", " ").concat(id, " ").concat(data.nodeId));
            break;

          case "changeSelection":
            {
              if (target instanceof qx.ui.treevirtual.TreeVirtual) {
                let selection = event.getData();

                if (!selection.length) {
                  return [];
                }

                let row = target.getDataModel().getRowFromNodeId(selection[0].nodeId);
                lines.push("set-table-selection ".concat(id, " ").concat(row, ",").concat(row));
              }

              if (target instanceof qx.ui.virtual.selection.Row) {
                lines.push("set-row-selection ".concat(id, " ").concat(data));
                break;
              }

              if (target instanceof qx.ui.table.selection.Model) {
                lines.push("reset-selection ".concat(id));
                let ranges = target.getSelectedRanges();

                if (ranges.length) {
                  lines.push("set-table-selection ".concat(id, " ").concat(ranges[0].minIndex, ",").concat(ranges[0].maxIndex));
                }

                break;
              }

              if (data && data.length && qx.lang.Type.isArray(data)) {
                let selected = data[0];

                if (selected instanceof qx.core.Object && selected.getQxObjectId()) {
                  let selectedId = qx.core.Id.getAbsoluteIdOf(selected);
                  lines.push("set-selection ".concat(id, " ").concat(selectedId));
                } else if (typeof target.getSelectables == "function") {
                  let index = target.getSelectables().indexOf(selected);
                  lines.push("set-selection-from-selectables ".concat(id, " ").concat(index));
                }

                break;
              }

              return [];
            }

          default:
            // record change events if explicitly requested
            if (type.startsWith("change") && typeof target.getTrackPropertyChanges == "function") {
              if (target.getTrackPropertyChanges()) {
                let property = qx.lang.String.firstLow(type.substr(6));
                lines.push("await-match-json ".concat(id, " ").concat(property, " ").concat(JSON.stringify(data)));
                break;
              }
            } // ignore all others


            return [];
        }

        return lines;
      },

      /**
       * Returns an array, containing a "delay" command to replay delays in user action
       * @return {String[]}
       * @private
       */
      _createDelay() {
        let now = Date.now();
        let msSinceLastEvent = now - (this.__lastEventTimestamp || now);
        this.__lastEventTimestamp = now;

        if (msSinceLastEvent) {
          return ["delay ".concat(msSinceLastEvent)];
        }

        return [];
      }

    }
  });
  cboulanger.eventrecorder.recorder.Recorder.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Class": {
        "usage": "dynamic",
        "require": true
      },
      "qx.ui.form.SplitButton": {
        "require": true
      },
      "qx.ui.form.IBooleanForm": {
        "require": true
      },
      "qx.ui.form.IExecutable": {
        "require": true
      },
      "qx.ui.form.ToggleButton": {}
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);

  /* ************************************************************************
  
   Copyright:
     2019 Christian Boulanger
  
   License:
     MIT: https://opensource.org/licenses/MIT
     See the LICENSE file in the project's top-level directory for details.
  
   Authors:
     * Christian Boulanger
  
  ************************************************************************ */

  /**
   * A split button which also acts as a toggle button
   *
   * @childControl button {qx.ui.form.Button} button to execute action
   * @childControl arrow {qx.ui.form.MenuButton} arrow to open the popup
   */
  qx.Class.define("cboulanger.eventrecorder.SplitToggleButton", {
    extend: qx.ui.form.SplitButton,
    implement: [qx.ui.form.IBooleanForm, qx.ui.form.IExecutable],

    /*
    *****************************************************************************
       PROPERTIES
    *****************************************************************************
    */
    properties: {
      /** The value of the widget. True, if the widget is checked. */
      value: {
        check: "Boolean",
        nullable: true,
        event: "changeValue",
        init: false
      }
    },

    /*
    *****************************************************************************
       MEMBERS
    *****************************************************************************
    */
    members: {
      // overridden
      _createChildControlImpl: function _createChildControlImpl(id, hash) {
        var control;

        switch (id) {
          case "button":
            control = new qx.ui.form.ToggleButton();
            control.setFocusable(false);
            control.bind("value", this, "value");
            control.addListener("execute", this._onButtonExecute, this);
            this.bind("value", control, "value");

            this._addAt(control, 0, {
              flex: 1
            });

            break;
        }

        return control || cboulanger.eventrecorder.SplitToggleButton.prototype._createChildControlImpl.base.call(this, id);
      }
    }
  });
  cboulanger.eventrecorder.SplitToggleButton.$$dbClassInfo = $$dbClassInfo;
})();

//
(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Bootstrap": {
        "usage": "dynamic",
        "require": true
      },
      "qookery.Qookery": {
        "defer": "runtime"
      },
      "qookery.ace.internal.AceComponent": {
        "defer": "runtime"
      }
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
  qx.Bootstrap.define("qookery.ace.Bootstrap", {
    defer: function defer() {
      qookery.Qookery.getRegistry().registerLibrary("ace", ["${q:external-libraries}/ace/ace.js"]);
      qookery.Qookery.getRegistry().registerLibrary("aceLanguageTools", ["${q:external-libraries}/ace/ext-language_tools.js"]);
      qookery.Qookery.getRegistry().registerComponentType("{http://www.qookery.org/ns/Form/Ace}editor", qookery.ace.internal.AceComponent);
    }
  });
  qookery.ace.Bootstrap.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      }
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
   * Class wrapping Qooxdoo widgets as Qookery components
   */
  qx.Class.define("qookery.impl.WrapperComponent", {
    extend: qookery.internal.components.Component,
    construct: function construct(widgetClass, parentComponent) {
      qookery.internal.components.Component.constructor.call(this, parentComponent);
      this.__widgetClass = widgetClass;
    },
    members: {
      __widgetClass: null,
      _createWidgets: function _createWidgets() {
        var mainWidget = new this.__widgetClass(this);

        this._applyWidgetAttributes(mainWidget);

        return [mainWidget];
      }
    }
  });
  qookery.impl.WrapperComponent.$$dbClassInfo = $$dbClassInfo;
})();

//
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
      }
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
  qx.Class.define("qookery.internal.components.SectionComponent", {
    extend: qookery.internal.components.ContainerComponent,
    construct: function construct(parentComponent) {
      qookery.internal.components.ContainerComponent.constructor.call(this, parentComponent);
    }
  });
  qookery.internal.components.SectionComponent.$$dbClassInfo = $$dbClassInfo;
})();

//

//# sourceMappingURL=part-1.js.map
