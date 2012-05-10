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
        'strokeColor' : Wb.context.strokeStyle,
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
        storedData = '{"f":"cjson","t":[[0,"type"],[1,"time"],[1,"color","time"],[1,"coord","time"],[0,"coord","type","time"],[0,"recordingTime","subtractTime","lastEndTime","strokeColor","events"]],"v":{"":[6,7578,1336632578629,1336632586375,"#ffff99",[{"":[3,"s","#000000",0]},{"":[5,[311,187],"b",218]},{"":[4,"d",[310,187],238]},{"":[4,"d",[294,200],255]},{"":[4,"d",[270,219],271]},{"":[4,"d",[255,233],287]},{"":[4,"d",[254,238],304]},{"":[4,"d",[254,242],321]},{"":[4,"d",[262,251],337]},{"":[4,"d",[284,260],354]},{"":[4,"d",[295,265],371]},{"":[4,"d",[299,269],388]},{"":[4,"d",[299,275],404]},{"":[4,"d",[292,288],421]},{"":[4,"d",[288,295],438]},{"":[4,"d",[280,305],455]},{"":[4,"d",[280,311],471]},{"":[4,"d",[284,314],487]},{"":[4,"d",[293,318],504]},{"":[4,"d",[305,321],521]},{"":[2,"c",527]},{"":[5,[356,299],"b",719]},{"":[4,"d",[359,291],721]},{"":[4,"d",[363,279],738]},{"":[4,"d",[364,269],754]},{"":[4,"d",[364,249],776]},{"":[4,"d",[364,227],792]},{"":[4,"d",[355,196],809]},{"":[4,"d",[333,163],826]},{"":[4,"d",[311,133],843]},{"":[4,"d",[298,111],860]},{"":[4,"d",[286,93],876]},{"":[4,"d",[281,86],893]},{"":[4,"d",[279,84],911]},{"":[4,"d",[276,84],926]},{"":[4,"d",[270,87],943]},{"":[4,"d",[252,104],962]},{"":[4,"d",[221,128],977]},{"":[4,"d",[197,150],993]},{"":[4,"d",[181,168],1012]},{"":[4,"d",[171,179],1027]},{"":[4,"d",[169,184],1043]},{"":[4,"d",[169,186],1060]},{"":[4,"d",[174,187],1076]},{"":[4,"d",[179,187],1092]},{"":[4,"d",[181,187],1109]},{"":[4,"d",[181,189],1125]},{"":[4,"d",[180,194],1142]},{"":[4,"d",[170,204],1159]},{"":[4,"d",[150,227],1175]},{"":[4,"d",[122,252],1192]},{"":[4,"d",[112,266],1209]},{"":[4,"d",[109,274],1226]},{"":[4,"d",[109,277],1243]},{"":[4,"d",[113,282],1259]},{"":[4,"d",[119,287],1276]},{"":[4,"d",[122,289],1293]},{"":[4,"d",[123,290],1310]},{"":[4,"d",[123,292],1325]},{"":[4,"d",[122,293],1342]},{"":[4,"d",[120,299],1359]},{"":[4,"d",[117,304],1376]},{"":[4,"d",[114,309],1393]},{"":[4,"d",[112,317],1411]},{"":[4,"d",[111,323],1427]},{"":[4,"d",[110,327],1443]},{"":[2,"c",1461]},{"":[5,[145,339],"b",1567]},{"":[4,"d",[150,342],1573]},{"":[4,"d",[156,342],1588]},{"":[4,"d",[167,344],1605]},{"":[4,"d",[187,344],1621]},{"":[4,"d",[209,343],1638]},{"":[4,"d",[240,335],1656]},{"":[4,"d",[275,326],1672]},{"":[4,"d",[293,322],1688]},{"":[4,"d",[303,320],1705]},{"":[4,"d",[312,320],1722]},{"":[4,"d",[316,321],1738]},{"":[4,"d",[321,324],1755]},{"":[4,"d",[330,334],1772]},{"":[4,"d",[345,341],1798]},{"":[4,"d",[365,347],1815]},{"":[4,"d",[385,350],1831]},{"":[4,"d",[400,350],1843]},{"":[4,"d",[411,346],1861]},{"":[4,"d",[417,328],1877]},{"":[4,"d",[420,305],1893]},{"":[4,"d",[421,286],1911]},{"":[4,"d",[422,265],1926]},{"":[4,"d",[423,246],1943]},{"":[4,"d",[423,221],1959]},{"":[4,"d",[419,193],1976]},{"":[4,"d",[411,169],1993]},{"":[4,"d",[407,151],2010]},{"":[4,"d",[401,138],2026]},{"":[4,"d",[397,131],2043]},{"":[4,"d",[392,125],2060]},{"":[4,"d",[379,118],2077]},{"":[4,"d",[366,109],2094]},{"":[4,"d",[354,103],2110]},{"":[4,"d",[345,97],2127]},{"":[4,"d",[340,92],2144]},{"":[4,"d",[338,89],2160]},{"":[4,"d",[331,82],2178]},{"":[4,"d",[322,71],2193]},{"":[4,"d",[313,57],2210]},{"":[4,"d",[300,46],2227]},{"":[4,"d",[283,38],2243]},{"":[4,"d",[267,34],2260]},{"":[4,"d",[238,33],2278]},{"":[4,"d",[214,33],2295]},{"":[4,"d",[181,36],2311]},{"":[4,"d",[158,45],2327]},{"":[4,"d",[140,53],2344]},{"":[4,"d",[134,58],2361]},{"":[4,"d",[131,61],2378]},{"":[4,"d",[130,68],2394]},{"":[4,"d",[129,74],2411]},{"":[4,"d",[129,84],2429]},{"":[4,"d",[130,89],2445]},{"":[4,"d",[137,102],2460]},{"":[4,"d",[145,110],2478]},{"":[4,"d",[152,115],2494]},{"":[4,"d",[157,123],2511]},{"":[4,"d",[157,136],2544]},{"":[4,"d",[149,146],2562]},{"":[4,"d",[138,159],2578]},{"":[4,"d",[130,167],2595]},{"":[4,"d",[123,174],2612]},{"":[2,"c",2628]},{"":[3,"s","rgb(255, 255, 153)",4387]},{"":[3,"s","rgb(255, 255, 153)",4387]},{"":[5,[502,280],"b",4803]},{"":[4,"d",[502,279],4805]},{"":[4,"d",[502,275],4821]},{"":[4,"d",[502,269],4840]},{"":[4,"d",[501,251],4854]},{"":[4,"d",[498,232],4873]},{"":[4,"d",[493,214],4888]},{"":[4,"d",[490,202],4905]},{"":[4,"d",[490,194],4921]},{"":[4,"d",[489,187],4938]},{"":[4,"d",[489,179],4955]},{"":[4,"d",[487,173],4973]},{"":[4,"d",[486,167],4988]},{"":[4,"d",[484,159],5005]},{"":[4,"d",[484,154],5022]},{"":[4,"d",[484,150],5039]},{"":[4,"d",[483,145],5055]},{"":[4,"d",[483,142],5076]},{"":[2,"c",5094]},{"":[5,[446,37],"b",5816]},{"":[4,"d",[445,37],5838]},{"":[4,"d",[442,38],5857]},{"":[4,"d",[436,42],5872]},{"":[4,"d",[429,52],5888]},{"":[4,"d",[423,64],5906]},{"":[4,"d",[421,78],5922]},{"":[4,"d",[421,86],5939]},{"":[4,"d",[425,90],5956]},{"":[4,"d",[428,92],5973]},{"":[4,"d",[432,92],5989]},{"":[4,"d",[434,92],6007]},{"":[4,"d",[436,91],6022]},{"":[4,"d",[436,89],6039]},{"":[4,"d",[436,91],6106]},{"":[4,"d",[437,94],6122]},{"":[4,"d",[441,106],6139]},{"":[4,"d",[450,120],6156]},{"":[4,"d",[459,132],6173]},{"":[4,"d",[464,141],6189]},{"":[4,"d",[466,148],6206]},{"":[4,"d",[468,153],6223]},{"":[4,"d",[468,158],6239]},{"":[4,"d",[464,168],6256]},{"":[4,"d",[452,180],6274]},{"":[4,"d",[438,200],6289]},{"":[4,"d",[430,208],6306]},{"":[4,"d",[428,209],6322]},{"":[4,"d",[428,206],6339]},{"":[4,"d",[431,189],6356]},{"":[4,"d",[435,161],6373]},{"":[4,"d",[438,145],6390]},{"":[4,"d",[438,132],6406]},{"":[4,"d",[443,122],6423]},{"":[4,"d",[457,113],6439]},{"":[4,"d",[478,111],6457]},{"":[4,"d",[488,109],6472]},{"":[4,"d",[492,109],6489]},{"":[4,"d",[492,106],6640]},{"":[4,"d",[490,104],6657]},{"":[2,"c",6664]}]]}}';
      } else {
        storedData = '{"f":"cjson","t":[[0,"type"],[1,"time"],[1,"color","time"],[1,"coord","time"],[0,"coord","type","time"],[0,"recordingTime","subtractTime","lastEndTime","strokeColor","events"]],"v":{"":[6,7320,1336630713446,1336630720774,"#ff9900",[{"":[3,"s","#000000",0]},{"":[5,[196,127],"b",2847]},{"":[4,"d",[191,126],2854]},{"":[4,"d",[188,126],2870]},{"":[4,"d",[185,126],2887]},{"":[4,"d",[182,132],2904]},{"":[4,"d",[176,148],2921]},{"":[4,"d",[170,168],2937]},{"":[4,"d",[170,180],2953]},{"":[4,"d",[173,188],2971]},{"":[4,"d",[182,195],2987]},{"":[4,"d",[193,197],3004]},{"":[4,"d",[204,197],3022]},{"":[4,"d",[217,196],3042]},{"":[4,"d",[226,192],3060]},{"":[4,"d",[235,192],3075]},{"":[4,"d",[237,193],3091]},{"":[4,"d",[238,195],3108]},{"":[4,"d",[238,200],3124]},{"":[4,"d",[241,208],3142]},{"":[4,"d",[243,213],3157]},{"":[4,"d",[246,217],3175]},{"":[4,"d",[253,220],3192]},{"":[4,"d",[265,222],3207]},{"":[4,"d",[277,225],3225]},{"":[4,"d",[293,232],3241]},{"":[4,"d",[297,235],3258]},{"":[4,"d",[298,237],3275]},{"":[4,"d",[300,240],3292]},{"":[4,"d",[304,244],3308]},{"":[4,"d",[313,246],3325]},{"":[4,"d",[324,247],3342]},{"":[4,"d",[336,247],3359]},{"":[4,"d",[347,246],3376]},{"":[4,"d",[353,243],3392]},{"":[4,"d",[363,237],3410]},{"":[2,"c",3428]},{"":[3,"s","rgb(255, 153, 0)",4971]},{"":[3,"s","rgb(255, 153, 0)",4971]},{"":[5,[373,72],"b",5208]},{"":[4,"d",[371,74],5223]},{"":[4,"d",[365,81],5240]},{"":[4,"d",[362,87],5256]},{"":[4,"d",[362,96],5272]},{"":[4,"d",[365,102],5290]},{"":[4,"d",[374,107],5310]},{"":[4,"d",[390,112],5326]},{"":[4,"d",[406,118],5343]},{"":[4,"d",[414,120],5360]},{"":[4,"d",[417,122],5377]},{"":[4,"d",[418,123],5393]},{"":[4,"d",[418,124],5411]},{"":[4,"d",[418,127],5427]},{"":[4,"d",[420,131],5443]},{"":[4,"d",[421,135],5460]},{"":[4,"d",[422,138],5476]},{"":[4,"d",[424,142],5494]},{"":[4,"d",[426,148],5511]},{"":[4,"d",[429,155],5527]},{"":[4,"d",[431,166],5546]},{"":[4,"d",[434,178],5565]},{"":[4,"d",[439,193],5578]},{"":[4,"d",[451,211],5596]},{"":[4,"d",[467,224],5615]},{"":[4,"d",[477,230],5628]},{"":[4,"d",[478,233],5648]},{"":[4,"d",[478,235],5661]},{"":[4,"d",[475,241],5680]},{"":[4,"d",[473,247],5699]},{"":[4,"d",[470,253],5712]},{"":[4,"d",[470,259],5730]},{"":[4,"d",[468,266],5749]},{"":[4,"d",[464,278],5762]},{"":[4,"d",[459,295],5780]},{"":[4,"d",[457,309],5799]},{"":[4,"d",[457,319],5813]},{"":[4,"d",[455,325],5830]},{"":[4,"d",[449,332],5849]},{"":[4,"d",[436,337],5861]},{"":[4,"d",[420,341],5879]},{"":[4,"d",[407,343],5899]},{"":[4,"d",[396,344],5911]},{"":[4,"d",[382,344],5929]},{"":[4,"d",[365,343],5949]},{"":[4,"d",[344,337],5961]},{"":[4,"d",[322,331],5979]},{"":[4,"d",[302,321],6000]},{"":[4,"d",[277,312],6012]},{"":[4,"d",[247,301],6029]},{"":[4,"d",[222,292],6050]},{"":[4,"d",[205,289],6063]},{"":[4,"d",[193,286],6080]},{"":[4,"d",[185,284],6096]},{"":[4,"d",[175,281],6112]},{"":[4,"d",[165,278],6129]},{"":[4,"d",[155,274],6146]},{"":[4,"d",[143,268],6162]},{"":[4,"d",[129,260],6179]},{"":[4,"d",[116,252],6196]},{"":[4,"d",[108,242],6212]},{"":[4,"d",[98,226],6229]},{"":[4,"d",[88,207],6245]},{"":[4,"d",[77,191],6262]},{"":[4,"d",[74,175],6279]},{"":[4,"d",[74,159],6295]},{"":[4,"d",[77,144],6328]},{"":[4,"d",[95,114],6345]},{"":[4,"d",[102,104],6361]},{"":[4,"d",[113,94],6379]},{"":[4,"d",[130,84],6394]},{"":[4,"d",[151,74],6412]},{"":[4,"d",[181,71],6430]},{"":[4,"d",[199,72],6445]},{"":[4,"d",[207,75],6463]},{"":[4,"d",[209,76],6480]},{"":[4,"d",[209,78],6495]},{"":[4,"d",[209,79],6512]},{"":[2,"c",6515]}]]}}';
      }
      var data = CJSON.parse(storedData);
      WbUi.setMaxTime(data["recordingTime"]);
      Wb.recordingTime = data["recordingTime"];
      Wb.subtractTime = data["subtractTime"];
      Wb.lastEndTime = data["lastEndTime"];
      $.fn.colorPicker.changeColor(data["strokeColor"]);
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
