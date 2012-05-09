(function() {

/**
 * =============
 *    Helpers
 * =============
 */

function executeFunctionByName(functionName, context /*, args */) {
  var args = Array.prototype.slice.call(arguments, 2);
  var namespaces = functionName.split(".");
  var func = namespaces.pop();
  for (var i = 0; i < namespaces.length; i++) {
      context = context[namespaces[i]];
  }
  return context[func].apply(context, args);
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
  this.time = Wb.getRecordingTime();
  console.log("Begin path: "+this.time);
}

/* End path event */
function ClosePath() {
  this.type = "c";
  this.time = Wb.getRecordingTime();
  console.log("Close path: "+this.time);
}

/* Point draw event */
function DrawPathToPoint(x, y) {
  this.type = "d";
  this.coord = [x, y];
  this.time = Wb.getRecordingTime();
}

/*Erase event */
function Erase(x, y) {
  this.type = "e";
  this.coord = [x, y];
  this.height = 10;
  this.width = 10;
  this.time = Wb.getRecordingTime();
}

/* Stroke style event
   Don't want this to take up time, so we set it as last
   event before recording ended. Delays should only be on
   drawing events */
function StrokeStyle(color) {
  this.type = "s";
  this.color = color;
  console.log("Color: " + color);
  if (Wb.recording) {
    this.time = Wb.getRecordingTime();
  } else {
    this.time = Wb.lastEndTime - Wb.subtractTime;
  }
}
/* === END Event objects === */



/**
 * ====================
 *    STATIC CONTROL
 * ====================
 */
window.Wb = {

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

      //console.log(this.canvas);
      this.context = this.canvas.getContext('2d');

      //initial values for the drawing context
      this.context.lineWidth = 5;
      this.context.lineCap = "square";

      // Initialize the selected color and add it as the first event
      Wb.setStrokeStyle(Wb.drawColor);
    },

    /**
     * Executes the event that matches the given event
     * object
     *
     * @param wbevent The event object to be executed.
     * @param firstexecute tells the function if the event is new and
     *          should be saved to this.events
     * This object should be one of the model's event objects.
     */
    //execute: function(wbevent, firstexecute) {
    execute: function(wbevent){
      var type = wbevent.type;
      var wid;
      var hei;
      var tmp;

      // Only push and save if we're recording
      if (Wb.recording){
        Wb.events.push(wbevent);
      }

      if(type === "b") {
        this.context.beginPath();
        this.context.moveTo(wbevent.coord[0],
                       wbevent.coord[1]);
        this.context.stroke();
      } else if (type === "d") {
        this.context.lineTo(wbevent.coord[0],
                       wbevent.coord[1]);
        this.context.stroke();
      } else if (type === "c") {
        this.context.closePath();
      } else if(type === "s") {
        this.context.strokeStyle = wbevent.color;
      } else if (type === "e") {
        this.context.clearRect(wbevent.coord[0],
                               wbevent.coord[1],
                               wbevent.width,
                               wbevent.height);
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
     * the action stack by calling Wb.animateNext().
     * Will reset playback clock as well.
     */
    animate: function() {
      console.log("--- playing from beginning");
      Wb.setPlaybackClock(0);
      Wb.animIndex = 0;
      Wb.context.clearRect(0,0,Wb.canvas.width,Wb.canvas.height);
      if (Wb.events.length > 0) {
        Wb.animateNext(Wb.events[0].time);
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
        Wb.animateTimeout = setTimeout(Wb.animateNext);
      } else {
        if (Wb.animIndex === 0) {
          Wb.animateTimeout = setTimeout(function(){
            Wb.execute(Wb.events[0]);
          }, Wb.events[0].time);
        } else {
          Wb.execute(Wb.events[Wb.animIndex]);
        }
        Wb.animIndex++;
        if (Wb.animIndex < Wb.events.length - 1) {
          var diffTime = Wb.events[Wb.animIndex].time - Wb.events[Wb.animIndex - 1].time;
          Wb.animateTimeout = setTimeout(Wb.animateNext, diffTime);
        } else {
          // we've reached the end, decrement back down
          Wb.animIndex--;
        }
      }
    },


    /* called when someone clicks or moves the scrubber */
    jump: function(time){
      Wb.redraw(time);
      // stop the old playbackClockTimeout and start a new one at our new time
      clearTimeout(Wb.playbackClockTimeout);
      Wb.setPlaybackClock(time);
      if (Wb.isPlaying) {
        alert("x");
        Wb.animateNext(Wb.events[Wb.animIndex].time - time);
      }
    },

    // stops playback and playback clock
    pause: function(){
      Wb.isPlaying = false;
      // could be redundant if we already cleared timeout at end of playback, but
      // that's ok
      clearTimeout(Wb.animateTimeout);
      clearTimeout(Wb.playbackClockTimeout);
      console.log("--- paused");
    },

    // start clock again and continue animating from the proper index.
    play: function(){
      console.log("--- playing at ind: " + Wb.animIndex);
      Wb.isPlaying = true;
      if (Wb.playbackEnd()) {
        Wb.animate();
      } else {
        Wb.setPlaybackClock();

        // only animate if we haven't played all the events yet
        if (!Wb.eventsEnd()){
          console.log("Ind: " + Wb.animIndex + " End: " + Wb.events.length);
          Wb.animateNext(Wb.events[Wb.animIndex].time - Wb.playbackClock);
        }
      }
    },


    record: function(){
      // if in middle of playback and you record, go back to the end of the
      // recording, only supporting appending for records
      if (!Wb.playbackEnd()) {
        Wb.redraw();
      }
      Wb.recording = true;
      Wb.subtractTime += (new Date().getTime() - Wb.lastEndTime);
      console.log("record, subtractTime: "+ Wb.subtractTime);
      WbUi.setClockInterval();
    },

    pauseRecord: function(){
      console.log("Wb.pauseRecord ----------");
      Wb.recording = false;
      // keep track of this to make one smooth timeline even if we stop
      // and start recording sporadically.
      Wb.lastEndTime = new Date().getTime();
      // playback clock should be same as recording time when we stop recording
      Wb.playbackClock = Wb.getRecordingTime();
      clearInterval(Wb.recordClockInterval);
    },

    /**
     * Begins a drawing path.
     *
     * @param x Coordinate x of the path starting point
     * @param y Coordinate y of the path starting point
     */
    beginPencilDraw: function(x, y) {
      var e = new BeginPath(x, y);
      Wb.execute(e);
    },

    endPencilDraw: function(){
      var e = new ClosePath();
      Wb.execute(e);
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
        Wb.execute(e);
    },

    /**
     * Begins erasing path.
     *
     * @param x Coordinate x of the path starting point
     * @param y Coordinate y of the path starting point
     */
    beginErasing: function(x, y) {
        var e = new BeginPath(x, y);
        Wb.execute(e);
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
        Wb.execute(e);
    },

    /**
     * This function redraws the entire canvas
     * according to the events in events.
     * If a time is specified it only redraws up to that point. Otherwise it
     * redraws the entire canvas.
    */
    redraw: function(time) {
      // Only redraw the entire board if we're going backwards from our current state
      if (!(typeof time === "undefined" || time >= Wb.playbackClock)) {
        Wb.animIndex = 0;
        Wb.context.clearRect(0,0,Wb.canvas.width,Wb.canvas.height);
      }
      // This code is verbose, but better for performance by reducing the number
      // of conditions checked in the loop
      if (typeof time === "undefined") {
        for (Wb.animIndex; Wb.animIndex < Wb.events.length; Wb.animIndex++){
          Wb.execute(Wb.events[Wb.animIndex]);
        }
      } else { //redraw only up to time
        for (Wb.animIndex; Wb.animIndex < Wb.events.length; Wb.animIndex++){
          if (Wb.events[Wb.animIndex].time >= time){
            break;
          } else {
            Wb.execute(Wb.events[Wb.animIndex]);
          }
        }
      }

      // If we got to the end, our animIndex is out of bounds now, decrement
      if (Wb.animIndex == Wb.events.length) {
        Wb.animIndex--;
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
      Wb.execute(e);
      // always push changes in stroke style if not playing
      if (!Wb.isPlaying) {
        Wb.events.push(e);
      }
    },

    /* === END ACTIONS === */

    /**
     * Wrapper around drawing functions, we want to make sure
     * recording is on first before anything gets executed.
     */
    canvasFunction: function(function_name, x, y){
      if (Wb.recording) {
        executeFunctionByName(function_name, Wb, x, y);
      }
    },

    // Compresses event data using CJSON
    save: function(){
      CJSON.stringify(Wb.events);
      // do we need to add extra information??
      // gzip?
    },

    // Restores the state of the canvas from saved compressed data
    restore: function(){
      //Wb.events = CJSON.parse();
      // set max slider time
      // sync endtime/subtractTime
    },

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
        Wb.playbackClock += Wb.sampleRate;
      } else {
        Wb.playbackClock = time;
      }

      WbUi.setClock(Wb.playbackClock);

      // set timeout if we're in play mode
      if (Wb.isPlaying) {
        // to make sure we stop at the end of playback
        if (Wb.playbackClock < Wb.getRecordingTime()) {
          Wb.playbackClockTimeout = setTimeout(Wb.setPlaybackClock, Wb.sampleRate, Wb.playbackClock + Wb.sampleRate);
        } else {
          Wb.isPlaying = false;
          Wb.playbackClock = Wb.getRecordingTime();
          WbUi.playPauseToggle();
        }
      }

    },

    /* Gets the time elapsed in recording mode*/
    getRecordingTime: function(){
      if (Wb.recording) {
        Wb.recordingTime = new Date().getTime() - Wb.subtractTime;
      }
      return Wb.recordingTime;
    },

    // check if playback is at max time
    playbackEnd: function(){
      return Wb.playbackClock == Wb.getRecordingTime();
    },

    // check if all events have been played in playback
    eventsEnd: function() {
      return Wb.animIndex == (Wb.events.length - 1);
    },

    };
})();
