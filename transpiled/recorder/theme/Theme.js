(function () {
  var $$dbClassInfo = {
    "dependsOn": {
      "qx.Theme": {
        "usage": "dynamic",
        "require": true
      },
      "recorder.theme.Color": {
        "require": true
      },
      "recorder.theme.Decoration": {
        "require": true
      },
      "recorder.theme.Font": {
        "require": true
      },
      "qx.theme.icon.Tango": {
        "require": true
      },
      "recorder.theme.Appearance": {
        "require": true
      }
    }
  };
  qx.Bootstrap.executePendingDefers($$dbClassInfo);qx.Theme.define("recorder.theme.Theme", {
    meta: {
      color: recorder.theme.Color,
      decoration: recorder.theme.Decoration,
      font: recorder.theme.Font,
      icon: qx.theme.icon.Tango,
      appearance: recorder.theme.Appearance
    }
  });
  recorder.theme.Theme.$$dbClassInfo = $$dbClassInfo;
})();

//# sourceMappingURL=Theme.js.map?dt=1544616852497