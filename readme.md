# UI Event Recorder

> NOTE: this is a very simple proof-of-concept which doesn't do very much at the moment.
  
This contrib allows to record user interaction for replay during tests. It consists
of a qooxdoo contrib that records user and UI events (clicks, appearances, etc.) 
and which can be included in a qooxdoo application, and an NPM package (TBD) that
acts as a backend to replay these events during automated tests. 

It currently supports:
 - [qooxdoo unit tests](https://www.qooxdoo.org/current/pages/development/unit_testing.html)
 - [TestCafé](https://devexpress.github.io/testcafe/documentation/test-api/) 

## Example

Minimal example:
```javascript
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
  button1.setQxObjectId("button");
  button1.addOwnedQxObject(win,"window");

  // recorder
  const controller = new cboulanger.eventrecorder.UiController();
  doc.add(controller, {right:0});
  controller.show();
```

## Demos

- [Simple event recorder demo](https://cboulanger.github.io/cboulanger.eventrecorder/): See below for how to 
  use the demo.
- [Widget Browser with event recorder](https://cboulanger.github.io/cboulanger.eventrecorder/widgetbrowser_recorder): 
  This demo shows how the event recorder is added to an existing application without changing its source code. 
- [Widget Browser with object id tooltip](https://cboulanger.github.io/cboulanger.eventrecorder/widgetbrowser_recorder):
  This demo displays the object ids which are automatically assigned to the widgets by showing a tooltip when hovering
  over them.

Or locally:

```bash
npm install -g qxcompiler
git clone https://github.com/cboulanger/cboulanger.eventrecorder.git
cd recorder
qx serve
```

1. Open localhost:8080
1. Open the "Simple event recorder demo"
1. In the window that appears in the top right corner, click on "Start".
1. Click on the "Click me" button.
1. Click on "Stop"
1. A snippet of test code should appear in the text box. 

# Running tests

```
npx testcafe chrome,firefox tests/testcafe.js  --app-init-delay 10000
```
