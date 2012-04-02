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
	
	zoomrel: 1,
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
		pencil_active:		null,
		eraser_active:		null,
		rectangle_active:	null,
		oval_active:		null,
		
		// Element ids
		button_pencil:		null,
		button_color:		null,
		button_eraser:		null,
		button_zoomin:		null,
		button_zoomout:		null,
		button_zoom:		null,
		button_rotate:		null,
		button_animate:		null,
		button_undo:		null,
		button_shape:		null,
		button_rectangle:	null,
		button_oval:		null,
		button_saveas:		null,
		button_savepng:		null,
		button_savejpeg:	null,
		button_savebmp:		null,
		input_color:		null,
		input_rotation:		null,
		shape_menu:			null,
		saveas_menu:		null,
		zoom_element:		null,
		zoom_section:		null,
		zoom_amount:		null,
		zoom_slider:		null,
		zoom_bar:			null
	},
	/**
	 * Defines which normally hidden elements 
	 * are currently showing.
	 */
	activeElems: {
		shape_menu:		false,
		saveas_menu:	false,
		zoom:			false
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
		WhiteboardUi.getElement('button_zoomin').mousedown(Whiteboard.zoomin);
		WhiteboardUi.getElement('button_zoomout').mousedown(Whiteboard.zoomout);
		WhiteboardUi.getElement('button_zoom').mousedown(WhiteboardUi.zoomBar);
		WhiteboardUi.getElement('button_rotate').mousedown(function() {
		    var rot = parseInt(WhiteboardUi.getElement('input_rotation').attr("value"), 10);
			if (rot >= -360 && rot <= 360) {
				Whiteboard.rotate(rot);
			} else {
				alert("Rotation value between -360 and 360!");
			}
		});
		WhiteboardUi.getElement('button_animate').mousedown(Whiteboard.animate);
		//remove onmousedown from html and make this work
		//WhiteboardUi.getElement('button_undo').mousedown(Whiteboard.undo);
		WhiteboardUi.getElement('button_shape').mouseup(WhiteboardUi.shapeMenu);
		WhiteboardUi.getElement('button_rectangle').mousedown(function() {
			Whiteboard.setStrokeStyle(WhiteboardUi.getElement('input_color').attr("value"));
			WhiteboardUi.shapeMenu();
			WhiteboardUi.activateRectangle();
		});
		WhiteboardUi.getElement('button_oval').mousedown(function() {
			Whiteboard.setStrokeStyle(WhiteboardUi.getElement('input_color').attr("value"));
			WhiteboardUi.shapeMenu();
			WhiteboardUi.activateOval();
		});
		WhiteboardUi.getElement('button_saveas').mouseup(WhiteboardUi.saveasMenu);
		WhiteboardUi.getElement('button_savepng').mouseup(function() {
			WhiteboardUi.saveasMenu();
			Whiteboard.saveAs('png');
		});
		WhiteboardUi.getElement('button_savejpeg').mouseup(function() {
			WhiteboardUi.saveasMenu();
			Whiteboard.saveAs('jpeg');
		});
		WhiteboardUi.getElement('button_savebmp').mouseup(function() {
			WhiteboardUi.saveasMenu();
			Whiteboard.saveAs('bmp');
		});
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
		WhiteboardUi.canvasElement.removeClass(WhiteboardUi.getElementName('rectangle_active'));
		WhiteboardUi.canvasElement.removeClass(WhiteboardUi.getElementName('oval_active'));
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
	    Whiteboard.beginPencilDraw(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
	    WhiteboardUi.canvasElement.bind("mousemove", function(event) {
	        Whiteboard.pencilDraw(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
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
	    Whiteboard.beginErasing(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
	    WhiteboardUi.canvasElement.bind("mousemove", function(event) {
	        Whiteboard.erasePoint(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
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
	
	/**
	 * Shows or hides the zoom element depending on its
	 * current state.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	zoomBar: function(event) {
		var zoom = WhiteboardUi.getElement('zoom_element');
		if (WhiteboardUi.activeElems.zoom === false) {
			WhiteboardUi.activeElems.zoom = true;
			zoom.css('opacity', 0);
			zoom.css('display', 'block');
			zoom.animate({
				opacity: 1
			}, 150);
			WhiteboardUi.activateZoom();
		} else {
			WhiteboardUi.activeElems.zoom = false;
			zoom.animate({
				opacity: 0
			}, 150, function() {
				zoom.css('display', 'none');
			});
		}
	},
	
	/**
	 * Activates the zooming element to listen the dragging
	 * action that user performs on the zoom slider element.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	activateZoom: function() {
		var slider = WhiteboardUi.getElement('zoom_slider');
		var zoomSec = WhiteboardUi.getElement('zoom_section');
		var height = zoomSec.height() - slider.height();
		var sy = zoomSec.offset().top + zoomSec.height();
		
		slider.draggable({
			axis: 'y',
			containment: 'parent',
			drag: function(event, ui) {
				var amount = WhiteboardUi.getElement('zoom_amount');
				var ey = event.clientY;
				var px = zoomSec.height() - slider.height() - $(this).position().top;
				var zoom = 2 * px / height;
				WhiteboardUi.getElement('zoom_amount').html(parseInt(100 * zoom, 10) + "%");
			},
			stop: function(event, ui) {
				WhiteboardUi.performZoom();
			}
		});
	},
	
	/**
	 * Performs the zoom defined by the zoom slider.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	performZoom: function(event) {
		var zoom = parseInt(WhiteboardUi.getElement('zoom_amount').html(), 10) / 100;
		
		var rel = (1 + zoom) / WhiteboardUi.zoomrel;
		Whiteboard.zoom(rel);
		WhiteboardUi.zoomrel = 1 + zoom;
	},
	
	/**
	 * Opens or hides the shape selection menu depending
	 * on its current state.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	shapeMenu: function(event) {
		var menu = WhiteboardUi.getElement('shape_menu');
		if (WhiteboardUi.activeElems.shape_menu === false) {
			WhiteboardUi.activeElems.shape_menu = true;
			var wid = menu.css('width');
			var hei = menu.css('height');
			menu.css('width', '0');
			menu.css('height', '0');
			menu.css('display', 'block');
			menu.animate({ 
			    width: wid,
			    height: hei
			}, 150);
		} else {
			WhiteboardUi.activeElems.shape_menu = false;
			menu.animate({ 
			    opacity: 0
			}, 150, function() {
				menu.css('display', 'none');
				menu.css('opacity', '1');
			});
		}
	},
	
	/**
	 * Activates the rectangle drawing tool.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	activateRectangle: function(event) {
		WhiteboardUi.changeTool();
		WhiteboardUi.canvasElement.bind("mousedown", WhiteboardUi.beginRectangle);
		WhiteboardUi.canvasElement.addClass(WhiteboardUi.getElementName('rectangle_active'));
	},
	
	/**
	 * Begins rectangle drawing at the current point. This also
	 * adds mousemove event listener to the canvas element
	 * while user keeps the mouse down. After every mousemove
	 * event the rectangle is redrawn depending on the new
	 * mouse position.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	beginRectangle: function(event) {
		Whiteboard.beginShape(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
	    WhiteboardUi.canvasElement.bind("mousemove", function(event) {
	        Whiteboard.drawRectangle(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
	    });
		WhiteboardUi.canvasElement.bind("mouseup", WhiteboardUi.endRectangle);
	},
	
	/**
	 * Ends rectangle drawing after user releases the mouse
	 * button after starting the drawing.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	endRectangle: function(event) {
		Whiteboard.drawRectangle(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
		WhiteboardUi.canvasElement.unbind("mousemove");
		WhiteboardUi.canvasElement.unbind("mouseup");
	},
	
	/**
	 * Activates the oval drawing tool.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	activateOval: function(event) {
		WhiteboardUi.changeTool();
		WhiteboardUi.canvasElement.bind("mousedown", WhiteboardUi.beginOval);
		WhiteboardUi.canvasElement.addClass(WhiteboardUi.getElementName('oval_active'));
	},
	
	/**
	 * Begins oval drawing at the current point. This also
	 * adds mousemove event listener to the canvas element
	 * while user keeps the mouse down. After every mousemove
	 * event the oval is redrawn depending on the new
	 * mouse position.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	beginOval: function(event) {
		Whiteboard.beginShape(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
	    WhiteboardUi.canvasElement.bind("mousemove", function(event) {
	        Whiteboard.drawOval(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
	    });
	    WhiteboardUi.canvasElement.bind("mouseup", WhiteboardUi.endOval);
	},
	
	/**
	 * Ends oval drawing after user releases the mouse
	 * button after starting the drawing.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	endOval: function(event) {
		Whiteboard.drawOval(WhiteboardUi.getX(event), WhiteboardUi.getY(event));
		WhiteboardUi.canvasElement.unbind("mousemove");
		WhiteboardUi.canvasElement.unbind("mouseup");
	},
	
	/**
	 * Opens or hides the save as menu depending on its
	 * current state.
	 * 
	 * @param event The event that has been executed to perform
	 * this action
	 */
	saveasMenu: function(event) {
		var menu = WhiteboardUi.getElement('saveas_menu');
		if (WhiteboardUi.activeElems.saveas_menu === false) {
			WhiteboardUi.activeElems.saveas_menu = true;
			var wid = menu.css('width');
			var hei = menu.css('height');
			menu.css('width', '0');
			menu.css('height', '0');
			menu.css('display', 'block');
			menu.animate({ 
			    width: wid,
			    height: hei
			}, 150);
		} else {
			WhiteboardUi.activeElems.saveas_menu = false;
			menu.animate({ 
			    opacity: 0
			}, 150, function() {
				menu.css('display', 'none');
				menu.css('opacity', '1');
			});
		}
	}
	
};


/**
 * ======================
 *    JQUERY FUNCTIONS
 * ======================   
 */
/**
 * JQuery functioita voi lisätä näin. Tätä funktiota voisi nyt
 * kutsua mille tahansa elementille.
 * Esim:
 * $("#canvas").funktio(arvo);
 */
jQuery.fn.funktio = function(value) {
	// TODO
};

})();
