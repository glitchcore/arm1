/*
  Copyright (c) 2014 Greg James, Brian Silverman, Barry Silverman, Ed Spittles
*/

/*
URL options:
    http://visual6502.org/stage/varm_dev/armgpu.html?ls=0
    http://visual6502.org/stage/varm_dev/armgpu.html?nl=1&ls=1
ls=0    layer buffer start index
nl=3    number of layer buffers to draw

frame-rate throttle:  macros.js
           setTimeout(go, 60);
display of phase and registers: support.js  fpdcontent
    ChipPinTable, RegisterTable
*/

/*
TODO:
6  resize the 3d view as the window resizes or pops out
7  thick 3d chip geometry, like the NaCl version.
8  tablet controls: rotate, pan, zoom
   ontouchstart ontouchend ontouchmove
   the iOS documentation is pretty good and in this case Apple is pretty standards compliant.
9  node selection / hilighting
10 hit testing
11 display a loading graphic until chip geom comes in
*/

var version = '019';
var urlDir = 'bin/';

//                    XYZ  UV
var numPosPerVert   = 3;
var numCoordPerVert = 3 +  2;

var loaded = false;

var gl;
var csp = {};   // chip state program
var stp = {};   // stipple program

var trianglesIb;
var linesIb;
var startLayer, numLayersToDraw;


// For details about reading the .bin data files, see the offline: 
//   makeGeomFromPatterns_Web.py
// 
var coordReqs = {};
var coordReqArray = [];
var raStart;

// l0-l7.bin
var layerReqs = [];
var layerGeoms = [];
var numActiveDownloads = 0;
var numDownloads = 0;

// l0: 'ntransistor'
// l1: 'metal1'
// l2: 'ndiffusion'
// l3: 'polysilicon'
// l4: 'metal2'
// l5: 'pdiffusion'
// l6: 'metal3'
// l7: 'ptransistor'

var onColsVARM =
    [224, 255, 0, 255,    // ntran
     240, 240, 240, 128,  // metal 1
     153, 0, 0, 255,      // ndiff
     0, 224, 96, 255,     // poly
     200, 220, 200, 128,  // metal 2
     0, 0, 153, 255,      // pdiff
     50, 50, 50, 255,     // metal 3
     112, 128, 0, 255];   // ptran

var offColsVARM =
    [112, 128, 0, 255,    // ntran
     120, 100, 100, 70,   // metal 1
     112, 0, 0, 255,      // ndiff
     0, 112, 48, 255,     // poly
     100, 120, 100, 102,  // metal 2
     0, 0, 112, 255,      // pdiff
     25, 25, 25, 255,     // metal 3
     224, 255, 0, 255];   // ptran

var hiColsVARM =
    [255, 255, 160, 255,  // ntran
     255, 0, 0, 220,      // metal 1
     255, 0, 0, 255,      // ndiff
     0, 255, 112, 255,    // poly
     255, 0, 0, 220,      // metal 2
     0, 0, 255, 255,      // pdiff
     25, 25, 25, 255,     // metal 3
     255, 255, 160, 255]; // ptran

var hiOffColsVARM = 
    [112, 128, 0, 255,    // ntran
     0, 255, 0, 220,      // metal 1
     112, 0, 0, 255,      // ndiff
     0, 112, 48, 255,     // poly
     0, 255, 0, 220,      // metal 2
     0, 0, 112, 255,      // pdiff
     25, 25, 25, 255,     // metal 3
     224, 255, 0, 255];   // ptran

var layerStippleOffset =
    [0,  // ntran
     1,  // metal 1, blue
     0,  // ndiff
     0,  // poly, red
     0,  // metal 2, yellow
     1,  // pdiff
     0,  // metal 3, vias, should be opposite blue
     0]; // ptran

// Alternate colors to match the ARM1's original design environment:
// Compass Design Automation's layout editor.
var oa = 255;
var onColsCDA =
    [240, 120, 0,   oa,    // ntran
     20,  20,  240, oa,    // metal 1, blue
     20,  180, 240, oa,    // ndiff, blue-green
     250, 20,  20,  oa,    // poly, red
     200, 200, 0,   oa,    // metal 2, yellow
     0,   230, 120, oa,    // pdiff green-blue
     40,  40, 180,  oa,    // metal 3, vias
     240, 70, 0,    oa];   // ptran

var fa = 150;
var offColsCDA =
    [240, 120, 0, fa,     // ntran
     20, 20, 240, fa,     // metal 1, blue
     20, 180, 240, fa,    // ndiff
     250, 80, 80, fa,     // poly
     200, 200, 0, fa,     // metal 2, yellow
     0, 230, 120, fa,     // pdiff
     40, 40, 180, fa,     // metal 3, vias
     240, 70, 0, fa];     // ptran

var hiColsCDA =
    [255, 255, 160, 255,  // ntran
     255, 0, 0, 220,      // metal 1
     255, 0, 0, 255,      // ndiff
     0, 255, 112, 255,    // poly
     255, 0, 0, 220,      // metal 2
     0, 0, 255, 255,      // pdiff
     25, 25, 25, 255,     // metal 3
     255, 255, 160, 255]; // ptran

var hiOffColsCDA =
    [112, 128, 0, 255,    // ntran
     0, 255, 0, 220,      // metal 1
     112, 0, 0, 255,      // ndiff
     0, 112, 48, 255,     // poly
     0, 255, 0, 220,      // metal 2
     0, 0, 112, 255,      // pdiff
     25, 25, 25, 255,     // metal 3
     224, 255, 0, 255];   // ptran

var clearColorVARM = [0,0,0,1];
var grayLevel = 0.96;
var clearColorCDA = [grayLevel, grayLevel, grayLevel, 1.0];
var colorTextureDirty = true;
var useCdaColors = false;
var clearColor = clearColorVARM;
var onColors = onColsVARM;
var offColors = offColsVARM;
var hiOffColors = hiOffColsVARM;
var hiColors = hiColsVARM;

var texSizeU = 128;
var texSizeV = 128;
var chipStateTexels = new Uint8Array(texSizeU * texSizeV * 1);
var chipStateTexelsDirty = true;
var chipStateTexture = -1;
var colorTexels = new Uint8Array(8 * 8 * 4);
var colorTexture = -1;

// 4 floats for camera orientation quaternion
var camQuat = [0, 0, 0, 1];
var eyeVec3 = [0, 0, 1.6];       // 1.6 * 0.025 to start zoomed in
var modVec3 = [-0.09, 0.08, 0];

// perspective or orthogonal projection matrix
// TODO: get canvasAspectWoH from armgpu namespace object
var canvasAspectWoH = 1.0;
var farZ = 50.0;
var projMat = perspectiveMat4(60.0, canvasAspectWoH, 0.001, farZ);

var modelMat = new Float32Array(16);
var tmpMat = new Float32Array(16);

// model-view matrix
var mvMat = new Float32Array(16);

// model-view-project matrix
var mvpMat = new Float32Array(16);
var mvpMatDirty = true;

var keyFlags = 0;  // Object.create(null);
var KF_A  = 1 << 0;
var KF_S  = 1 << 1;
var KF_D  = 1 << 2;
var KF_W  = 1 << 3;
var KF_Z  = 1 << 4;
var KF_X  = 1 << 5;
var KF_RR = 1 << 6;

//-----------------------------------------------------------------------------

window.onload = init;

function init() {

    var canvas = document.getElementById("gl-canvas");
    // Antialiasing should be on by default, depends on the browser
    //gl = WebGLUtils.setupWebGL(canvas, {antialias:true} );
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
    }

    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clearColor(clearColor[0],clearColor[1],clearColor[2],clearColor[3]);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    csp.id = initShaders(gl, "vsh_chip_state", "fsh_chip_state");
    var prg = csp;
    var id = prg.id;
    prg.va_position  = gl.getAttribLocation(id, "va_position");
    prg.va_texCoord0 = gl.getAttribLocation(id, "va_texCoord0"); 
    prg.vu_mvp       = gl.getUniformLocation(id, "vu_mvp");
    prg.stateSamp    = gl.getUniformLocation(id, "t_state");
    prg.colorSamp    = gl.getUniformLocation(id, "t_layerColors");

    stp.id = initShaders(gl, "vsh_chip_state_stipple", "fsh_chip_state_stipple");
    prg = stp;
    id = prg.id;
    prg.va_position      = gl.getAttribLocation(id, "va_position");
    prg.va_texCoord0     = gl.getAttribLocation(id, "va_texCoord0"); 
    prg.vu_mvp           = gl.getUniformLocation(id, "vu_mvp");
    prg.stateSamp        = gl.getUniformLocation(id, "t_state");
    prg.colorSamp        = gl.getUniformLocation(id, "t_layerColors");
    prg.fu_stippleOffset = gl.getUniformLocation(id, "fu_stippleOffset");
    prg.fu_stippleFac    = gl.getUniformLocation(id, "fu_stippleFac");

    if (urlHas("cdaColors")) {
        useCdaColors = false;
        toggleColor();
    }

    loadBinaryData();
    render();
}

function replaceInner(elemName, html) {
    var elem = document.getElementById(elemName);
    elem.innerHTML = html;
}

function addInner(elemName, html) {
    var elem = document.getElementById(elemName);
    elem.innerHTML += html;
}

var urlParam = function(name, w) {
    w = w || window;
    var rx = new RegExp('[\&|\?]' + name + '=([^\&\#]+)'),
        val = w.location.search.match(rx);
    return !val ? '' : val[1];
}

var urlInt = function(name, w) {
    w = w || window;
    var rx = new RegExp('[\&|\?]' + name + '=([^\&\#]+)'),
        val = w.location.search.match(rx);
    return !val ? 0 : parseInt(val[1]);
}

var urlHas = function(name, w) {
    w = w || window;
    return w.location.search.search(name) >= 0;
}

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

function guardedRequestAnimFrame() {
    if (!(keyFlags & KF_RR)) {
        requestAnimFrame(render);
        keyFlags |= KF_RR;
    }
}

function setVizNodeValues(nodes) {
    //replaceInner('nodes-dbg', nodeValues.toString().slice(0,40));
    // TODO: tmp - no hilighting
    var hiliteNodeIndex = -1;

    var len = nodes.length;
    for (var i = 0; i < len; ++i) {
        var nodeValue = 0;
        if (nodes[i].state) {
            if (i == hiliteNodeIndex && i > 0) {
                nodeValue = 160;
            }
            else {
                nodeValue = 128;
            }
        }
        else if (i == hiliteNodeIndex && i > 0) {
            nodeValue = 32;
        }

        chipStateTexels[i] = nodeValue;
    }

    chipStateTexelsDirty = true;
    guardedRequestAnimFrame(render);
}

function setCameraOrientation(orientationQuat) {
    //replaceInner('camera-dbg', 'CAMERA QUAT: ' + orientationQuat.toString());

    if (orientationQuat != null && 
        orientationQuat != camQuat &&
        orientationQuat.length == 4) {
        camQuat = orientationQuat;
        mvpMatDirty = true;
        guardedRequestAnimFrame(render);
    }
}

function zoomCamera(delta) {
    var dz = Math.max(Math.abs(eyeVec3[2] * 0.05, 0.005));
    eyeVec3[2] += -delta * dz;
    eyeVec3[2] = clamp(eyeVec3[2], -farZ*0.9, farZ*0.9);
    //replaceInner('camera-dbg', 'eyeVec3[2]= ' + eyeVec3[2]);
    mvpMatDirty = true;
    guardedRequestAnimFrame(render);
}

function onKeyDown(str, code) {
    //replaceInner('camera-dbg', 'onKeyDown: "' + str + '" ' + code + '<br>');
    if (str == 'w' || str == 'W') {
        keyFlags |= KF_W;
    }
    else if (str == 's' || str == 'S') {
        keyFlags |= KF_S;
    }
    else if (str == 'a' || str == 'A') {
        keyFlags |= KF_A;
    }
    else if (str == 'd' || str == 'D') {
        keyFlags |= KF_D;
    }
    else if (str == 'z' || str == 'Z') {
        keyFlags |= KF_Z;
    }
    else if (str == 'x' || str == 'X') {
        keyFlags |= KF_X;
    }

    updateFromKeyFlags();
}

function onKeyUp(str, code) {
    if (str == 'w' || str == 'W') {
        keyFlags &= ~KF_W;
    }
    else if (str == 's' || str == 'S') {
        keyFlags &= ~KF_S;
    }
    else if (str == 'a' || str == 'A') {
        keyFlags &= ~KF_A;
    }
    else if (str == 'd' || str == 'D') {
        keyFlags &= ~KF_D;
    }
    else if (str == 'z' || str == 'Z') {
        keyFlags &= ~KF_Z;
    }
    else if (str == 'x' || str == 'X') {
        keyFlags &= ~KF_X;
    }
}

function updateFromKeyFlags() {
    if (keyFlags != 0) {
        var dlt = 0.006 * eyeVec3[2] + 0.0004;
        if (keyFlags & KF_W) modVec3[1] += dlt;
        if (keyFlags & KF_S) modVec3[1] -= dlt;
        if (keyFlags & KF_A) modVec3[0] -= dlt;
        if (keyFlags & KF_D) modVec3[0] += dlt;
        if (keyFlags & KF_Z) zoomCamera(-0.4);
        if (keyFlags & KF_X) zoomCamera( 0.4);
        mvpMatDirty = true;
        guardedRequestAnimFrame(render);
    }
}

function toggleColor() {
    useCdaColors = !useCdaColors;
    if (useCdaColors) {
        clearColor = clearColorCDA;
        onColors = onColsCDA;
        offColors = offColsCDA;
        hiOffColors = hiOffColsCDA;
        hiColors = hiColsCDA;
    }
    else {
        clearColor = clearColorVARM;
        onColors = onColsVARM;
        offColors = offColsVARM;
        hiOffColors = hiOffColsVARM;
        hiColors = hiColsVARM;
    }

    if (gl != null) {
        gl.clearColor(clearColor[0],clearColor[1],clearColor[2],clearColor[3]);
    }
    colorTextureDirty = true;
    guardedRequestAnimFrame(render);
}

function setupViz() {
    armgpu.setVizNodeValues = setVizNodeValues;
    armgpu.setCameraOrientation = setCameraOrientation;
}

function downloadMsg(inc) {
    numActiveDownloads += inc;
    if (inc > 0) numDownloads += inc;
}

//-----------------------------------------------------------------------------
// Function object, used to hold downloaded binary data and keep track of
// the status of the download.

function Uint16Request (urlStr) {
    this.urlStr = urlStr;
    this.success = false;
    this.u16Array = null;
    var obj = this;
    var req = new XMLHttpRequest();
    req.onload = function(e) {
        var arrayBuffer = req.response;
        var data = new DataView(arrayBuffer);
        var bpe = Uint16Array.BYTES_PER_ELEMENT;
        obj.u16Array = new Uint16Array(data.byteLength / bpe);        
        var len = obj.u16Array.length;
        for (var i = 0; i < len; ++i) {
            obj.u16Array[i] = data.getUint16(i * bpe, true);
        }
        obj.success = true;
        guardedRequestAnimFrame(render);
        downloadMsg(-1);
        // Option to print success msg
        //addInner('msg2', 'Read ' + obj.urlStr + ' ' + obj.u16Array.length + ' bytes<br>');
    };
    req.open("GET", urlStr);
    req.responseType = "arraybuffer";
    req.send();
    downloadMsg(1);
}

function Uint32Request (urlStr) {
    this.urlStr = urlStr;
    this.success = false;
    this.u32Array = null;
    var obj = this;
    var req = new XMLHttpRequest();
    req.onload = function(e) {
        var arrayBuffer = req.response;
        var data = new DataView(arrayBuffer);
        var bpe = Uint32Array.BYTES_PER_ELEMENT;
        obj.u32Array = new Uint32Array(data.byteLength / bpe);        
        var len = obj.u32Array.length;
        for (var i = 0; i < len; ++i) {
            obj.u32Array[i] = data.getUint32(i * bpe, true);
        }
        obj.success = true;
        guardedRequestAnimFrame(render);
        downloadMsg(-1);
        // Option to print success msg
        //addInner('msg2', 'Read ' + obj.urlStr + ' ' + obj.u32Array.length + ' bytes<br>');
    };
    req.open("GET", urlStr);
    req.responseType = "arraybuffer";
    req.send();
    downloadMsg(1);
}

function fileName(urlStr) {
    return urlStr.slice(urlStr.lastIndexOf('/') + 1)
}

//-----------------------------------------------------------------------------

function loadBinaryData() {

    /*
    if (window.location.origin.toLowerCase().search('www.visual6502') >= 0) {
        urlDir = 'http://www.visual6502.org/sim/varm/';
    }
    */
    
    //replaceInner('msg2', 'urlDir = ' + urlDir);

    var layerFileNames = ['l0.bin', 'l1.bin', 'l2.bin', 'l3.bin',
                          'l4.bin', 'l5.bin', 'l6.bin', 'l7.bin'];

    for (var i = 0; i < layerFileNames.length; ++i) {
        var urlStr = urlDir + layerFileNames[i];
        layerReqs[i] = new Uint16Request(urlStr);
    }

    coordReqs.tdReq = new Uint16Request(urlDir + 'td.bin');
    coordReqs.rlReq = new Uint16Request(urlDir + 'rl.bin');
    coordReqs.rwReq = new Uint16Request(urlDir + 'rw.bin');
    coordReqs.rhReq = new Uint16Request(urlDir + 'rh.bin');
    coordReqs.rtReq = new Uint16Request(urlDir + 'rt.bin');
    coordReqs.llReq = new Uint16Request(urlDir + 'll.bin');
    coordReqs.ilReq = new Uint32Request(urlDir + 'il.bin');
    coordReqs.neReq = new Uint32Request(urlDir + 'ne.bin');

    coordReqArray = [coordReqs.tdReq, coordReqs.rlReq, coordReqs.rwReq,
                     coordReqs.rhReq, coordReqs.rtReq, coordReqs.llReq,
                     coordReqs.ilReq, coordReqs.neReq];
}

function GeomBuffers(layerId, vb, ib, numIndices) {
    this.layerId = layerId;
    this.vb = vb;
    this.ib = ib;
    this.numIndices = numIndices;
}

function decodeGeom(layerId, u16Req) {

    var td = coordReqs.tdReq.u16Array;
    var rl = coordReqs.rlReq.u16Array;
    var rt = coordReqs.rtReq.u16Array;
    var rw = coordReqs.rwReq.u16Array;
    var rh = coordReqs.rhReq.u16Array;
    var ll = coordReqs.llReq.u16Array;
    var il = coordReqs.ilReq.u32Array;
    var ne = coordReqs.neReq.u32Array;

    // TODO: z levels for thick geom
    var patArray = u16Req.u16Array;
    var len = patArray.length;
    var z_min = 0.0;
    var numRects = 0;
    for (var i = 0; i < len; i+=5) {
        var rectArrayInd = patArray[i+3];
        numRects += ll[rectArrayInd];
    }

    var vertexXYZs = new Float32Array(numRects * 4 * numCoordPerVert);
    var vpos = 0;
/*
        switch (layerId)
        {
        case 1:
            threeD = 0;
            z_min = 0.015f; z_max = 0.03f;
            break;
        case 4:
            threeD = 0;
            z_min = 0.03f; z_max = 0.04f;
            break;
        case 6:
            threeD = 0;
            z_min = 0.00f; z_max = 0.045f;
            break;
        }
*/
    var min_x = 9e9;
    var min_y = 9e9;
    var max_x = -9e9;
    var max_y = -9e9;
    var qtru = 0.25 / texSizeU;
    var qtrv = 0.25 / texSizeV;

    for (var i = 0; i < len;) {
        var x = patArray[i]; ++i;
        var y = patArray[i]; ++i;
        var node = patArray[i]; ++i;
        var rectArrayInd = patArray[i]; ++i;
        var triArrayInd = patArray[i]; ++i;
        var rectIndArrayStartPos = raStart[rectArrayInd];
        //var numRects = ll[rectArrayInd];
        var numPatRects = ll[rectArrayInd];
        var rectIndArrayEndPos = rectIndArrayStartPos + numPatRects;

        // LayerId is an integer on top of the node id coordinate
        // It has no effect on the node texel used, since the state
        // texture wraps around in the U axis.
        var u = qtru + (node % texSizeU) / texSizeU + layerId;
        var v = qtrv + Math.floor(node / texSizeU) / texSizeV;
        //if (i < 10) addInner('msg2', 'u ' + u + ' v ' + v + '<br>');

        // make two triangles for every rectangle
        for (var riPos = rectIndArrayStartPos; 
             riPos < rectIndArrayEndPos;
             ++riPos) {
            var ri = il[riPos];
            var top   = rt[ri] + y;
            var left  = rl[ri] + x;
            var bot   = top + rh[ri];
            var right = left + rw[ri];
            // l,r,t,b in [-1,1]
            var t =  1 - 2 * top / 32768.0;
            var l = -1 + 2 * left / 32768.0;
            var b =  1 - 2 * bot / 32768.0;
            var r = -1 + 2 * right / 32768.0;
            min_x = l < min_x ? l : min_x;
            max_x = r > max_x ? r : max_x;
            min_y = t < min_y ? t : min_y;
            max_y = b > max_y ? b : max_y;
            // l,t = 1,0,0
            // r,t = 0,1,0
            // l,b = 0,0,1
            // r,b = 1,0,0
            vertexXYZs[vpos] = l; ++vpos;         // x
            vertexXYZs[vpos] = t; ++vpos;         // y
            vertexXYZs[vpos] = z_min; ++vpos;     // z
            vertexXYZs[vpos] = u; ++vpos;         // u
            vertexXYZs[vpos] = v; ++vpos;         // v
            //----
            vertexXYZs[vpos] = r; ++vpos;
            vertexXYZs[vpos] = t; ++vpos;
            vertexXYZs[vpos] = z_min; ++vpos;
            vertexXYZs[vpos] = u; ++vpos;         // u
            vertexXYZs[vpos] = v; ++vpos;         // v
            //----
            vertexXYZs[vpos] = r; ++vpos;
            vertexXYZs[vpos] = b; ++vpos;
            vertexXYZs[vpos] = z_min; ++vpos;
            vertexXYZs[vpos] = u; ++vpos;         // u
            vertexXYZs[vpos] = v; ++vpos;         // v
            //----
            vertexXYZs[vpos] = l; ++vpos;
            vertexXYZs[vpos] = b; ++vpos;
            vertexXYZs[vpos] = z_min; ++vpos;
            vertexXYZs[vpos] = u; ++vpos;         // u
            vertexXYZs[vpos] = v; ++vpos;         // v
        }
    }

    // Create vertex buffer with a max of 'vertsPerBuffer' vertices,
    // since we are limited by 16-bit indices
    //
    var numVerts = numRects * 4;
    // -64 so wont overflow for a single rect when making cuboid
    // Number should be divisible by 4 so we always have a complete
    // rectangle.
    //
    var vertsPerBuffer = 0x10000 - 64;
    var numBuffers = Math.floor(numVerts / vertsPerBuffer) + 1;

    var start = 0;
    for (var bufInd = 0; 
         bufInd < numBuffers && start < numVerts;
         ++bufInd) {
        var numBufVerts = Math.min(numVerts-start, vertsPerBuffer);
        // end is exclusive, num = end - start
        var slice = vertexXYZs.subarray(start * numCoordPerVert,
                                        (start + numBufVerts) * numCoordPerVert);

        var vb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vb);
        gl.bufferData(gl.ARRAY_BUFFER, slice, gl.STATIC_DRAW);

        // layerId is written in the GeomBuffers function
        var lind = layerGeoms.length;
        layerGeoms[lind] =
            new GeomBuffers(layerId, vb, null, 6 * numBufVerts / 4);
        layerGeoms[lind].fileName = fileName(u16Req.urlStr);
        layerGeoms[lind].u16PatArray = patArray;
        layerGeoms[lind].stippleOffset = layerStippleOffset[layerId];
        
        start = start + numBufVerts;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function setIdentityMat4(mat) {
    mat[0]  = 1; mat[1]  = 0; mat[2]  = 0; mat[3]  = 0;
    mat[4]  = 0; mat[5]  = 1; mat[6]  = 0; mat[7]  = 0;
    mat[8]  = 0; mat[9]  = 0; mat[10] = 1; mat[11] = 0;
    mat[12] = 0; mat[13] = 0; mat[14] = 0; mat[15] = 1;
}

function computeModelViewTransform() {

    setIdentityMat4(modelMat);
    modelMat[12] = -modVec3[0];
    modelMat[13] = -modVec3[1];
    modelMat[14] = -modVec3[2];
    setIdentityMat4(tmpMat);

    // camQuat may be not normalized
    var sqrx = camQuat[0] * camQuat[0];
    var sqry = camQuat[1] * camQuat[1];
    var sqrz = camQuat[2] * camQuat[2];
    var sqrw = camQuat[3] * camQuat[3];
    var sqrLength = 1.0 / (sqrx + sqry + sqrz + sqrw);

    tmpMat[0]  = (sqrx - sqry - sqrz + sqrw) * sqrLength;
    tmpMat[5]  = (-sqrx + sqry - sqrz + sqrw) * sqrLength;
    tmpMat[10] = (-sqrx - sqry + sqrz + sqrw) * sqrLength;

    var temp1 = camQuat[0] * camQuat[1];
    var temp2 = camQuat[2] * camQuat[3];
    tmpMat[1] = 2.0 * (temp1 + temp2) * sqrLength;
    tmpMat[4] = 2.0 * (temp1 - temp2) * sqrLength;

    temp1 = camQuat[0] * camQuat[2];
    temp2 = camQuat[1] * camQuat[3];
    tmpMat[2] = 2.0 * (temp1 - temp2) * sqrLength;
    tmpMat[8] = 2.0 * (temp1 + temp2) * sqrLength;
    temp1 = camQuat[1] * camQuat[2];
    temp2 = camQuat[0] * camQuat[3];
    tmpMat[6]  = 2.0 * (temp1 + temp2) * sqrLength;
    tmpMat[9]  = 2.0 * (temp1 - temp2) * sqrLength;
    tmpMat[3]  = 0.0;
    tmpMat[7]  = 0.0;
    tmpMat[11] = 0.0;
    tmpMat[15] = 1.0;

    multMat4(mvMat, modelMat, tmpMat);
    
    // Concatenate the translation to the eye point.
    mvMat[12] += -eyeVec3[0];
    mvMat[13] += -eyeVec3[1];
    mvMat[14] += -eyeVec3[2];
}

// outMat = a . b
// outMat must not be an alias of a or b
function multMat4(outMat, a, b) {
    var a0, a1, a2, a3;
    a0 = a[0];
    a1 = a[1];
    a2 = a[2];
    a3 = a[3];
    outMat[0] = a0 * b[0] + a1 * b[4] + a2 * b[8]  + a3 * b[12];
    outMat[1] = a0 * b[1] + a1 * b[5] + a2 * b[9]  + a3 * b[13];
    outMat[2] = a0 * b[2] + a1 * b[6] + a2 * b[10] + a3 * b[14];
    outMat[3] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3 * b[15];

    a0 = a[4];
    a1 = a[5];
    a2 = a[6];
    a3 = a[7];
    outMat[4] = a0 * b[0] + a1 * b[4] + a2 * b[8]  + a3 * b[12];
    outMat[5] = a0 * b[1] + a1 * b[5] + a2 * b[9]  + a3 * b[13];
    outMat[6] = a0 * b[2] + a1 * b[6] + a2 * b[10] + a3 * b[14];
    outMat[7] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3 * b[15];

    a0 = a[8];
    a1 = a[9];
    a2 = a[10];
    a3 = a[11];
    outMat[8]  = a0 * b[0] + a1 * b[4] + a2 * b[8]  + a3 * b[12];
    outMat[9]  = a0 * b[1] + a1 * b[5] + a2 * b[9]  + a3 * b[13];
    outMat[10] = a0 * b[2] + a1 * b[6] + a2 * b[10] + a3 * b[14];
    outMat[11] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3 * b[15];

    a0 = a[12];
    a1 = a[13];
    a2 = a[14];
    a3 = a[15];
    outMat[12] = a0 * b[0] + a1 * b[4] + a2 * b[8]  + a3 * b[12];
    outMat[13] = a0 * b[1] + a1 * b[5] + a2 * b[9]  + a3 * b[13];
    outMat[14] = a0 * b[2] + a1 * b[6] + a2 * b[10] + a3 * b[14];
    outMat[15] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a3 * b[15];
}

function frustumMat4(left, right, bottom, top, near, far) {
    var mat = new Float32Array(16);
    var delta_x = right - left;
    var delta_y = top - bottom;
    var delta_z = far - near;

//    if ((near <= 0) || (far <= 0) ||
//        (delta_x <= 0) || (delta_y <= 0) || (delta_z <= 0))
//        return;

    mat[0] = 2.0 * near / delta_x;
    mat[1] = 0;
    mat[2] = 0;
    mat[3] = 0;

    mat[5] = 2.0 * near / delta_y;
    mat[4] = 0;
    mat[6] = 0;
    mat[7] = 0;

    mat[8]  =  (right + left) / delta_x;
    mat[9]  =  (top + bottom) / delta_y;
    mat[10] = -(near + far) / delta_z;
    mat[11] = -1.0;

    mat[14] = -2.0 * near * far / delta_z;
    mat[12] = 0;
    mat[13] = 0;
    mat[15] = 0;
    return mat;
}

function perspectiveMat4(fovDeg, aspectWoH, nearZ, farZ) {
    var pi = 3.1415926535897932384;
    var frustum_h = Math.tan((fovDeg * 0.5) / 180.0 * pi) * nearZ;
    var frustum_w = frustum_h * aspectWoH;
    return frustumMat4(-frustum_w, frustum_w, -frustum_h, frustum_h, nearZ, farZ);
}

function setColorTexture(on_colors, off_colors, hi_off_colors, hi_colors) {
    var created = false
    if (colorTexture == -1) {
        colorTexture = gl.createTexture();
        created = true;
    }

    for (var y = 0; y < 8; ++y) {
        for (var x = 0; x < 8; ++x) {
            for (var ci = 0; ci < 4; ++ci) {
                var chanVal = on_colors[x*4 + ci];
                if (y < 4)
                    chanVal = off_colors[x*4 + ci];
                if (y == 1)
                    chanVal = hi_off_colors[x*4 + ci];
                if (y == 5)
                    chanVal = hi_colors[x*4 + ci];
                colorTexels[y*8*4 + x*4 + ci] = chanVal;
            }
        }
    }

    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.texImage2D(gl.TEXTURE_2D, 
                  0, 
                  gl.RGBA,
                  8, 
                  8, 
                  0, 
                  gl.RGBA,
                  gl.UNSIGNED_BYTE,
                  colorTexels);

    if (created) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        // Wrap the texture so it repeats.  This allows us to use the integer 
        // part of the texture coordinate to hold the chip layer, while the 
        // fractional part holds the node ID.
        // gl.CLAMP_TO_EDGE, gl.REPEAT
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    colorTextureDirty = false;
}

function prepRender() {

    if (mvpMatDirty) {
        computeModelViewTransform();
        multMat4(mvpMat, mvMat, projMat);
        mvpMatDirty = false;
    }

    if (chipStateTexelsDirty) {
        if (chipStateTexture = -1) {
            chipStateTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, chipStateTexture);
            gl.texImage2D(gl.TEXTURE_2D, 
                          0, 
                          gl.LUMINANCE,
                          128, 
                          128, 
                          0, 
                          gl.LUMINANCE,
                          gl.UNSIGNED_BYTE,
                          chipStateTexels);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            // Wrap the texture so it repeats.  This allows us to use the integer 
            // part of the texture coordinate to hold the chip layer, while the 
            // fractional part holds the node ID.
            // gl.CLAMP_TO_EDGE, gl.REPEAT
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);            
        }
        else {
            gl.bindTexture(gl.TEXTURE_2D, chipStateTexture);
            gl.texImage2D(gl.TEXTURE_2D, 
                          0,                 // level
                          gl.LUMINANCE,      // internal format
                          128,               // width
                          128,               // height
                          0,                 // border
                          gl.LUMINANCE,      // format
                          gl.UNSIGNED_BYTE,  // type of input data
                          chipStateTexels);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);            
        chipStateTexelsDirty = false;
    }

    if (colorTexture == -1 || colorTextureDirty) {
        setColorTexture(onColors, offColors, hiOffColors, hiColors);
    }
}

function render() {
    if (gl == null || gl == undefined) {
        init();
    }

    if (!loaded) {
        var coordReqDoneCount = 0;
        for (var i = 0; i < coordReqArray.length; ++i) {
            if (coordReqArray[i].success) {
                ++coordReqDoneCount;
            }
        }

        var layerDoneCount = 0;
        for (var i = 0; i < layerReqs.length; ++i) {
            if (layerReqs[i].success) {
                ++layerDoneCount;
            }
        }

        if (layerDoneCount == layerReqs.length &&
            layerReqs.length > 0 &&   // thank you MSFT IE
            coordReqDoneCount == coordReqArray.length) {
            loaded = true;

            // Make array of start locations
            // ll.bin is list of index list lengths for each pattern
            // il.bin is all index lists packed together.  Each value is the 
            //   32-bit index of a rectangle.
            //
            var ll = coordReqs.llReq.u16Array;
            raStart = new Uint32Array(ll.length);
            var pos = 0;
            var lllen = ll.length;
            for (var i = 0; i < lllen; ++i) {
                raStart[i] = pos;
                pos += ll[i];
            }

            // One index buffer for all plain triangles made of consecutive
            // vertices in a vertex buffer of rectangles
            var numInds = (0x10000 - 64) * 6;
            var tris = new Uint16Array(numInds);
            var vInd = 0;
            for (var i = 0; i < numInds; vInd += 4) {
                tris[i] = vInd + 0; ++i;
                tris[i] = vInd + 1; ++i;
                tris[i] = vInd + 2; ++i;
                tris[i] = vInd + 0; ++i;
                tris[i] = vInd + 2; ++i;
                tris[i] = vInd + 3; ++i;
            }

            trianglesIb = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, trianglesIb);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tris, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

            // Another index buffer for drawing lines around each rectangle, to mimick
            // the look of Compass Design Automation's layout editor.

            var numLineInds = (0x10000 - 64) * 8;
            var lines = new Uint16Array(numLineInds);
            vInd = 0;
            for (var i = 0; i < numLineInds; vInd += 4) {
                lines[i] = vInd + 0; ++i;
                lines[i] = vInd + 1; ++i;
                lines[i] = vInd + 1; ++i;
                lines[i] = vInd + 2; ++i;
                lines[i] = vInd + 2; ++i;
                lines[i] = vInd + 3; ++i;
                lines[i] = vInd + 3; ++i;
                lines[i] = vInd + 0; ++i;
            }

            linesIb = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, linesIb);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);


            // Decode geometry from the binary files            
            for (var i = 0; i < layerReqs.length; ++i) {
                decodeGeom(i, layerReqs[i]);
            }

            //addInner('msg2', 'Created ' + layerGeoms.length + ' layerGeoms<br>');
            startLayer = clamp(urlInt('ls'), 0, layerGeoms.length);
            numLayersToDraw = clamp(urlInt('nl'), 0, layerGeoms.length);
            if (numLayersToDraw == 0) numLayersToDraw = layerGeoms.length;
        }
    }

    if (gl != null) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    if (loaded) {
        prepRender();

        var prg = csp;
        if (useCdaColors) {
            var prg = stp;
        }
        gl.useProgram(prg.id);
        gl.uniformMatrix4fv(prg.vu_mvp, false, mvpMat);
        gl.uniform1i(prg.stateSamp, 0);
        gl.uniform1i(prg.colorSamp, 1);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, chipStateTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);

        for (var i = startLayer; 
             i < layerGeoms.length && i < startLayer + numLayersToDraw;
             ++i) {
            gl.bindBuffer(gl.ARRAY_BUFFER, layerGeoms[i].vb);
            gl.enableVertexAttribArray(prg.va_position);
            gl.vertexAttribPointer(prg.va_position, numPosPerVert, gl.FLOAT,
                                   false, numCoordPerVert*4, 0);
            gl.enableVertexAttribArray(prg.va_texCoord0);
            gl.vertexAttribPointer(prg.va_texCoord0, 2, gl.FLOAT,
                                   false, numCoordPerVert*4, numPosPerVert*4);
            if (useCdaColors) {
                gl.uniform1f(prg.fu_stippleOffset, layerGeoms[i].stippleOffset);
                gl.uniform1f(prg.fu_stippleFac, 1.0);
            }

            if (layerGeoms[i].ib != null) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layerGeoms[i].ib);
                gl.drawElements(gl.TRIANGLES, layerGeoms[i].numIndices,
                                gl.UNSIGNED_SHORT, 0);
            }
            else {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, trianglesIb);
                gl.drawElements(gl.TRIANGLES, layerGeoms[i].numIndices,
                                gl.UNSIGNED_SHORT, 0);
            }

            if (useCdaColors) {
                // outline the stipple graphics, no stipple pattern
                if (eyeVec3[2] < 1.6 * 0.085) {
                    gl.uniform1f(prg.fu_stippleOffset, 1);
                    gl.uniform1f(prg.fu_stippleFac, 0.0);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, linesIb);
                    gl.drawElements(gl.LINES, (layerGeoms[i].numIndices/6)*8, 
                                    gl.UNSIGNED_SHORT, 0);
                }
            }
        }

/*
  // Disable alpha blend while we draw layer ID data
  glDisable(GL_BLEND);

  glUseProgram(shader_nodeId_);
  glUniformMatrix4fv(vshl_nodeId_mvp_, 1, GL_FALSE, mvp_matrix_);
  glUniform4f(vshl_nodeId_scale_, scale_, scale_, scale_, scale_);
  glBindTexture(GL_TEXTURE_2D, 0);
  // TODO: enable this to draw node ID values, but first, we need code
  // to switch to offscreen render target.
  //drawBuffers(vshl_nodeId_pos_, vshl_nodeId_tc0_, vshl_nodeId_offset_);
  glBindFramebuffer(GL_FRAMEBUFFER, frameBuffer_);
  glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);
  drawBuffers(vshl_nodeId_pos_, vshl_nodeId_tc0_, vshl_nodeId_offset_);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
*/

        gl.disableVertexAttribArray(prg.va_position);
        gl.disableVertexAttribArray(prg.va_texCoord0);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    keyFlags &= ~KF_RR;
    updateFromKeyFlags();
}
