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
  include : [cboulanger.eventrecorder.MHelperMethods],
  statics: {
    DEFAULT_LISTENED_EVENTS: [
      "tap", "dbltap", "contextmenu"
    ]
  },
  events: {
    "done" : "qx.event.type.Event"
  },
  members: {

    /**
     * Start automatically assigning ids.
     */
    init: function() {
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
    generateId: function(qxObj) {
      let clazz = qxObj.classname;
      return clazz.substr(clazz.lastIndexOf(".")+1);
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
    generateQxObjectId: function(obj, owner, id) {
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
            siblingWithSameName=false;
            // console.log(`Adding ${obj} to ${parent} with id '${id}'`);
          } catch (e) {
            // name already exists, append a number
            siblingWithSameName = true;
            postfix++;
            obj.setQxObjectId(id+postfix);
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
    assignObjectIdsToChildren: function(parent, level=0) {
      if (!parent) {
        return;
      }
      let children =
        typeof parent.getChildren == "function" ?
          parent.getChildren() :
          typeof parent.getLayoutChildren == "function" ?
            parent.getLayoutChildren() : null;
      // let msg = "    ".repeat(level) + parent.classname;
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
       }
        // assign object id and add to parent if neccessary
        this.generateQxObjectId(child, parent);
        // handle special cases
        let otherChildRoots = [];
        let id;
        let obj = child;
        // traverse prototype chain to catch extended types
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
                obj = Object.getPrototypeOf(obj);
                // continue while loop
                continue;
              }
          }
          // break out of while loop
          break;
        }

        // add an empty event listener for the defined default events so
        // that they will be recorded
        for (let evt_name of this.self(arguments).DEFAULT_LISTENED_EVENTS) {
          if (qx.event.Registration.getManager(child).findHandler(child, evt_name) && !child.hasListener(evt_name)) {
            child.addListener(evt_name, () => {});
          }
        }

        // recurse into other child roots outside the layout hierarchy
        // that fire events relevant to the recorder
        if (otherChildRoots.length) {
          otherChildRoots.forEach(childRoot => {
            this.generateQxObjectId(childRoot, child, id);
            this.assignObjectIdsToChildren(childRoot, level+1);
          });
        }
        // recurse into layout children
        this.assignObjectIdsToChildren(child, level+1);
      }
    }
  },

  /**
   * Will be called after class has been loaded, before application startup
   */
  defer: function() {
    if (qx.core.Environment.get("module.objectid")) {
      qx.bom.Lifecycle.onReady(() => cboulanger.eventrecorder.ObjectIdGenerator.getInstance().init());
    }
  }
});
