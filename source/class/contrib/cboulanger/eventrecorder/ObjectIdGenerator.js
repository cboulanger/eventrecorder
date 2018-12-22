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
qx.Class.define("contrib.cboulanger.eventrecorder.ObjectIdGenerator",
{
  type: "singleton",
  extend: qx.core.Object,
  include : [contrib.cboulanger.eventrecorder.MHelperMethods],
  members: {

    /**
     * Start automatically assigning ids.
     */
    init: function(){
      // start generating ids with a delay because rendering widgets is asynchrous
      qx.event.Timer.once( ()=> this.assignObjectIdsToChildren(qx.core.Init.getApplication().getRoot()), null, 2000);
      // todo: we need a way of generating ids for widgets that get added to the layout dynamically
    },

    /**
     * Given a {@link qx.core.Object}, return a unique id for it
     * @param qxObj {qx.core.Object}
     * @return {String}
     */
    generateId: function(qxObj) {
      let hash = qxObj.toHashCode();
      let clazz = qxObj.classname;
      return clazz.substr(clazz.lastIndexOf('.')+1) + hash.substring(0,hash.indexOf('-'));
    },

    /**
     * Given an object and its parent, set its object id and add it to the
     * parent's owned objects. If the object doesn't have a parent or the
     * parent has no object id, register the object as a global id root.
     * @param obj
     * @param parent
     */
    setObjectId: function(obj, parent){
      if (!obj.getQxObjectId()) {
        let id=this.generateId(obj);
        obj.setQxObjectId(id);
        if (parent && parent.getQxObjectId()) {
          // if the parent has an id, we add the child as an owned object
          //console.log(`Adding ${obj} to ${parent} with id '${id}'`);
          parent.addOwnedObject(obj);
        } else {
          // otherwise, we register it as a top-level object
          //console.log(`Registering ${obj} as global id root with id '${id}'`);
          qx.core.Id.getInstance().register(obj, id);
        }
      }
    },

    /**
     * Recursively assigns object ids to the children of the given parent widget.
     * @param parent {qx.ui.core.Widget|qx.ui.core.MChildrenHandling} An object that must include
     * the qx.ui.core.MChildrenHandling mixin.
     */
    assignObjectIdsToChildren: function(parent, level=0)
    {
      //console.log("    ".repeat(level) + parent.classname);
      for (let child of parent.getChildren()){
        // assign object id and add to parent if neccessary
        this.setObjectId(child, parent);
        // recurse into children
        if (typeof child.getChildren === "function") {
          this.assignObjectIdsToChildren(child, level+1);
        }
      }
    }
  },

  /**
  * Will be called after class has been loaded, before application startup
  */
  defer: function(){
    qx.bom.Lifecycle.onReady(() => contrib.cboulanger.eventrecorder.ObjectIdGenerator.getInstance().init());
  }
});