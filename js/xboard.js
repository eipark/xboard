(function() {

/**
 * =============
 *    Helpers
 * =============
 */

/* Calls functions by their name and arguments. Used in canvasFunction
   which is a wrapper around all drawing functions and the interface to XB
   from XBUI. */
function executeFunctionByName(functionName, context /*, args */) {
  var args = Array.prototype.slice.call(arguments, 2);
  var namespaces = functionName.split(".");
  var func = namespaces.pop();
  for (var i = 0; i < namespaces.length; i++) {
      context = context[namespaces[i]];
  }
  return context[func].apply(context, args);
}

// LZW-compress a string
function lzw_encode(s) {
    var dict = {};
    var data = (s + "").split("");
    var out = [];
    var currChar;
    var phrase = data[0];
    var code = 256;
    for (var i=1; i<data.length; i++) {
        currChar=data[i];
        if (dict[phrase + currChar] != null) {
            phrase += currChar;
        }
        else {
            out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
            dict[phrase + currChar] = code;
            code++;
            phrase=currChar;
        }
    }
    out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
    for (var i=0; i<out.length; i++) {
        out[i] = String.fromCharCode(out[i]);
    }
    return out.join("");
}

// Decompress an LZW-encoded string
function lzw_decode(s) {
    var dict = {};
    var data = (s + "").split("");
    var currChar = data[0];
    var oldPhrase = currChar;
    var out = [currChar];
    var code = 256;
    var phrase;
    for (var i=1; i<data.length; i++) {
        var currCode = data[i].charCodeAt(0);
        if (currCode < 256) {
            phrase = data[i];
        }
        else {
           phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
        }
        out.push(phrase);
        currChar = phrase.charAt(0);
        dict[code] = oldPhrase + currChar;
        code++;
        oldPhrase = phrase;
    }
    return out.join("");
}

/**
 * =============
 *     MODEL
 * =============
 */

/* === BEGIN Event objects === */
/* Begin path event */
function BeginPath(x, y) {
  this.coord = [x, y];
  this.type="b";
  this.time = XB.getRecordingTime();
  console.log("Begin path: "+this.time);
}

/* End path event */
function ClosePath() {
  this.type = "c";
  this.time = XB.getRecordingTime();
  console.log("Close path: "+this.time);
}

/* Point draw event */
function DrawPathToPoint(x, y) {
  this.type = "d";
  this.coord = [x, y];
  this.time = XB.getRecordingTime();
}

/*Erase event */
function Erase(x, y) {
  this.type = "e";
  this.coord = [x, y];
  this.height = 10;
  this.width = 10;
  this.time = XB.getRecordingTime();
}

/*Clear event */
function Clear() {
  this.type = "l";
  this.time = XB.getRecordingTime();
}

/* Stroke style event */
function StrokeStyle(color) {
  this.type = "s";
  this.color = color;

  if (XB.recording) {
    this.time = XB.getRecordingTime();
  } else {
    // StrokeStyle can be called when not recording
    this.time = XB.lastEndTime - XB.subtractTime;
  }
}
/* === END Event objects === */

/**
 * ====================
 *    STATIC CONTROL
 * ====================
 */
window.XB = {

    context: null,
    canvas: null,
    type: '',
    coord: [0,0],
    events: [],
    animIndex: 0, // next in queue
    recording: false,
    recordingTime: 0,
    lastEndTime: 0,
    subtractTime: 0,
    recordClockInterval: null,
    playbackClockTimeout: null,
    playbackClock: 0,
    isPlaying: false,
    sampleRate: 250, // ms increments for clock intervals
    animateTimeout: null,
    drawColor: '#000000',
    uniqueID: null,

    /**
     * Initializes the script by setting the default
     * values for parameters of the class.
     *
     * @param canvasid The id of the canvas element used
     */
    init: function(canvasid) {
      // set the canvas width and height
      // the offsetWidth and Height is default width and height
      this.canvas = document.getElementById(canvasid);
      this.canvas.width = this.canvas.offsetWidth;
      this.canvas.height = this.canvas.offsetHeight;

      this.context = this.canvas.getContext('2d');

      //initial values for the drawing context
      this.context.lineWidth = 5;
      this.context.lineCap = "square";

      // Initialize the selected color and add it as the first event
      XB.setStrokeStyle(XB.drawColor);

    },

    /**
     * Executes the event that matches the given event
     * object
     *
     * @param xbevent The event object to be executed.
     * @param firstexecute tells the function if the event is new and
     *          should be saved to this.events
     * This object should be one of the model's event objects.
     */
    //execute: function(xbevent, firstexecute) {
    execute: function(xbevent){
      var type = xbevent.type;
      var wid;
      var hei;
      var tmp;

      // Only push and save if we're recording
      if (XB.recording){
        XB.events.push(xbevent);
      }

      if(type === "b") {
        this.context.beginPath();
        this.context.moveTo(xbevent.coord[0],
                       xbevent.coord[1]);
        this.context.stroke();
      } else if (type === "d") {
        this.context.lineTo(xbevent.coord[0],
                       xbevent.coord[1]);
        this.context.stroke();
      } else if (type === "c") {
        this.context.closePath();
      } else if(type === "s") {
        this.context.strokeStyle = xbevent.color;
      } else if (type === "e") {
        this.context.clearRect(xbevent.coord[0],
                               xbevent.coord[1],
                               xbevent.width,
                               xbevent.height);
      } else if (type === "l") {
        XB.context.clearRect(0,0,XB.canvas.width,XB.canvas.height);
      }

    },


    /**
     * Resolves the relative width and height of the canvas
     * element. Relative parameters can vary depending on the
     * zoom. Both are equal to 1 if no zoom is encountered.
     *
     * @return An array containing the relative width as first
     * element and relative height as second.
     */
    getRelative: function() {
      return {width: this.canvas.width/this.canvas.offsetWidth,
          height: this.canvas.height/this.canvas.offsetHeight};
    },

    /* === BEGIN ACTIONS === */

    /**
     * Starts the animation action in the canvas from start. This clears
     * the whole canvas and starts to execute actions from
     * the action stack by calling XB.animateNext().
     * Will reset playback clock as well.
     */
    animate: function() {
      console.log("--- playing from beginning");
      XB.setPlaybackClock(0);
      XB.animIndex = 0;
      XB.context.clearRect(0,0,XB.canvas.width,XB.canvas.height);
      if (XB.events.length > 0) {
        XB.animateNext(XB.events[0].time);
      }
    },

    /**
     * This function animates the next event in the event
     * stack and waits for the amount of time between the
     * current and next event before calling itself again.
     * If a time argument is passed in, it is essentially a
     * delay on the calling of the function. It calls itself
     * again by setting a timeout.
     */
    animateNext: function(delay) {
      if (!(typeof delay === "undefined")) {
        XB.animateTimeout = setTimeout(XB.animateNext);
      } else {
        if (XB.animIndex === 0) {
          XB.animateTimeout = setTimeout(function(){
            XB.execute(XB.events[0]);
          }, XB.events[0].time);
        } else {
          XB.execute(XB.events[XB.animIndex]);
        }
        XB.animIndex++;
        if (XB.animIndex < XB.events.length - 1) {
          var diffTime = XB.events[XB.animIndex].time - XB.events[XB.animIndex - 1].time;
          XB.animateTimeout = setTimeout(XB.animateNext, diffTime);
        } else {
          // we've reached the end, decrement back down
          XB.animIndex--;
        }
      }
    },


    /* called when someone clicks or moves the scrubber */
    jump: function(time){
      XB.redraw(time);
      // stop the old playbackClockTimeout and start a new one at our new time
      clearTimeout(XB.playbackClockTimeout);
      XB.setPlaybackClock(time);
      if (XB.isPlaying) {
        XB.animateNext(XB.events[XB.animIndex].time - time);
      }
    },

    // stops playback and playback clock
    pause: function(){
      XB.isPlaying = false;
      // could be redundant if we already cleared timeout at end of playback, but
      // that's ok
      clearTimeout(XB.animateTimeout);
      clearTimeout(XB.playbackClockTimeout);
      console.log("--- paused");
    },

    // start clock again and continue animating from the proper index.
    play: function(){
      console.log("--- playing at ind: " + XB.animIndex);
      XB.isPlaying = true;
      if (XB.playbackEnd()) {
        XB.animate();
      } else {
        XB.setPlaybackClock();

        // only animate if we haven't played all the events yet
        if (!XB.eventsEnd()){
          console.log("Ind: " + XB.animIndex + " End: " + XB.events.length);
          XB.animateNext(XB.events[XB.animIndex].time - XB.playbackClock);
        }
      }
    },


    record: function(){
      // if in middle of playback and you record, go back to the end of the
      // recording, only supporting appending for records
      if (!XB.playbackEnd()) {
        XB.redraw();
      }
      XB.recording = true;
      XB.subtractTime += (new Date().getTime() - XB.lastEndTime);
      console.log("record, subtractTime: "+ XB.subtractTime);
      XBUI.setClockInterval();
    },

    pauseRecord: function(){
      console.log("XB.pauseRecord ----------");
      XB.recording = false;
      // keep track of this to make one smooth timeline even if we stop
      // and start recording sporadically.
      XB.lastEndTime = new Date().getTime();
      // playback clock should be same as recording time when we stop recording
      XB.playbackClock = XB.getRecordingTime();
      clearInterval(XB.recordClockInterval);
    },

    /** Canvas/Recording Functions **/

    /**
     * Begins a drawing path.
     *
     * @param x Coordinate x of the path starting point
     * @param y Coordinate y of the path starting point
     */
    beginPencilDraw: function(x, y) {
      var e = new BeginPath(x, y);
      XB.execute(e);
    },

    endPencilDraw: function(){
      var e = new ClosePath();
      XB.execute(e);
    },

    /**
     * Draws a path from the path starting point to the
     * point indicated by the given parameters.
     *
     * @param x Coordinate x of the path ending point
     * @param y Coordinate y of the path ending point
     */
    pencilDraw: function(x, y) {
        var e = new DrawPathToPoint(x, y);
        XB.execute(e);
    },

    /**
     * Begins erasing path.
     *
     * @param x Coordinate x of the path starting point
     * @param y Coordinate y of the path starting point
     */
    beginErasing: function(x, y) {
        var e = new BeginPath(x, y);
        XB.execute(e);
    },

    /**
     * Erases the point indicated by the given coordinates.
     * Actually this doesn't take the path starting point
     * into account but erases a rectangle at the given
     * coordinates with width and height specified in the
     * Erase object.
     *
     * @param x Coordinate x of the path ending point
     * @param y Coordinate y of the path ending point
     */
    erasePoint: function(x, y) {
        var e = new Erase(x, y);
        XB.execute(e);
    },

    clear: function(){
      var e = new Clear();
      XB.execute(e);
    },

    /** END Canvas/Recording Functions **/

    /**
     * This function redraws the entire canvas
     * according to the events in events.
     * If a time is specified it only redraws up to that point. Otherwise it
     * redraws the entire canvas.
    */
    redraw: function(time) {
      // Only redraw the entire board if we're going backwards from our current state
      if (!(typeof time === "undefined" || time >= XB.playbackClock)) {
        XB.animIndex = 0;
        XB.context.clearRect(0,0,XB.canvas.width,XB.canvas.height);
      }
      // This code is verbose, but better for performance by reducing the number
      // of conditions checked in the loop
      if (typeof time === "undefined") {
        for (XB.animIndex; XB.animIndex < XB.events.length; XB.animIndex++){
          XB.execute(XB.events[XB.animIndex]);
        }
      } else { //redraw only up to time
        for (XB.animIndex; XB.animIndex < XB.events.length; XB.animIndex++){
          if (XB.events[XB.animIndex].time >= time){
            break;
          } else {
            XB.execute(XB.events[XB.animIndex]);
          }
        }
      }

      // If we got to the end, our animIndex is out of bounds now, decrement
      if (XB.animIndex == XB.events.length) {
        XB.animIndex--;
      }
    },

   /**
     * Sets stroke style for the canvas. Stroke
     * style defines the color with which every
     * stroke should be drawn on the canvas.
     *
     * @param color The wanted stroke color
    */
    setStrokeStyle: function(color) {
      console.log(color);
      var e = new StrokeStyle(color);
      XB.execute(e);
      // Always push changes in stroke style if not playing
      // Push here, not in execute, because then redraw would
      // be pushing StrokeStyle events into XB.events.
      if (!XB.isPlaying) {
        XB.events.push(e);
      }
    },

    /* === END ACTIONS === */

    /**
     * Wrapper around drawing functions, we want to make sure
     * recording is on first before anything gets executed.
     */
    canvasFunction: function(function_name, x, y){
      if (XB.recording) {
        executeFunctionByName(function_name, XB, x, y);
      }
    },

    /* Creates a dictionary with all state important variables and
       CJSON and LZW compresses it before storing in a user specified
       data store.*/
    save: function(){
      // Generate a unique ID if this is a new video. Only generate when saving.
      // Store it in data for redundancy and error checking.
      if (!XB.uniqueID) {
        XB.uniqueID = XB.genUniqueID();
      }

      var data = {
        'uniqueID'      : XB.uniqueID,
        'recordingTime' : XB.recordingTime,
        'subtractTime'  : XB.subtractTime,
        'lastEndTime'   : XB.lastEndTime,
        'strokeColor'   : XB.context.strokeStyle,
        'events'        : XB.events
      };

      data = lzw_encode(CJSON.stringify(data));
      return data;
      if (XB.saveToDatabase(data)) {
        alert("Successfully saved.");
      } else {
        alert("Error while saving.");
      }
    },

    /* Save the data to your datastore of choice.
       As it is easy for a hacker to retrieve recording tools
       from an embed and manipulate the video, make sure you have
       proper authentification before you save anything to a DB.
       @return: true on success, false on failure.                */
    saveToDatabase: function(data){
      // TODO: YOUR IMPLEMENTATION HERE
    },

    /* Restores the state of the canvas from saved compressed data. */
    restore: function(uniqueID){
      var data = XB.restoreFromDatabase(uniqueID);
      // Test locally without datastore
      // var data = CJSON.parse(lzw_decode(XB.save()));
      if (data) {
        XB.uniqueID = data["uniqueID"];
        if (XB.uniqueID != uniqueID) {
          alert("Error: The passed in embed code does not match the one stored by the video");
          return;
        }
        XBUI.setMaxTime(data["recordingTime"]);
        XB.recordingTime = data["recordingTime"];
        XB.subtractTime = data["subtractTime"];
        XB.lastEndTime = data["lastEndTime"];
        $.fn.colorPicker.changeColor(data["strokeColor"]);
        XB.events = data["events"];
      } else {
        alert("Error retrieving data.");
      }

    },

    /* Use the video id as a key to retrieve the video data from your
       datastore of choice.
       @return: data on success, false on failure. */
    restoreFromDatabase: function(id) {
      // TODO: YOUR IMPLEMENTATION HERE
    },

    /* Generates an 11 character unique ID. */
    genUniqueID: function() {
      var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
      var len = 11;
      var id = "";
      var rand_no;
      for (var i = 0; i < len; i++){
        rand = Math.floor(Math.random() * chars.length);
        id += chars.substring(rand, rand + 1);
      }
      return id;
    },

    /* calls set clock every x milliseconds for when playing back
       need to use this instead of getRecordingTime since events
       don't happen in regular intervals so we need a regular clock update */
    setPlaybackClock: function(time){
      if (typeof time === "undefined") {
        // if no explicit time passed in, increment the current playbackClock
        XB.playbackClock += XB.sampleRate;
      } else {
        XB.playbackClock = time;
      }

      XBUI.setClock(XB.playbackClock);

      // set timeout if we're in play mode
      if (XB.isPlaying) {
        // to make sure we stop at the end of playback
        if (XB.playbackClock < XB.getRecordingTime()) {
          XB.playbackClockTimeout = setTimeout(XB.setPlaybackClock, XB.sampleRate, XB.playbackClock + XB.sampleRate);
        } else {
          XB.isPlaying = false;
          XB.playbackClock = XB.getRecordingTime();
          XBUI.playPauseToggle();
        }
      }

    },

    /* Gets the time elapsed in recording mode*/
    getRecordingTime: function(){
      if (XB.recording) {
        XB.recordingTime = new Date().getTime() - XB.subtractTime;
      }
      return XB.recordingTime;
    },

    // check if playback is at max time
    playbackEnd: function(){
      return XB.playbackClock == XB.getRecordingTime();
    },

    // check if all events have been played in playback
    eventsEnd: function() {
      return XB.animIndex == (XB.events.length - 1);
    },

    };
})();
