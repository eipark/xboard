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
      // Always push changes in stroke style if not playing
      // Push here, not in execute, because then redraw would
      // be pushing StrokeStyle events into Wb.events.
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
    // Also stores meta-data, time
    save: function(){
      var data = {
        'recordingTime': Wb.getRecordingTime(),
        'subtractTime': Wb.subtractTime,
        'lastEndTime' : Wb.lastEndTime,
        'events': Wb.events
      };
      data = CJSON.stringify(data);
      console.log(data);

      //CJSON.stringify(data);
      // do we need to add extra information??
      // gzip?
    },

    // Restores the state of the canvas from saved compressed data
    restore: function(uniqueID){
      //Wb.events = CJSON.parse();
      // set max slider time
      // sync endtime/subtractTime
      var storedData;
      if (uniqueID == "goose") {
        storedData = '{"f":"cjson","t":[[0,"type"],[1,"time"],[1,"color","time"],[1,"coord","time"],[0,"coord","type","time"],[0,"recordingTime","subtractTime","lastEndTime","events"]],"v":{"":[6,10087,1336627713764,1336627723998,[{"":[3,"s","#000000",0]},{"":[5,[126,94],"b",2496]},{"":[4,"d",[118,94],2499]},{"":[4,"d",[106,94],2514]},{"":[4,"d",[100,94],2536]},{"":[4,"d",[90,94],2553]},{"":[4,"d",[82,98],2569]},{"":[4,"d",[78,102],2586]},{"":[4,"d",[73,110],2602]},{"":[4,"d",[69,121],2618]},{"":[4,"d",[65,134],2635]},{"":[4,"d",[65,146],2652]},{"":[4,"d",[65,156],2668]},{"":[4,"d",[68,165],2685]},{"":[4,"d",[71,170],2702]},{"":[4,"d",[76,175],2718]},{"":[4,"d",[83,180],2736]},{"":[4,"d",[94,181],2753]},{"":[4,"d",[109,181],2769]},{"":[4,"d",[128,180],2785]},{"":[4,"d",[138,175],2804]},{"":[4,"d",[142,173],2819]},{"":[2,"c",2920]},{"":[5,[112,147],"b",3080]},{"":[4,"d",[114,147],3099]},{"":[4,"d",[116,146],3116]},{"":[4,"d",[126,144],3133]},{"":[4,"d",[129,142],3149]},{"":[4,"d",[135,141],3167]},{"":[4,"d",[138,141],3182]},{"":[4,"d",[139,141],3200]},{"":[4,"d",[143,147],3215]},{"":[4,"d",[146,154],3232]},{"":[4,"d",[148,161],3248]},{"":[4,"d",[149,171],3266]},{"":[4,"d",[149,182],3282]},{"":[4,"d",[144,199],3303]},{"":[4,"d",[141,208],3321]},{"":[4,"d",[141,211],3337]},{"":[4,"d",[141,213],3354]},{"":[4,"d",[141,214],3370]},{"":[2,"c",3423]},{"":[5,[164,148],"b",3728]},{"":[4,"d",[163,147],3734]},{"":[4,"d",[162,147],3749]},{"":[4,"d",[161,149],3767]},{"":[4,"d",[158,152],3782]},{"":[4,"d",[157,153],3803]},{"":[4,"d",[154,157],3819]},{"":[4,"d",[154,160],3836]},{"":[4,"d",[154,163],3853]},{"":[4,"d",[155,167],3870]},{"":[4,"d",[162,170],3886]},{"":[4,"d",[168,171],3903]},{"":[4,"d",[171,171],3920]},{"":[4,"d",[173,170],3937]},{"":[4,"d",[175,166],3954]},{"":[4,"d",[178,158],3970]},{"":[4,"d",[181,151],3988]},{"":[4,"d",[181,147],4004]},{"":[4,"d",[181,144],4020]},{"":[4,"d",[178,142],4037]},{"":[4,"d",[174,141],4054]},{"":[4,"d",[166,141],4070]},{"":[4,"d",[158,140],4087]},{"":[4,"d",[157,140],4103]},{"":[2,"c",4105]},{"":[5,[198,143],"b",4329]},{"":[4,"d",[198,144],4350]},{"":[4,"d",[197,146],4366]},{"":[4,"d",[195,148],4383]},{"":[4,"d",[193,152],4399]},{"":[4,"d",[193,154],4416]},{"":[4,"d",[193,156],4432]},{"":[4,"d",[195,157],4449]},{"":[4,"d",[199,158],4466]},{"":[4,"d",[205,158],4483]},{"":[4,"d",[210,158],4499]},{"":[4,"d",[212,157],4516]},{"":[4,"d",[213,155],4533]},{"":[4,"d",[213,152],4554]},{"":[4,"d",[213,149],4572]},{"":[4,"d",[213,147],4589]},{"":[4,"d",[210,145],4604]},{"":[4,"d",[204,143],4620]},{"":[4,"d",[199,143],4637]},{"":[4,"d",[197,143],4654]},{"":[4,"d",[197,144],4683]},{"":[2,"c",4695]},{"":[5,[276,141],"b",4839]},{"":[4,"d",[273,141],4850]},{"":[4,"d",[270,141],4866]},{"":[4,"d",[268,141],4883]},{"":[4,"d",[259,144],4900]},{"":[4,"d",[247,146],4917]},{"":[4,"d",[234,149],4933]},{"":[4,"d",[229,151],4950]},{"":[4,"d",[228,152],4966]},{"":[4,"d",[228,153],4983]},{"":[4,"d",[228,154],5000]},{"":[4,"d",[229,156],5017]},{"":[4,"d",[233,159],5033]},{"":[4,"d",[237,162],5055]},{"":[4,"d",[244,166],5071]},{"":[4,"d",[246,169],5087]},{"":[4,"d",[248,171],5105]},{"":[4,"d",[249,172],5122]},{"":[4,"d",[248,173],5150]},{"":[4,"d",[245,174],5166]},{"":[4,"d",[230,170],5272]},{"":[4,"d",[235,168],5283]},{"":[4,"d",[247,165],5304]},{"":[4,"d",[267,164],5321]},{"":[4,"d",[288,164],5337]},{"":[4,"d",[313,164],5354]},{"":[4,"d",[332,164],5371]},{"":[4,"d",[338,164],5388]},{"":[4,"d",[338,160],5404]},{"":[4,"d",[339,148],5421]},{"":[4,"d",[339,136],5437]},{"":[4,"d",[339,133],5454]},{"":[4,"d",[337,127],5471]},{"":[4,"d",[334,124],5488]},{"":[4,"d",[326,124],5505]},{"":[4,"d",[315,124],5521]},{"":[4,"d",[304,130],5538]},{"":[4,"d",[298,140],5555]},{"":[4,"d",[293,152],5571]},{"":[4,"d",[292,166],5588]},{"":[4,"d",[295,180],5604]},{"":[4,"d",[304,192],5621]},{"":[4,"d",[313,198],5638]},{"":[4,"d",[320,198],5655]},{"":[4,"d",[329,194],5671]},{"":[4,"d",[336,183],5687]},{"":[2,"c",5689]},{"":[3,"s","rgb(255, 255, 153)",7330]},{"":[3,"s","rgb(255, 255, 153)",7330]},{"":[5,[429,79],"b",7744]},{"":[4,"d",[429,81],7750]},{"":[4,"d",[429,83],7767]},{"":[4,"d",[429,87],7783]},{"":[4,"d",[429,96],7800]},{"":[4,"d",[427,111],7817]},{"":[4,"d",[427,125],7837]},{"":[4,"d",[426,136],7853]},{"":[4,"d",[426,145],7870]},{"":[4,"d",[427,150],7886]},{"":[4,"d",[427,154],7904]},{"":[4,"d",[427,156],7920]},{"":[4,"d",[428,157],7936]},{"":[2,"c",7959]},{"":[5,[414,196],"b",8184]},{"":[4,"d",[414,197],8233]},{"":[4,"d",[414,198],8249]},{"":[4,"d",[412,200],8267]},{"":[4,"d",[412,202],8284]},{"":[4,"d",[413,202],8334]},{"":[2,"c",8343]},{"":[5,[48,244],"b",8760]},{"":[4,"d",[48,245],8783]},{"":[4,"d",[48,246],8800]},{"":[4,"d",[52,246],8816]},{"":[4,"d",[64,246],8837]},{"":[4,"d",[85,247],8855]},{"":[4,"d",[118,247],8871]},{"":[4,"d",[148,248],8888]},{"":[4,"d",[160,249],8904]},{"":[4,"d",[161,250],8933]},{"":[4,"d",[151,252],8950]},{"":[4,"d",[142,256],8967]},{"":[4,"d",[161,258],9034]},{"":[4,"d",[197,258],9050]},{"":[4,"d",[253,258],9066]},{"":[4,"d",[293,257],9084]},{"":[4,"d",[316,257],9100]},{"":[4,"d",[314,257],9133]},{"":[4,"d",[302,259],9150]},{"":[4,"d",[296,261],9167]},{"":[4,"d",[296,262],9183]},{"":[4,"d",[299,262],9200]},{"":[4,"d",[319,262],9216]},{"":[4,"d",[344,261],9233]},{"":[4,"d",[380,261],9250]},{"":[4,"d",[407,261],9267]},{"":[4,"d",[415,260],9284]},{"":[4,"d",[422,260],9367]},{"":[4,"d",[440,261],9383]},{"":[4,"d",[462,262],9400]},{"":[4,"d",[476,262],9418]},{"":[4,"d",[476,261],9450]},{"":[4,"d",[475,261],9467]},{"":[2,"c",9472]}]]}}';
      } else {
        storedData = '{"f":"cjson","t":[[0,"type"],[1,"time"],[1,"color","time"],[1,"coord","time"],[0,"coord","type","time"],[0,"recordingTime","subtractTime","lastEndTime","events"]],"v":{"":[6,10586,1336627756672,1336627767353,[{"":[3,"s","#000000",0]},{"":[3,"s","rgb(128, 0, 128)",0]},{"":[5,[157,243],"b",1665]},{"":[4,"d",[157,246],1666]},{"":[4,"d",[157,247],1683]},{"":[4,"d",[158,249],1699]},{"":[4,"d",[160,251],1716]},{"":[4,"d",[162,255],1733]},{"":[4,"d",[167,262],1750]},{"":[4,"d",[177,275],1768]},{"":[4,"d",[185,284],1783]},{"":[4,"d",[194,293],1799]},{"":[4,"d",[206,300],1817]},{"":[4,"d",[223,303],1833]},{"":[4,"d",[237,303],1849]},{"":[4,"d",[253,302],1866]},{"":[4,"d",[263,297],1884]},{"":[4,"d",[277,286],1900]},{"":[4,"d",[290,277],1916]},{"":[4,"d",[302,267],1933]},{"":[4,"d",[310,254],1950]},{"":[4,"d",[317,246],1966]},{"":[4,"d",[321,237],1983]},{"":[4,"d",[321,235],1999]},{"":[4,"d",[323,234],2017]},{"":[4,"d",[324,233],2037]},{"":[4,"d",[325,233],2054]},{"":[2,"c",2112]},{"":[5,[245,112],"b",2409]},{"":[4,"d",[241,118],2417]},{"":[4,"d",[236,129],2433]},{"":[4,"d",[231,140],2450]},{"":[4,"d",[228,154],2466]},{"":[4,"d",[222,174],2483]},{"":[4,"d",[214,199],2500]},{"":[4,"d",[204,225],2517]},{"":[4,"d",[199,245],2542]},{"":[4,"d",[197,258],2559]},{"":[4,"d",[196,262],2575]},{"":[4,"d",[197,261],2617]},{"":[2,"c",2631]},{"":[5,[293,139],"b",2977]},{"":[4,"d",[293,142],3000]},{"":[4,"d",[287,158],3017]},{"":[4,"d",[278,178],3033]},{"":[4,"d",[268,200],3051]},{"":[4,"d",[260,215],3067]},{"":[4,"d",[254,226],3084]},{"":[4,"d",[253,233],3101]},{"":[4,"d",[251,238],3117]},{"":[4,"d",[250,240],3134]},{"":[4,"d",[250,241],3217]},{"":[4,"d",[249,243],3234]},{"":[4,"d",[249,246],3250]},{"":[4,"d",[248,248],3267]},{"":[4,"d",[248,249],3284]},{"":[2,"c",3327]},{"":[3,"s","rgb(0, 0, 128)",5348]},{"":[3,"s","rgb(0, 0, 128)",5348]},{"":[5,[214,79],"b",5824]},{"":[4,"d",[203,79],5833]},{"":[4,"d",[186,80],5850]},{"":[4,"d",[171,84],5868]},{"":[4,"d",[155,91],5883]},{"":[4,"d",[127,106],5901]},{"":[4,"d",[80,132],5917]},{"":[4,"d",[42,164],5935]},{"":[4,"d",[25,194],5951]},{"":[4,"d",[19,217],5966]},{"":[4,"d",[19,244],5983]},{"":[4,"d",[24,264],6000]},{"":[4,"d",[33,281],6018]},{"":[4,"d",[42,290],6034]},{"":[4,"d",[53,297],6050]},{"":[4,"d",[67,303],6070]},{"":[4,"d",[76,307],6087]},{"":[4,"d",[90,313],6104]},{"":[4,"d",[108,320],6121]},{"":[4,"d",[141,328],6138]},{"":[4,"d",[183,339],6154]},{"":[4,"d",[224,346],6171]},{"":[4,"d",[249,347],6187]},{"":[4,"d",[269,343],6205]},{"":[4,"d",[290,335],6221]},{"":[4,"d",[307,326],6237]},{"":[4,"d",[319,314],6255]},{"":[4,"d",[327,300],6271]},{"":[4,"d",[330,287],6287]},{"":[4,"d",[334,268],6304]},{"":[4,"d",[337,245],6321]},{"":[4,"d",[338,233],6338]},{"":[4,"d",[342,215],6354]},{"":[4,"d",[342,197],6370]},{"":[4,"d",[342,179],6388]},{"":[4,"d",[341,159],6404]},{"":[4,"d",[336,141],6421]},{"":[4,"d",[328,123],6438]},{"":[4,"d",[314,101],6454]},{"":[4,"d",[296,83],6471]},{"":[4,"d",[273,72],6488]},{"":[4,"d",[256,66],6504]},{"":[4,"d",[242,63],6522]},{"":[4,"d",[231,61],6538]},{"":[4,"d",[213,60],6555]},{"":[4,"d",[198,60],6571]},{"":[4,"d",[181,60],6588]},{"":[4,"d",[169,62],6604]},{"":[4,"d",[164,62],6621]},{"":[4,"d",[163,63],6638]},{"":[4,"d",[162,66],6655]},{"":[4,"d",[162,67],6673]},{"":[4,"d",[160,72],6688]},{"":[4,"d",[159,75],6706]},{"":[2,"c",6953]},{"":[5,[204,69],"b",7177]},{"":[4,"d",[204,67],7301]},{"":[4,"d",[202,65],7317]},{"":[4,"d",[196,56],7335]},{"":[4,"d",[182,42],7351]},{"":[4,"d",[171,31],7367]},{"":[4,"d",[167,28],7384]},{"":[4,"d",[167,26],7400]},{"":[4,"d",[170,25],7417]},{"":[4,"d",[181,23],7434]},{"":[4,"d",[193,20],7451]},{"":[4,"d",[201,17],7467]},{"":[4,"d",[205,16],7485]},{"":[4,"d",[207,14],7501]},{"":[4,"d",[208,13],7518]},{"":[4,"d",[208,12],7534]},{"":[2,"c",7553]},{"":[5,[267,80],"b",7841]},{"":[4,"d",[268,80],7852]},{"":[4,"d",[272,80],7867]},{"":[4,"d",[275,80],7885]},{"":[4,"d",[286,81],7901]},{"":[4,"d",[300,85],7918]},{"":[4,"d",[311,88],7934]},{"":[4,"d",[319,90],7952]},{"":[4,"d",[321,91],7967]},{"":[4,"d",[322,92],7985]},{"":[4,"d",[325,93],8001]},{"":[4,"d",[334,94],8018]},{"":[4,"d",[352,94],8035]},{"":[4,"d",[370,93],8052]},{"":[4,"d",[382,88],8078]},{"":[4,"d",[387,84],8095]},{"":[2,"c",8097]},{"":[5,[345,176],"b",8448]},{"":[4,"d",[346,178],8453]},{"":[4,"d",[346,179],8468]},{"":[4,"d",[346,181],8485]},{"":[4,"d",[346,184],8502]},{"":[4,"d",[350,192],8518]},{"":[4,"d",[361,199],8536]},{"":[4,"d",[384,208],8552]},{"":[4,"d",[407,215],8569]},{"":[4,"d",[424,219],8585]},{"":[4,"d",[435,222],8602]},{"":[4,"d",[440,224],8615]},{"":[4,"d",[442,225],8632]},{"":[4,"d",[443,227],8649]},{"":[4,"d",[446,231],8667]},{"":[4,"d",[450,237],8683]},{"":[4,"d",[454,244],8699]},{"":[4,"d",[463,255],8716]},{"":[4,"d",[468,264],8733]},{"":[4,"d",[471,268],8749]},{"":[2,"c",8753]},{"":[5,[64,133],"b",9394]},{"":[4,"d",[64,131],9432]},{"":[4,"d",[63,126],9450]},{"":[4,"d",[58,115],9466]},{"":[4,"d",[55,105],9484]},{"":[4,"d",[51,98],9500]},{"":[4,"d",[50,92],9516]},{"":[4,"d",[49,85],9533]},{"":[4,"d",[47,79],9549]},{"":[4,"d",[43,70],9567]},{"":[4,"d",[41,64],9587]},{"":[4,"d",[37,60],9604]},{"":[4,"d",[36,59],9620]},{"":[2,"c",9681]}]]}}';
      }
      var data = CJSON.parse(storedData);
      WbUi.setMaxTime(data["recordingTime"]);
      Wb.recordingTime = data["recordingTime"];
      Wb.subtractTime = data["subtractTime"];
      Wb.lastEndTime = data["lastEndTime"];
      Wb.events = data["events"];
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
