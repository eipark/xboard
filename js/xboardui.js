/* xBoard - A Recordable HTML5 Canvas Based Virtual Whiteboard 
 *
 * by Ernie Park, May 2012
 * Under MIT License
 * http://github.com/eipark/xboard
 *
 */

$(document).ready(function(){
  XBUI.init($("canvas"));
});


(function() {

/* Converts ms to MM:SS:ss format */
function readableTime(ms) {
  var x = ms / 1000;
  var seconds = Math.floor(x % 60);
  x /= 60;
  var minutes = Math.floor(x % 60);
  seconds = seconds >= 10 ? seconds : "0" + seconds;
  minutes = minutes >= 10 ? minutes : "" + minutes;
  return minutes + ":" + seconds;
}

/* Returns value of parameter string "query" */
function url_query(query) {
  query = query.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var expr = "[\\?&]"+query+"=([^&#]*)";
  var regex = new RegExp( expr );
  var results = regex.exec( window.location.href );
  if( results !== null ) {
    return results[1];
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  } else {
    return false;
  }
}

window.XBUI = {

  canvasElement: null, // jQuery element for canvas

  wasPlaying: false, // cues whether to continue playback when slider stops
  /**
   * The default ids and classes for the element
   * configurations are the index names used in this
   * array.
   *
   * If names or classes have different names, they
   * should be defined in the script initialization,
   * that is XBUI.init() function.
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
   * Initializes the XB UI script.
   *
   * @param canvasElement The canvas jQuery element.
   * @param elemconf The element configuration array.
   * This array can contain any of the elements defined
   * in XBUI.elemConf. If the element names differ
   * from the default array indexes, they should be given
   * in this array. Only the differing elements should be
   * defined.
   */
  init: function(canvasElement, elemconf) {
    this.canvasElement = canvasElement;
    $("#xboard-container #slider").slider({});
    XB.init(canvasElement.attr("id"));
    if (elemconf !== undefined) {
      for (var i in this.elementConf) {
        if (elemconf.i !== undefined) {
          this.elementConf.i = elemconf.i;
        }
      }
    }
    this.addListeners();

    // Restore from an embed code if one is passed in
    var embed_code = url_query('embed');
    if (embed_code) {
      XB.restore(embed_code);
    }

    // If in an iframe embed, remove all recording elements.
    if (window != window.top) {
      $(".recording_elt").remove();
    }
  },

  /**
   * Resolves the element name from XBUI.elemConf.
   * If index defined by ind parameter can be found in that
   * array and the array's value is returned. Otherwise
   * the ind parameter itself is returned.
   *
   * @param ind The element's index name in XBUI.elemConf
   * @return The elements correct name
   */
  getElementName: function(ind) {
    if (XBUI.elementConf[ind] === undefined ||
        XBUI.elementConf[ind] === null) {
      return ind;
    }
    return XBUI.elementConf[ind];
  },

  /**
   * Resolves the jQuery element with the defined id which
   * is resolved by XBUI.getElementName function.
   *
   * @param ind The element's index name in XBUI.elemConf
   * or the wanted id name that's not included in that array.
   * @return The jQuery element with the resolved id
   */
  getElement: function(ind) {
    return $('#' + XBUI.getElementName(ind));
  },

  /**
   * Adds all the UI's needed action listeners for buttons
   * and other UI elements.
   */
  addListeners: function() {
    XBUI.getElement('button_pencil').mousedown(function() {
      XBUI.activatePencil();
    });
    XBUI.getElement('button_eraser').mousedown(XBUI.activateEraser);
    XBUI.getElement('button_animate').mousedown(XB.animate);
    XBUI.getElement('recorder').mouseup(XBUI.recordToggle);
    XBUI.getElement('play_pause').mouseup(XBUI.playPauseToggle);
    $("#button_clear").mouseup(XBUI.clear);


    /* XBUI.wasPlaying needed since we always want to be paused before
       jumping around. If wasPlaying, we call XB.play() after the slider
       stops */
    $("#xboard-container #slider").slider({
      start: function(event, ui) {
        if (XB.isPlaying) {
          XBUI.wasPlaying = XB.isPlaying;
          XB.pause();
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
        XB.jump(ui.value);
        if (XBUI.wasPlaying) {
          XB.play();
          XBUI.wasPlaying = false;
        }
      }
    });

    // Color Picker
    $("#color_picker").colorPicker({pickerDefault: "000000"});
    $(".colorPicker-swatch").click(function(){
      XB.setStrokeStyle($(this).css("background-color"));
    });

  },

  /* Toggles a class and calls a function for both cases when the class
     is there and not there. Small wrapper, for record and play button. */
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
    XBUI.toggler($("#play_pause"), "is_playing", XBUI.pause, XBUI.play);
  },

  recordToggle: function() {
    XBUI.toggler($("#recorder"), "is_recording", XBUI.pauseRecord, XBUI.record);
  },

  /* Changes recording button and disables buttons not appropriate
     for recording state. */
  record: function(elt) {
    $("#slider").slider("disable");
    $("#drawsection").addClass("is_recording");
    $("button#play_pause").attr("disabled", true);
    $("#recorder").attr("title", "Stop Recording");
    XB.record();
  },

  pauseRecord: function() {
    $("button#play_pause").attr("disabled", false);
    $("#slider").slider("enable");
    $("#drawsection").removeClass("is_recording");
    $("#recorder").attr("title", "Record");
    XB.pauseRecord();
  },

  play: function() {
    $("#recorder").attr("disabled", true);
    XB.play();
  },

  pause: function() {
    $("#recorder").attr("disabled", false);
    XB.pause();
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
      var xrel = XB.getRelative().width;
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
      var yrel = XB.getRelative().height;
      var canvasy = cssy * yrel;
      return canvasy;
  },

  /**
   * Returns the canvas element to its default definition
   * without any extra classes defined by any of the selected
   * UI tools.
   */
  changeTool: function() {
    XBUI.canvasElement.unbind();
    XBUI.canvasElement.removeClass(XBUI.getElementName('pencil_active'));
    XBUI.canvasElement.removeClass(XBUI.getElementName('eraser_active'));
    $("div#tools input").removeClass("active");
  },

  /**
   * Activates pencil tool and adds pencil_active class
   * to canvas element.
   *
   * @param event The event that has been executed to perform
   * this action
   */
  activatePencil: function(event) {
    XBUI.changeTool();
    XBUI.canvasElement.bind("mousedown", XBUI.beginPencilDraw);
    XBUI.canvasElement.addClass(XBUI.getElementName('pencil_active'));
    $("#button_pencil").addClass("active");
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
      XB.canvasFunction("beginPencilDraw", XBUI.getX(event), XBUI.getY(event));
      XBUI.canvasElement.bind("mousemove", function(event) {
          XB.canvasFunction("pencilDraw", XBUI.getX(event), XBUI.getY(event));
      });
      XBUI.canvasElement.bind("mouseup", XBUI.endPencilDraw);
      XBUI.canvasElement.bind("mouseout", XBUI.endPencilDraw);
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
    XB.canvasFunction("endPencilDraw");
    XBUI.canvasElement.unbind("mousemove");
    XBUI.canvasElement.unbind("mouseup");
    XBUI.canvasElement.unbind("mouseout");
  },

  /**
   * Activates erasing tool and adds eraser_active class
   * to canvas element.
   *
   * @param event The event that has been executed to perform
   * this action
   */
  activateEraser: function(event) {
    XBUI.changeTool();
    XBUI.canvasElement.bind("mousedown", XBUI.beginErasing);
    XBUI.canvasElement.addClass(XBUI.getElementName('eraser_active'));
    $("#button_eraser").addClass("active");
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
      XB.canvasFunction("beginErasing", XBUI.getX(event), XBUI.getY(event));
      XBUI.canvasElement.bind("mousemove", function(event) {
          XB.canvasFunction("erasePoint", XBUI.getX(event), XBUI.getY(event));
      });
      XBUI.canvasElement.bind("mouseup", XBUI.endErasing);
      XBUI.canvasElement.bind("mouseout", XBUI.endErasing);
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
    XBUI.canvasElement.unbind("mousemove");
    XBUI.canvasElement.unbind("mouseup");
    XBUI.canvasElement.unbind("mouseout");
  },

  clear: function() {
    XB.canvasFunction("clear");
  },

  /* Updates the total recording time and playback time clocks in the UI */
  setClock: function(time){
    // if time is passed in, we use it, otherwise we just set it to
    // the current recording time because it means we are recording
    // and the total time is increasing
    if (typeof time === "undefined"){ // implies we are recording, so we update the max
      time = XB.getRecordingTime();
      $("#xboard-container #slider").slider("option", "max", time);
    } else if (time > XB.getRecordingTime()) {
      // since this time is set by an incrementer, the last one will exceed
      // our recording time so we set it back down and stop the timeout
      // since we've reached the end of playback
      time = XB.getRecordingTime();
    }
    // set clocks in UI, elapsed/total
    $("#elapsed_timer").html(readableTime(time));
    // want XB.getRecordingTime() since on playback recordingtime stays same
    $("#total_timer").html(readableTime(XB.getRecordingTime()));

    // set slider position
    $("#xboard-container #slider").slider("option", "value", time);
  },

  /* Wrapper for setClock that allows an interval to be set
     using setTimeout instead of setInterval. Prevents "blocking" */
  setClockInterval: function() {
    XBUI.setClock();
    XB.recordClockInterval = setTimeout(XBUI.setClockInterval, XB.sampleRate);
  },

  /* Set the max time for the slider and UI */
  setMaxTime: function(time){
    $("#xboard-container #slider").slider("option", "max", time);
    $("#total_timer").html(readableTime(time));
  }

};
})();
