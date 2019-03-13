//import {IdSelector, QxSelector} from "../npm/adapters/TestCafe";

fixture `Testing demo`
  .page `http://127.0.0.1:8080/build/eventrecorder/index.html`;

test('Test the eventrecorder presentation', async t => {
  await t.wait(10000);
  await t.eval(()=>{qx.core.Id.getQxObject("eventrecorder/record").fireEvent("execute");});
  await t.wait(1000);
  await t.eval(()=>{qx.core.Id.getQxObject("button1").fireEvent("execute");});
  await t.wait(500);
  await t.eval(()=>qx.core.Assert.assertTrue(qx.core.Id.getQxObject("button1/window").isVisible(),"Failed: Object with id button1/window is not visible."));
  await t.eval(()=>{qx.core.Id.getQxObject("button1/window/button2").fireEvent("execute");});
  await t.wait(500);
  await t.eval(()=>qx.core.Assert.assertFalse(qx.core.Id.getQxObject("button1/window").isVisible(),"Failed: Object with id button1/window is visible."));
  await t.eval(()=>{qx.core.Id.getQxObject("eventrecorder/stop").fireEvent("execute");});
  await t.eval(()=>{qx.core.Id.getQxObject("eventrecorder/edit").fireEvent("execute");});
  await t.wait(500);
  await t.eval(()=>qx.core.Assert.assertTrue(qx.core.Id.getQxObject("eventrecorder/editor/window").isVisible(),"Failed: Object with id eventrecorder/editor/window is visible."));
  await t.eval(()=>{qx.core.Id.getQxObject("eventrecorder/editor/translateButton").fireEvent("execute");});
});
