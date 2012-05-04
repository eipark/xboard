/**
 * HTML5 Canvas Wb
 * 
 * Authors:
 * Antti Hukkanen
 * Kristoffer Snabb
 * 
 * Aalto University School of Science and Technology
 * Course: T-111.2350 Multimediatekniikka / Multimedia Technology
 * 
 * Under MIT Licence
 * 
 */

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
  this.coordinates = [x, y];
  this.type="beginpath";
  this.time = Wb.getRecordingTime();
  console.log("Begin path: "+this.time);
}
/* End path event */
function ClosePath() {
  this.type = "closepath";
  this.time = Wb.getRecordingTime();
}
/* Point draw event */
function DrawPathToPoint(x, y) {
  this.type = "drawpathtopoint";
  this.coordinates = [x, y];
  this.time = Wb.getRecordingTime();
}
/*Erase event */
function Erase(x, y) {
  this.type = "erase";
  this.coordinates = [x, y];
  this.height = 5;
  this.width = 5;
  this.time = Wb.getRecordingTime();
}
/* Stroke style event 
   Don't want this to take up time, so we set it as last
   event before recording ended. Delays should only be on
   drawing events */
function StrokeStyle(color) {
  this.type = "strokestyle";
  this.color = color;
  if (Wb.recording) {
    this.time = Wb.getRecordingTime();
  } else {
    console.log("Stroke, not recording");
    this.time = Wb.lastEndTime;
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
    coordinates: [0,0],
    events: [], // gets reset when animating
    animationind: 0,
    recording: false,
    recordingTime: 0,
    lastEndTime: 0,
    subtractTime: 0,
    recordClockInterval: null, // used for both playback and recording interval/timeout
    playbackClockTimeout: null,
    playbackClock: 0,
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
      this.context.lineCap = "round";

      // Initialize the selected color
      var col = this.drawColor;
      this.drawColor = null;
      this.setStrokeStyle(col);

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

      // Only push and save if we're recording... otherwise we're
      // just replaying  an action and don't need to save it.
      if(Wb.recording) {
          this.events.push(wbevent);
      }

      if(type === "beginpath") {
          this.context.beginPath();
          this.context.moveTo(wbevent.coordinates[0],
                         wbevent.coordinates[1]);
          this.context.stroke();
      } else if (type === "drawpathtopoint") {
          this.context.lineTo(wbevent.coordinates[0],
                         wbevent.coordinates[1]);
          this.context.stroke();
      } else if (type === "closepath") {
          this.context.closePath();
      } else if(type === "strokestyle") {
          this.context.strokeStyle = wbevent.color;
      } else if (type === "erase") {
          this.context.clearRect(wbevent.coordinates[0],
                            wbevent.coordinates[1],
                            wbevent.width,
                            wbevent.height);
      }

    },

    record: function(){
      Wb.recording = true;
      Wb.subtractTime += (new Date().getTime() - Wb.lastEndTime);
      console.log("record, subtractTime: "+ Wb.subtractTime);
      Wb.recordClockInterval = setInterval(WbUi.setClock, Wb.sampleRate);
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

    /* calls set clock every x milliseconds for when playing back
       need to use this instead of getRecordingTime since events
       don't happen in regular intervals so we need a regular clock update */
    setPlaybackClock: function(time){
      if (!(time === undefined)) {
        Wb.playbackClock = time;
      } else {
        Wb.playbackClock += Wb.sampleRate;
      }
      console.log("playbackclock: " + Wb.playbackClock);
      WbUi.setClock(Wb.playbackClock);
      // to make sure we stop at the end of playback
      if (Wb.playbackClock <= Wb.getRecordingTime()) {
        Wb.playbackClockTimeout = setTimeout(Wb.setPlaybackClock, Wb.sampleRate, Wb.playbackClock + Wb.sampleRate);
      } else {
        Wb.playbackClock = Wb.getRecordingTime();
        WbUi.playPauseToggle();
      }

    },

    checkRecordStatus: function(){
      if (Wb.recording){
        return true;
      } else {
        alert("You must begin recording before you start drawing");
        return false;
      }
    },

    /* Gets the time elapsed in recording mode*/
    getRecordingTime: function(){
      if (Wb.recording) {
        Wb.recordingTime = new Date().getTime() - Wb.subtractTime;
      }
      return Wb.recordingTime;
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
     * the action stack by calling Wb.animatenext().
     * Will reset playback clock as well.
     */
    animate: function() {
      Wb.setPlaybackClock(0);
      Wb.animationind = 0;
      Wb.context.clearRect(0,0,Wb.canvas.width,Wb.canvas.height);
      Wb.animatenext();
    },

    /**
     * This function animates the next event in the event
     * stack and waits for the amount of time between the
     * current and next event before calling itself again.
     */
    animatenext: function() {
      if (Wb.animationind === 0) {
        Wb.animateTimeout = setTimeout(function(){
          Wb.execute(Wb.events[0], false);
          Wb.animationind++;
        }, Wb.events[0].time);
      } else {
        //Wb.execute(Wb.events[Wb.animationind], false);
        Wb.execute(Wb.events[Wb.animationind]);
        Wb.animationind++;
      }
      if (Wb.animationind < Wb.events.length - 1) {
        var dtime = Wb.events[Wb.animationind + 1].time - Wb.events[Wb.animationind].time;
        Wb.animateTimeout = setTimeout(Wb.animatenext, dtime);
      } else {
      }
    },

    /* called when someone clicks or moves the scrubber */
    jump: function(time){
      Wb.redraw(time);
      clearTimeout(Wb.playbackClockTimeout);
      Wb.setPlaybackClock(time);
      Wb.animateTimeout = setTimeout(Wb.animatenext, Wb.events[Wb.animationind]["time"] - time);
    },

    // stops playback and playback clock
    pause: function(){
      console.log("--- pausing at ind: " + Wb.animationind);
      clearTimeout(Wb.animateTimeout);
      // could be redundant if we already cleared timeout at end of playback, but
      // that's ok
      clearTimeout(Wb.playbackClockTimeout);
      console.log("--- paused");
    },

    // start clock again and continue animating from the proper index.
    play: function(){
      console.log("--- playing at ind: " + Wb.animationind);
      if (Wb.playbackClock == Wb.getRecordingTime()) {
        Wb.animate();
      } else {
        Wb.setPlaybackClock();
        Wb.animatenext();
      }
      console.log("--- playing");
    },

    /**
     * Wrapper around drawing functions, we want to make sure
     * recording is on first before anything gets executed
     */
    canvasFunction: function(function_name, x, y){
      if (Wb.checkRecordStatus()) {
        executeFunctionByName(function_name, Wb, x, y);
      }
    },

    jsonit: function(){
      alert(Wb.events);
      Wb.events = JSON.stringify(Wb.events);
      alert(Wb.events);
      Wb.events = JSON.parse(Wb.events);
      alert(Wb.events);
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
     * If a time is specified it only redraws up to that point
    */
    redraw: function(time) {
        //this.init();
      Wb.context.clearRect(0,0,Wb.canvas.width,Wb.canvas.height);
      var redrawEvents = Wb.events;

      for(var i = 0; i < redrawEvents.length; i++) {
        if (time && redrawEvents[i]["time"] > time) {
          // this will be the next animation we start with
          Wb.animationind = i;
          break;
        } else {
          this.execute(redrawEvents[i]);
        }
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
     if (color != Wb.drawColor) {
        var e = new StrokeStyle(color);
        Wb.execute(e);
      }
    },

    /**
     * This removes the last event from this events 
     * and redraws (it can be made more 
     * effective then to redraw but time is limited)
    */
    undo: function() {
      reverseEvent = Wb.events.pop();
      console.log(reverseEvent.type);
      Wb.redraw();
    }

    /* === END ACTIONS === */

    };
})();
