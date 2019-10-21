define(function(require, exports, module) {
  "use strict";

  var oop = require("../lib/oop");

  // defines the parent mode
  var TextMode = require("./text").Mode;
  var Tokenizer = require("../tokenizer").Tokenizer;
  var MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
  var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

  var EventrecorderHighlightRules = function() {

    // regexp must not have capturing parentheses. Use (?:) instead.
    // regexps are ordered -> the first match is used
    this.$rules = {
      "start" : [
        {
          token: "", // String, Array, or Function: the CSS token to apply
          regex: regex, // String or RegExp: the regexp to match
          next:  next   // [Optional] String: next state to enter
        }
      ]
    };
  };

  oop.inherits(EventrecorderHighlightRules, TextHighlightRules);

  var Mode = function() {
    // set everything up
    this.HighlightRules = EventrecorderHighlightRules;
    this.$outdent = new MatchingBraceOutdent();
    this.foldingRules = new MyNewFoldMode();
  };
  oop.inherits(Mode, TextMode);

  (function() {
    // configure comment start/end characters
    this.lineCommentStart = "//";
    this.blockComment = {start: "/*", end: "*/"};

    // special logic for indent/outdent.
    // By default ace keeps indentation of previous line
    this.getNextLineIndent = function(state, line, tab) {
      var indent = this.$getIndent(line);
      return indent;
    };

    this.checkOutdent = function(state, line, input) {
      return this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, doc, row) {
      this.$outdent.autoOutdent(doc, row);
    };

    // create worker for live syntax checking
    this.createWorker = function(session) {
      var worker = new WorkerClient(["ace"], "ace/mode/mynew_worker", "NewWorker");
      worker.attachToDocument(session.getDocument());
      worker.on("errors", function(e) {
        session.setAnnotations(e.data);
      });
      return worker;
    };

  }).call(Mode.prototype);

  exports.Mode = Mode;
});
