# UI Event Recorder

This contrib allows to record user interaction for replay during tests. 
Currently, this is a very simple proof-of-concept which relies on a patched 
version of the qooxdoo library and generates scripts for the the web testing 
framework [TestCafé](https://devexpress.github.io/testcafe/documentation/test-api/). 

Minimal example:
````javascript
  var button1 = new qx.ui.form.Button("Click me", "recorder/test.png");
  var doc = this.getRoot();
  doc.add(button1, {left: 100, top: 50});

  let win = new qx.ui.window.Window("New window");
  win.set({
    width: 200,
    height: 50,
    showMinimize: false,
    showMaximize: false,
  });
  doc.add(win);

  win.addListener("appear", ()=>{
    win.center();
  });
  button1.addListener("execute", ()=>{
    win.show();
  });

  // id registration
  qx.core.Id.getInstance().register(button1,"button");
  button1.setObjectId("button");
  button1.addOwnedObject(win,"window");

  // recorder
  let controller = new recorder.UiController(new recorder.type.TestCafe());
  doc.add(controller, {right:0});
  controller.show();
````

1. In the window that appears in the top right corner, click on "Start".
2. Click on the "Click me" button.
3. Click on "Stop"
4. A snippet of TestCafé code should appear in the text box. 