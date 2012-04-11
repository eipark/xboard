/**
 * UI for HTML5 Canvas Whiteboard
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
  
window.WhiteboardUi = {
  
  canvasElement: null, // jQuery element for canvas
  /**
   * The default ids and classes for the element
   * configurations are the index names used in this
   * array.
   * 
   * If names or classes have different names, they
   * should be defined in the script initialization,
   * that is WhiteboardUi.init() function.
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
  },
  
  /**
   * Initializes the Whiteboard UI script.
   * 
   * @param canvasElement The canvas jQuery element.
   * @param elemconf The element configuration array.
   * This array can contain any of the elements defined
   * in WhiteboardUi.elemConf. If the element names differ
   * from the default array indexes, they should be given
   * in this array. Only the differing elements should be
   * defined.
   */
  init: function(canvasElement, elemconf) {
    this.canvasElement = canvasElement;
    Whiteboard.init(canvasElement.attr("id"));
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
   * Resolves the element name from WhiteboardUi.elemConf.
   * If index defined by ind parameter can be found in that
   * array and the array's value is returned. Otherwise
   * the ind parameter itself is returned.
   * 
   * @param ind The element's index name in WhiteboardUi.elemConf
   * @return The elements correct name
   */
  getElementName: function(ind) {
    if (WhiteboardUi.elementConf[ind] === undefined || 
        WhiteboardUi.elementConf[ind] === null) {
      return ind;
    }
    return WhiteboardUi.elementConf[ind];
  },
  
  /**
   * Resolves the jQuery element with the defined id which
   * is resolved by WhiteboardUi.getElementName function.
   * 
   * @param ind The element's index name in WhiteboardUi.elemConf
   * or the wanted id name that's not included in that array.
   * @return The jQuery element with the resolved id
   */
  getElement: function(ind) {
    return $('#' + WhiteboardUi.getElementName(ind));
  },
  
  /**
   * Adds all the UI's needed action listeners for buttons
   * and other UI elements.
   */
  addListeners: function() {
    WhiteboardUi.getElement('button_pencil').mousedown(function() {
      Whiteboard.setStrokeStyle(WhiteboardUi.getElement('input_color').attr("value"));
      WhiteboardUi.activatePencil();
    });
    WhiteboardUi.getElement('button_color').mousedown(function() {
      Whiteboard.setStrokeStyle(WhiteboardUi.getElement('input_color').attr("value"));
    });
    WhiteboardUi.getElement('button_eraser').mousedown(WhiteboardUi.activateEraser);
    WhiteboardUi.getElement('button_animate').mousedown(Whiteboard.animate);
    WhiteboardUi.getElement('recorder').mousedown(WhiteboardUi.toggleRecord);
    WhiteboardUi.getElement('button_undo').mousedown(Whiteboard.undo);
    //remove onmousedown from html and make this work
  },
  
  toggleRecord: function() {
    var elt = $("#recorder");
    if (elt.hasClass("not_recording")) {
      elt.removeClass("not_recording").addClass("is_recording").html("Pause Record");
      Whiteboard.record();
    } else {
      elt.removeClass("is_recording").addClass("not_recording").html("Record");
      Whiteboard.pauseRecord();
    }
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
      var xrel = Whiteboard.getRelative().width;
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
      var yrel = Whiteboard.getRelative().height;
      var canvasy = cssy * yrel;
      return canvasy;
  },
  
  /**
   * Returns the canvas element to its default definition
   * without any extra classes defined by any of the selected
   * UI tools.
   */
  changeTool: function() {
    WhiteboardUi.canvasElement.unbind();
    WhiteboardUi.canvasElement.removeClass(WhiteboardUi.getElementName('pencil_active'));
    WhiteboardUi.canvasElement.removeClass(WhiteboardUi.getElementName('eraser_active'));
  },
  
  /**
   * Activates pencil tool and adds pencil_active class
   * to canvas element.
   * 
   * @param event The event that has been executed to perform
   * this action
   */
  activatePencil: function(event) {
    WhiteboardUi.changeTool();
    WhiteboardUi.canvasElement.bind("mousedown", WhiteboardUi.beginPencilDraw);
    WhiteboardUi.canvasElement.addClass(WhiteboardUi.getElementName('pencil_active'));
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
      Whiteboard.canvasFunction("beginPencilDraw", WhiteboardUi.getX(event), WhiteboardUi.getY(event));
      WhiteboardUi.canvasElement.bind("mousemove", function(event) {
          Whiteboard.canvasFunction("pencilDraw", WhiteboardUi.getX(event), WhiteboardUi.getY(event));
      });
      WhiteboardUi.canvasElement.bind("mouseup", WhiteboardUi.endPencilDraw);
      WhiteboardUi.canvasElement.bind("mouseout", WhiteboardUi.endPencilDraw);
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
    WhiteboardUi.canvasElement.unbind("mousemove");
    WhiteboardUi.canvasElement.unbind("mouseup");
    WhiteboardUi.canvasElement.unbind("mouseout");
  },
  
  /**
   * Activates erasing tool and adds eraser_active class
   * to canvas element.
   * 
   * @param event The event that has been executed to perform
   * this action
   */
  activateEraser: function(event) {
    WhiteboardUi.changeTool();
    WhiteboardUi.canvasElement.bind("mousedown", WhiteboardUi.beginErasing);
    WhiteboardUi.canvasElement.addClass(WhiteboardUi.getElementName('eraser_active'));
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
      Whiteboard.canvasFunction("beginErasing", WhiteboardUi.getX(event), WhiteboardUi.getY(event));
      WhiteboardUi.canvasElement.bind("mousemove", function(event) {
          Whiteboard.canvasFunction("erasePoint", WhiteboardUi.getX(event), WhiteboardUi.getY(event));
      });
      WhiteboardUi.canvasElement.bind("mouseup", WhiteboardUi.endErasing);
      WhiteboardUi.canvasElement.bind("mouseout", WhiteboardUi.endErasing);
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
    WhiteboardUi.canvasElement.unbind("mousemove");
    WhiteboardUi.canvasElement.unbind("mouseup");
    WhiteboardUi.canvasElement.unbind("mouseout");
  },
};
})();
