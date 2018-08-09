
armgpu.Application = function() {
    /**
     * The function objects that get attached as event handlers.  These are
     * cached so that they can be removed when they are no longer needed.
     * @type {function}
     * @private
     */
    setupNodes();
    setupTransistors();
    setupParamsFromURL();

    // Dragger looks for mouse events on a document target.  If null, it looks
    // on the whole document.
    /*if (this.trackball_ == undefined) {
        this.trackball_ = new armgpu.Trackball();
        var webglCanvas = document.getElementById('gl-canvas');
        this.dragger_ = new armgpu.Dragger(webglCanvas);
        this.dragger_.addDragListener(this.trackball_);
    }*/
}

armgpu.Application.prototype.onLoad = function() {

    setupViz();

    // functions defined in support.js
    setupFrontPanel();
    setupMemoryTable();

    // functions defined in macros.js - TODO: move them?
    loadProgram();
    resetChip();

    if (document.addEventListener) {
        // IE9, Chrome, Safari, Opera
        document.addEventListener("mousewheel", MouseWheelHandler, false);
        // Firefox
        document.addEventListener("DOMMouseScroll", MouseWheelHandler, false);
    }
    else {
        // IE 6/7/8
        document.attachEvent("onmousewheel", MouseWheelHandler);
    }

    document.onkeydown = function(event) {
        //replaceInner('camera-dbg', 'KEYDOWN: ');
        var code = event.which || event.keyCode;
        var strn = String.fromCharCode(code);
        //addInner('camera-dbg', ' ' + strn);
        onKeyDown(strn, code);
    }

    document.onkeyup = function(event) {
        //replaceInner('camera-dbg', 'KEYUP: ' + event);
        var code = event.which || event.keyCode;
        var strn = String.fromCharCode(code);
        //addInner('camera-dbg', ' ' + strn);
        onKeyUp(strn, code);
    }

    var memoryInput = document.getElementById('memory_input');
    memoryInput.addEventListener('change', uploadMemory);

    memoryInput.onclick = function() {
        this.value = null;
    }
}

function MouseWheelHandler(e) {
    // cross-browser wheel delta
    var e = window.event || e; // old IE support
    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

    zoomCamera(delta);
    //replaceInner('camera-dbg', 'SCROLL DELTA: ' + delta + '<br>');

    // prevent the usual scroll-wheel scrolling
    // TODO: this doesn't stop window scrolling in Chrome 46.
    return false;
}

armgpu.Application.prototype.setNodes = function() {
    armgpu.setVizNodeValues(nodes);
}

/**
 * Asserts that cond is true; issues an alert and throws an Error otherwise.
 * @param {bool} cond The condition.
 * @param {String} message The error message issued if cond is false.
 */
armgpu.Application.prototype.assert = function(cond, message) {
    if (!cond) {
        message = "Assertion failed: " + message;
        alert(message);
        throw new Error(message);
    }
}

function onLoadArm() {
    armgpu.appInstance = new armgpu.Application();
    armgpu.appInstance.onLoad();
}

function setupParamsFromURL(){
    if(location.search=="")
        return
    var queryParts=location.search.slice(1).split('&');
    var userAddress = 0;
    for(var i = 0; i < queryParts.length; ++i) {
        var params = queryParts[i].split("=");
        if (params.length != 2) {
            break;
        }
        var name = params[0];
        // chrome sometimes adds trailing slash
        var value = params[1].replace(/\/$/,"");

        // be (relatively) forgiving in what we accept
        // developer quick and dirty startup
        // load a test program: Address, Data and Reset
        if (name == "a" && parseInt(value,16) != NaN) {
            userAddress = parseInt(value,16);
        }
        else if (name == "d" && 
                 value.match(/[0-9a-fA-F]*/)[0].length == value.length) {
            // data is in 32-bit words, as hex values, so groups of 8 digits
            for (var j = 0; j < value.length; j+=8) {
                userCode[userAddress] = parseInt(value.slice(j, j+8), 16);
                userAddress += 4;  // a byte address
            }
        }
    }
}

function setStatus(status){
    var statbox = document.getElementById('status');
    statbox.innerHTML = status;
}

function handleMessage(event){
    var message = event.data.split(':');
    if (message[0] == 'HILITE') {
        var node = parseInt(message[1], 10);
        var x = parseInt(message[2], 10);
        var y = parseInt(message[3], 10);
        if (node == 0) {
            setStatus('location x:' + Math.round(x) + ' y:'+ Math.round(y));
        }
        else {
            setStatus('node:' + node + 
                      ' (' + fixNodeName(nodenames[node]) + ') ' + 
                      'state: ' + readNodeValueAsString(node),
                      'location x:' + Math.round(x) + 
                      ' y:'+ Math.round(y));
        }   
    }
}

function fixNodeName(name){
    if (name.substr(0,4) == 'core') {
        var list = name.split('_');
        var str = list[list.length-1];
        if (str=='1' || str == '0') {
            str = list[list.length-2] + '_' + str;
        }
        return(str);
    }
    return name;
}
