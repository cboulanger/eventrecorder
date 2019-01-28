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
       // ignore popups
       if (child instanceof qx.ui.popup.Popup) {
         continue;
       }
        // assign object id and add to parent if neccessary
        this.generateQxObjectId(child, parent);
        // recurse into children
        let realChild = child;
        let id;
        switch (child.classname) {
          case "qx.ui.form.ComboBox":
            realChild = child.getChildControl("textfield");
            break;
          case "qx.ui.form.VirtualSelectBox":
            realChild = child.getSelection();
            break;
          case "qx.ui.groupbox.GroupBox":
            realChild = child.getChildControl("frame");
            break;
          case "qx.ui.form.MenuButton":
          case "qx.ui.toolbar.MenuButton":
          case "qx.ui.menubar.Button":
            realChild = child.getMenu();
            break;
          case "qx.ui.treevirtual.TreeVirtual":
            child.addListener("treeClose", () => {});
            child.addListener("treeOpenWithContent", () => {});
            child.addListener("treeOpenWhileEmpty", () => {});
            // fallthrough
          case "qx.ui.table.Table":
            realChild = child.getSelectionModel();
            id = "Selection";
            break;
          case "qx.ui.list.List":
            realChild = child.getSelection();
            id = "Selection";
            break;
          case "qx.ui.tabview.Page":
            this.generateQxObjectId(child.getChildControl("button"), child);
            break;
          case "qx.ui.tree.VirtualTree":
            child.addListener("open", () => {});
            child.addListener("close", () => {});
            this.generateQxObjectId(child._manager, child);
            continue;
        }
        if (realChild !== child) {
          this.generateQxObjectId(realChild, child, id);
        }
        this.assignObjectIdsToChildren(realChild, level+1);
      }
    }
  },

  /**
  * Will be called after class has been loaded, before application startup
  */
  defer: function() {
    qx.bom.Lifecycle.onReady(() => cboulanger.eventrecorder.ObjectIdGenerator.getInstance().init());
  }
});
