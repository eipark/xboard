$(document).ready(function(){
  WbUi.init($("canvas"));

  // Init color picker and set handler here since can only set
  // click listener after it is init
  $("#color_picker").colorPicker({pickerDefault: "000000"});
  $(".colorPicker-swatch").click(function(){
    Wb.setStrokeStyle($(this).css("background-color"));
  });
});

(function() {

/* converts ms to MM:SS:ss format */
function readableTime(ms) {
  var x = ms / 1000;
  var seconds = Math.floor(x % 60);
  x /= 60;
  var minutes = Math.floor(x % 60);
  seconds = seconds >= 10 ? seconds : "0" + seconds;
  minutes = minutes >= 10 ? minutes : "0" + minutes;
  return minutes + ":" + seconds;
}

window.WbUi = {

  canvasElement: null, // jQuery element for canvas

  wasPlaying: false, // cues whether to continue playback when slider stops
  /**
   * The default ids and classes for the element
   * configurations are the index names used in this
   * array.
   * 
   * If names or classes have different names, they
   * should be defined in the script initialization,
   * that is WbUi.init() function.
   *
   * The purpose of this list is only to show what
   * element definitions this scripts uses.
   */
  elementConf: {
    // Classes
    pencil_active:    null,
    eraser_active:    null,

    // Element ids
    button_pencil:    null,
    button_color:   null,
    button_eraser:    null,
    button_animate:   null,
    button_undo:    null,
    input_color:    null,
    button_record: null,
    play_pause: null,
  },

  /**
   * Initializes the Wb UI script.
   *
   * @param canvasElement The canvas jQuery element.
   * @param elemconf The element configuration array.
   * This array can contain any of the elements defined
   * in WbUi.elemConf. If the element names differ
   * from the default array indexes, they should be given
   * in this array. Only the differing elements should be
   * defined.
   */
  init: function(canvasElement, elemconf) {
    this.canvasElement = canvasElement;
    $("#xboard-container #slider").slider({});
    Wb.init(canvasElement.attr("id"));
    if (elemconf !== undefined) {
      for (var i in this.elementConf) {
        if (elemconf.i !== undefined) {
          this.elementConf.i = elemconf.i;
        }
      }
    }
    this.addListeners();
  },

  /**
   * Resolves the element name from WbUi.elemConf.
   * If index defined by ind parameter can be found in that
   * array and the array's value is returned. Otherwise
   * the ind parameter itself is returned.
   *
   * @param ind The element's index name in WbUi.elemConf
   * @return The elements correct name
   */
  getElementName: function(ind) {
    if (WbUi.elementConf[ind] === undefined ||
        WbUi.elementConf[ind] === null) {
      return ind;
    }
    return WbUi.elementConf[ind];
  },

  /**
   * Resolves the jQuery element with the defined id which
   * is resolved by WbUi.getElementName function.
   *
   * @param ind The element's index name in WbUi.elemConf
   * or the wanted id name that's not included in that array.
   * @return The jQuery element with the resolved id
   */
  getElement: function(ind) {
    return $('#' + WbUi.getElementName(ind));
  },

  /**
   * Adds all the UI's needed action listeners for buttons
   * and other UI elements.
   */
  addListeners: function() {
    WbUi.getElement('button_pencil').mousedown(function() {
      WbUi.activatePencil();
    });
    WbUi.getElement('button_eraser').mousedown(WbUi.activateEraser);
    WbUi.getElement('button_animate').mousedown(Wb.animate);
    WbUi.getElement('recorder').mousedown(WbUi.recordToggle);
    WbUi.getElement('button_undo').mousedown(Wb.undo);
    WbUi.getElement('play_pause').mousedown(WbUi.playPauseToggle);

    //remove onmousedown from html and make this work

    $("#xboard-container #slider").slider({
      start: function(event, ui) {
        if (Wb.isPlaying) {
          WbUi.wasPlaying = Wb.isPlaying;
          Wb.pause();
        }
      }
    });

    $("#xboard-container #slider").slider({
      slide: function(event, ui) {
        // could add tooltips on slide for time updates
      }
    });

    $("#xboard-container #slider").slider({
      stop: function(event, ui) {
        Wb.jump(ui.value);
        if (WbUi.wasPlaying) {
          Wb.play();
          WbUi.wasPlaying = false;
        }
      }
    });

  },

  // toggles a class and calls a function for both cases when the class
  // is there and not there. Small wrapper, for record and play button.
  toggler: function(elt, toggle_class, truth_func, false_func) {
    if (elt.hasClass(toggle_class)){
      elt.removeClass(toggle_class);
      truth_func();
    } else {
      elt.addClass(toggle_class);
      false_func();
    }
  },

  playPauseToggle: function() {
    WbUi.toggler($("#play_pause"), "is_playing", WbUi.pause, WbUi.play);
  },

  recordToggle: function() {
    WbUi.toggler($("#recorder"), "is_recording", WbUi.pauseRecord, WbUi.record);
  },

  // Changes recording button and disables buttons not appropriate
  // for recording state.
  record: function(elt) {
    $("#slider").slider("disable");
    $("button#play_pause").attr("disabled", true);
    $("#recorder").html("Pause");
    Wb.record();
  },

  pauseRecord: function() {
    $("button#play_pause").attr("disabled", false);
    $("#slider").slider("enable");
    $("#recorder").html("Record");
    Wb.pauseRecord();
  },

  play: function() {
    console.log("---WbUi.play()");
    $("#recorder").attr("disabled", true);
    Wb.play();
  },

  pause: function() {
    console.log("---WbUi.pause()");
    $("#recorder").attr("disabled", false);
    Wb.pause();
  },

  /**
   * Resolves the X coordinate of the given event inside
   * the canvas element.
   *
   * @param event The event that has been executed.
   * @return The x coordinate of the event inside the
   * canvas element.
   */
  getX: function(event) {
    var cssx = (event.clientX - this.canvasElement.offset().left);
      var xrel = Wb.getRelative().width;
      var canvasx = cssx * xrel;
      return canvasx;
  },

  /**
   * Resolves the Y coordinate of the given event inside
   * the canvas element.
   *
   * @param event The event that has been executed.
   * @return The y coordinate of the event inside the
   * canvas element.
   */
  getY: function(event) {
      var cssy = (event.clientY - this.canvasElement.offset().top);
      var yrel = Wb.getRelative().height;
      var canvasy = cssy * yrel;
      return canvasy;
  },

  /**
   * Returns the canvas element to its default definition
   * without any extra classes defined by any of the selected
   * UI tools.
   */
  changeTool: function() {
    WbUi.canvasElement.unbind();
    WbUi.canvasElement.removeClass(WbUi.getElementName('pencil_active'));
    WbUi.canvasElement.removeClass(WbUi.getElementName('eraser_active'));
  },

  /**
   * Activates pencil tool and adds pencil_active class
   * to canvas element.
   *
   * @param event The event that has been executed to perform
   * this action
   */
  activatePencil: function(event) {
    WbUi.changeTool();
    WbUi.canvasElement.bind("mousedown", WbUi.beginPencilDraw);
    WbUi.canvasElement.addClass(WbUi.getElementName('pencil_active'));
  },

  /**
   * Begins the pencil draw after user action that is usually
   * mouse down. This should be executed on mousedown event
   * after activating the pen tool.
   *
   * @param event The event that has been executed to perform
   * this action
   */
  beginPencilDraw: function(event) {
      Wb.canvasFunction("beginPencilDraw", WbUi.getX(event), WbUi.getY(event));
      WbUi.canvasElement.bind("mousemove", function(event) {
          Wb.canvasFunction("pencilDraw", WbUi.getX(event), WbUi.getY(event));
      });
      WbUi.canvasElement.bind("mouseup", WbUi.endPencilDraw);
      WbUi.canvasElement.bind("mouseout", WbUi.endPencilDraw);
  },

  /**
   * Ends pencil draw which means that mouse moving won't
   * be registered as drawing action anymore. This should be
   * executed on mouseup after user has started drawing.
   *
   * @param event The event that has been executed to perform
   * this action
   */
  endPencilDraw: function (event) {
    Wb.canvasFunction("endPencilDraw");
    WbUi.canvasElement.unbind("mousemove");
    WbUi.canvasElement.unbind("mouseup");
    WbUi.canvasElement.unbind("mouseout");
  },

  /**
   * Activates erasing tool and adds eraser_active class
   * to canvas element.
   *
   * @param event The event that has been executed to perform
   * this action
   */
  activateEraser: function(event) {
    WbUi.changeTool();
    WbUi.canvasElement.bind("mousedown", WbUi.beginErasing);
    WbUi.canvasElement.addClass(WbUi.getElementName('eraser_active'));
  },

  /**
   * Begins the erasing action after user action that is usually
   * mouse down. This should be executed on mousedown event
   * after activating the erasing tool.
   *
   * @param event The event that has been executed to perform
   * this action
   */
  beginErasing: function(event) {
      Wb.canvasFunction("beginErasing", WbUi.getX(event), WbUi.getY(event));
      WbUi.canvasElement.bind("mousemove", function(event) {
          Wb.canvasFunction("erasePoint", WbUi.getX(event), WbUi.getY(event));
      });
      WbUi.canvasElement.bind("mouseup", WbUi.endErasing);
      WbUi.canvasElement.bind("mouseout", WbUi.endErasing);
  },

  /**
   * Ends erasing which means that mouse moving won't
   * be registered as erasing action anymore. This should be
   * executed on mouseup after user has started erasing.
   * 
   * @param event The event that has been executed to perform
   * this action
   */
  endErasing: function(event) {
    WbUi.canvasElement.unbind("mousemove");
    WbUi.canvasElement.unbind("mouseup");
    WbUi.canvasElement.unbind("mouseout");
  },

  /* sets the clock time  */
  setClock: function(time){
    // if time is passed in, we use it, otherwise we just set it to
    // the current recording time because it means we are recording
    // and the total time is increasing
    if (typeof time === "undefined"){ // implies we are recording, so we update the max
      time = Wb.getRecordingTime();
      $("#xboard-container #slider").slider("option", "max", time);
    } else if (time > Wb.getRecordingTime()) {
      // since this time is set by an incrementer, the last one will exceed
      // our recording time so we set it back down and stop the timeout
      // since we've reached the end of playback
      time = Wb.getRecordingTime();
    }
    // set clocks in UI, elapsed/total
    $("#elapsed_timer").html(readableTime(time));
    // want Wb.getRecordingTime() since on playback recordingtime stays same
    $("#total_timer").html(readableTime(Wb.getRecordingTime()));

    // set slider position
    $("#xboard-container #slider").slider("option", "value", time);
  },

  /* Wrapper for setClock that allows an interval to be set
     using setTimeout instead of setInterval. Prevents "blocking" */
  setClockInterval: function() {
    WbUi.setClock();
    Wb.recordClockInterval = setTimeout(WbUi.setClockInterval, Wb.sampleRate);
  },

};
})();
