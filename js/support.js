/*
  Copyright (c) 2012 Brian Silverman, Barry Silverman, Ed Spittles
*/

// chip-specific support including user interface

var chipname='ARM1';
var chipsize=30000;

var memorySize = 1024;
var frameSize = 128;

var ChipWindow = null;
var MemoryTable;
var TtyRow;

var canvas;
var ctx;

var FrontPanelWindow;
var ChipPinTable;
var RegisterTable;
var FrontPanelDiv;
var PopoutFrontPanelDiv;
var Popoutstatbox;

var ttyAddress = 0x0000ff00;

var tty = "";

var selected; // for the memory editor

var logThese=[];
var logstream = Array();
var presetLogLists=[
    ['cycle'],
    ['phi1', 'phi2', 'address', 'databus', 'rw'],
    ['opc', 'pc', 'r14', 'psr'],
    ['a_bus', 'b_bus', 'shout'],
    ['ireg'],
    ['r3', 'r2', 'r1', 'r0'],
    ['mreq', 'seq'],
];

function initPopout(doc, content){
    doc.open();
    doc.write(content);
    doc.close();
}

function popoutFrontPanel() {
    // we can't open a popout from a non-blank URL because we could
    // not then access the DOM
    FrontPanelWindow = open("","FrontPanel","width=600,height=400");
    initPopout(
        FrontPanelWindow.document,
        '<html><head><title>Front Panel</title></head><body>' + 
            chipname + ' Front Panel:'+
            '<div id=frontpaneldiv>'+
            '</div>' +
            '</body></html>'
    );
    setupFrontPanel();
    updateFrontPanel();
    FrontPanelWindow.focus();
}

/*
  We could have one or two front panels to set up.
  The idea of the popout front panel is to allow an uncluttered fully 
  graphical view and allow for a two-monitor setup.  (Also allowed by
  the popout layout view)
*/
function setupFrontPanel(){
    var fpd = document.getElementById("frontpaneldiv");
    var fpdcontent= '<div class="ms" id="status" >' +
        '</div>' +
        '<div class="ms" >' + 
        '<table style="border-collapse:collapse;" id=pins></table></div>' +
        '<div class="ms" >' + 
        '<table style="border-collapse:collapse;" id=registers></table></div>';
    fpd.innerHTML = fpdcontent;
    fpd.setAttribute('style','font-size:small;');

    FrontPanelDiv = fpd;

    ChipPinTable  = document.getElementById("pins");
    RegisterTable = document.getElementById("registers");
    statbox = document.getElementById('status');

    if ((typeof FrontPanelWindow != 'undefined') &&
        (FrontPanelWindow.parent != null)) {
        PopoutFrontPanelDiv = FrontPanelWindow.document.getElementById("frontpaneldiv");
        PopoutFrontPanelDiv.innerHTML = fpd.innerHTML;
        Popoutstatbox = FrontPanelWindow.document.getElementById('status');
    }
}

/* we could have one or two front panels to update */
function updateFrontPanel(){
    updateChipPins();
    updateRegisters();
    updateMemoryTable();

    if (logThese.length>0) {
        updateLogbox(logThese);
    }

    // update the status
    var ab = readAddressBus();
    var machine1 =
        ' cycle:' + (cycle>>1) +
        ' A:' + hex(readAddressBus()) +
        ' D:' + hex(readDataBus()) +
        ' ' + (isPadHigh('rw')?'r':'w') +
        ' ' + CPUModeAsString() + 
        ' ' + StatusByteAsString();

    setStatus(machine1);

    //  selectCell(ab>>2);

    // finally, replicate to the popped-out front panel, if it exists
    if ((typeof FrontPanelWindow != 'undefined') && 
        (FrontPanelWindow.parent != null)) {
        PopoutFrontPanelDiv.innerHTML = FrontPanelDiv.innerHTML;
    }
}

var prevHzTimeStamp=0;
var prevHzCycleCount=0;
var prevHzEstimate1=1;
var prevHzEstimate2=1;
var HzSamplingRate=10;

// return an averaged speed: called periodically during normal running
function estimatedHz(){
    if(cycle%HzSamplingRate!=3)
        return prevHzEstimate1;
    var HzTimeStamp = now();
    var HzEstimate = (cycle-prevHzCycleCount+.01)/(HzTimeStamp-prevHzTimeStamp+.01);
    HzEstimate=HzEstimate*1000/2; // convert from phases per millisecond to Hz
    if(HzEstimate<5)
        HzSamplingRate=5;  // quicker
    if(HzEstimate>10)
        HzSamplingRate=10; // smoother
    prevHzEstimate2=prevHzEstimate1;
    prevHzEstimate1=(HzEstimate+prevHzEstimate1+prevHzEstimate2)/3; // wrong way to average speeds
    prevHzTimeStamp=HzTimeStamp;
    prevHzCycleCount=cycle;
    return prevHzEstimate1
}

function formatTT(s){
    return '<tt>' + s + '</tt>';
}

function updateChipPins(){
    var padlist1 = [
        'phi1', 'phi2', 'ale', 'abe', 'dbe', 'abrt', 'irq', 'firq',
        'reset', 'seq', 'm0', 'm1', 'bw', 'rw', 'opc', 'mreq', 'tran'
    ];
    var rowborder='style="border-top:thin solid white;"';
    var border='style="border-right:thin solid white;"';
    var mono='style="font-family:monospace;"';
    if (ChipPinTable == null) {
        setupFrontPanel();
    }
    ChipPinTable.innerHTML =
        list2zebraTableRow(1, padlist1, rowborder, border) +
        list2zebraTableRow(1, padlist1.map(function(x){return isPadHigh(x)?1:0}), mono, border);
}

function updateRegisters(){
    var reglists = [
        ['r0','r1','r2','r3','r4','r5','r6'],
        ['r7','r8','r9','r10','r11','r12','r13'],
        ['r14 (link)','r15 (pc)','r14_svc', 'r13_svc','r14_irq', 'r13_irq','r10_fiq'],
        ['r14_fiq','r13_fiq','r12_fiq','r11_fiq'],
    ];
    var row = [];
    var i=1;

    var rowborder='style="border-top:thin solid white;"';
    var border='style="border-right:thin solid white;"';
    var mono='style="font-family:monospace;"';
    for(var rl = 0; rl < reglists.length; rl++){
        row.push(list2zebraTableRow(i, reglists[rl], rowborder, border));
        row.push(list2zebraTableRow(i, reglists[rl].map(readRegHex), mono, border));
        i++;
    }

    RegisterTable.innerHTML = row.join("");
}

function StatusByteAsString(){
    return      (nodes[psrBits['psr_n']].state ? 'N':'n') +
        (nodes[psrBits['psr_z']].state ? 'Z':'z') +
        (nodes[psrBits['psr_c']].state ? 'C':'c') +
        (nodes[psrBits['psr_v']].state ? 'V':'v') +
        (nodes[psrBits['psr_irq']].state ? 'I':'i') +
        (nodes[psrBits['psr_fiq']].state ? 'F':'f') +
        (nodes[psrBits['psr_s1']].state ? 'S':'s') +
        (nodes[psrBits['psr_s0']].state ? 'S':'s');
}

function CPUModeAsString(){
    var m = (nodes[psrBits['psr_s1']].state ? 1:0)*2 + (nodes[psrBits['psr_s0']].state ? 1:0);
    var s = ['USR', 'FIQ', 'IRQ', 'SVC']
    return '(' + s[m] + ')';
}

function popoutChip(){
    // construct the undocked chip layout

    var fl;
    var frame;
    var chip;

    if (ChipWindow != null){
        teardown();
        return;
    }

    window.document.getElementById('monitor').value = "Pop in";
    frame = window.document.getElementById('armgpu_view');
    ChipWindow = open("","ARM V1","width=600,height=600");
    initPopout(ChipWindow.document, '<head></head><body><div id="float"><div></body>');
    ChipWindow.onbeforeunload = function(e){teardown();}
    fl = ChipWindow.document.getElementById('float');
    fl.appendChild(frame);

    //  window.document.getElementById('staticframe').style.visibility = '';
    ChipWindow.onresize = function(e){handleChipResize(e);}     
    armgpu.appInstance.module_ = ChipWindow.document.getElementById('armgpu');
    handleChipResize();
    ChipWindow.focus();
}

function popinChip(){
    // redock chip layout

    var fl;
    var frame;
    var chip;

    window.document.getElementById('monitor').value = "Pop out";
    //  window.document.getElementById('staticframe').style.visibility = 'hidden';
    frame = ChipWindow.document.getElementById('armgpu_view');
    fl = window.document.getElementById('mainlefthalf');
    fl.appendChild(frame);
    armgpu.appInstance.module_ = window.document.getElementById('armgpu');
}

function handleResize(e){
    // size the 'frame' element according to the browser window size
    // make bottom margin equal to left margin
        var doc = window.document;

    layoutsize = window.innerHeight - 20;
    doc.getElementById('armgpu_view').style.height = layoutsize + 'px';
    doc.getElementById('armgpu').height = layoutsize + 'px';
    doc.getElementById('armgpu_view').style.width = '1100px';
    doc.getElementById('armgpu').width =  '1100px';
}

function handleChipResize(e){
    // size the 'frame' element according to the browser window size
    // make bottom margin equal to left margin
        var doc = ChipWindow.document;

    layoutsize = ChipWindow.innerHeight - 20;
    doc.getElementById('armgpu_view').style.height = layoutsize + 'px';
    doc.getElementById('armgpu').height = layoutsize + 'px';
    doc.getElementById('armgpu_view').style.width = (ChipWindow.innerWidth - 20) + 'px';
    doc.getElementById('armgpu').width = (ChipWindow.innerWidth - 20) + 'px';
}

function setupMemoryTable(){
        // initially we direct ourselves to the docked-in memory table
        MemoryTable = document.getElementById('memtablepanel');
        TtyRow = document.getElementById('ttyrow');
        FrameBuffer = document.getElementById('framebuffer');

        canvas = document.getElementById("canvas_main");
        ctx = canvas.getContext('2d');

        // create and display the memory table
        updateMemoryTable();
        updateCanvas();
}

var memoryTableWidth = 4;

function chunk(value, size) {
    value = value.split("");

    var chunkCount = value.length / size;
    var res = [];

    for(var i = 0; i < chunkCount; i++) {
        res.push(value.slice(i * size, (i + 1) * size).join(""))
    }

    return res.join("_");
}

function updateMemoryTable(){
    var memrow = [];
    var base = 0;
    var width = memoryTableWidth;
    var height = memorySize/memoryTableWidth/4;
    for(var y = 0; y < height; y++){
        memrow.push(
            ["0x" + hex(base*4)+":"]
            .concat(
                memory.slice(base, base + width)
                    .map(hex)
                    .map(function(x) {return chunk(x, 2);})
            )
            .join(" ")
        );
        base = base + width;
    }

    MemoryTable.innerHTML = memrow.join("<br/>");

    TtyRow.innerHTML = ">" + tty + "<br/>";

    FrameBuffer.innerHTML = framebuffer.map(v => JSON.stringify(parseVector(v))).join("<br/>");
}

function parseVector(vector) {
    if(vector === 0) return {cmd: "eof"};

    var cmd = "eof";
    var color = "#000000";

    switch ((vector >> 24) & 0x0f) {
        case 1: cmd = "move"; break;
        case 2: cmd = "line"; break;
        case 3: cmd = "circle"; break;
    }

    switch ((vector >> 28) & 0x0f) {
        case 1: color = "#000000"; break;
        case 2: color = "#ffffff"; break;
        case 3: color = "#ff3333"; break;
        case 4: color = "#33ff33"; break;
        case 5: color = "#3333ff"; break;
    }

    return {
        cmd: cmd,
        color: color,
        x: (vector >> 16) & 0xff,
        y: (vector >> 8) & 0xff,
        r: (vector >> 0) & 0xff,
    }
}

const scale = 2;

function clearFrame() {
    for(var i = 0; i < frameSize; i++) {
        framebuffer[i] = 0;
    }

    updateCanvas();
}

function updateCanvas() {
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = "#33ff33";

    var idx = 0;

    while (framebuffer[idx]) {
        var cmd = parseVector(framebuffer[idx]);
        console.log("cmd:", cmd);

        ctx.strokeStyle = cmd.color;
        ctx.lineWidth = 3;

        switch(cmd.cmd) {
            case "move": ctx.moveTo(cmd.x * scale, cmd.y * scale); break;
            case "line": ctx.lineTo(cmd.x * scale, cmd.y * scale); break;
            default: break;
        }

        idx++;
    };

    ctx.stroke(); 
}

// each memory cell is sensitive to a mouse click, which then directs
// keypresses to this cell
function handleCellClick(e){
    var c = e.target;
    selectCell(c.addr);
    MemoryTable.focus();  // this is not working
}

// memory edit will get key events if a memory panel is visible
function isMemoryEditActive(){
    if (typeof selected == "undefined"){
        return false;
    }

    var memorytabindex = 0;
    var activetabindex = $('#paneltabs').tabs().tabs('option', 'selected');

    // not yet dealing with case of popout or kiosk mode
    if (activetabindex == memorytabindex){
        return true;
    } else {
        return false;
    }
}

// react to hex and navigation keypresses for memory cell edits
function cellKeydown(e){
    var c = e.keyCode;
    if(c==13) unselectCell();
    // space to step forward one cell
    else if(c==32) selectCell((selected+1) % 0x200);
    // backspace to step backward one cell (FIXME: we don't see this unless the memtable element has focus)
    else if(c==8) selectCell((selected-1+0x200) % 0x200);
    // cursor (arrow) keys (FIXME: also afflicted by the mysterious event stealer)
    else if(c==37) selectCell((selected-1+0x200) % 0x200);
    else if(c==38) selectCell((selected-memoryTableWidth+0x200) % 0x200);
    else if(c==39) selectCell((selected+1) % 0x200);
    else if(c==40) selectCell((selected+memoryTableWidth) % 0x200);
    // hex inputs
    else if((c>=48) && (c<58)) setCellValue(selected, (getCellValue(selected)<<4) + c - 48);
    else if((c>=65) && (c<71)) setCellValue(selected, (getCellValue(selected)<<4) + c - 55);
    mWrite(4*selected, getCellValue(selected));
}

function setCellValue(n, val){
    if(val==undefined)
        val=0x00;
    cellEl(n).innerHTML=hex(val);
}

function getCellValue(n){
    var cell=cellEl(n);
    if(cell == undefined)
        return 0
    return ~~("0x" + cellEl(n).innerHTML);
}

function selectCell(n){
    unselectCell();
    if(n>=0x200) return;
    if(typeof cellEl(n) == 'undefined'){
        console.log('selectCell bad call with '+n);
        return;
    }
    if(typeof cellEl(n).style == 'undefined'){
        console.log('selectCell bad style call with '+n);
        return;
    }
    cellEl(n).style.background = '#ff8'; // yellow
    selected = n;
}

function unselectCell(){
    if(typeof selected == "undefined") return;
    cellEl(selected).style.background = '#fff'; // white
    selected = undefined;
    //  window.onkeydown = undefined;
}

function cellEl(n){
    var rows = MemoryTable.childNodes[0].childNodes;
    var r = ~~(n/memoryTableWidth);
    var c = n % memoryTableWidth;
    if (r >= rows.length) return 0;
    if (c > rows[r].childNodes.length) return 0;
    var e = rows[r].childNodes[c+1];
    return e;
}

var helpBox;

function createHelpBox(){
    if (typeof helpBox != "undefined"){
        helpBoxVisible('');
        return;
    }   

    helpBox=document.createElement("div");

    helpBox.style.position="absolute";
    helpBox.style.left="5%";
    helpBox.style.top="5%";
    helpBox.style.width="90%";
    helpBox.style.borderRadius='10px';

    helpBox.style.color='white';
    helpBox.style.backgroundColor='black';

    helpBox.innerHTML="<div style=padding:1em>" +
        "Help window content <span style=float:right id=helpBoxClose><u>Close</u></span>" +
        "<p>" +
        "<p>Needs a table for two columns" +
        "<p>" +
        "<p>Explain keycodes for layout zoom/pan, also for run/step (if we have them)" +
        "<p>" +
        "<p>Thanks to ARM etc." +
        "</div>";

    helpBox.style.zIndex=200;
    helpBox.style.opacity=0.85;
    helpBox.style.visibility='hidden';
    helpBox.style.visibility='';
    document.body.appendChild(helpBox);
    document.getElementById('helpBoxClose').onmouseup = function() {
        helpBoxVisible("hidden");
    };
}

function helpBoxVisible(v){
    helpBox.style.visibility=v;
}

function signalSet(n){
    var signals=[];
    for (var i=0; (i<=n)&&(i<presetLogLists.length) ; i++){
        for (var j=0; j<presetLogLists[i].length; j++){
            signals.push(presetLogLists[i][j]);
        }
    }
    return signals;
}

// called direct from UI element
function updateLogList(names){
    // user supplied a list of signals, which we append to the set defined by loglevel
    logThese = signalSet(loglevel);
    if(typeof names == "undefined")
        // this is a UI call - read the text input
        names = document.getElementById('LogThese').value;
    else
        // this is an URL call - update the text input box
        document.getElementById('LogThese').value = names;
    names = names.split(/[\s,]+/);
    for(var i=0;i<names.length;i++){
        // could be a signal name, a node number, or a special name
        if(typeof busToString(names[i]) != "undefined")
            logThese.push(names[i]);
    }
    initLogbox(logThese);
}

// called direct from UI element
function updateLoglevel(value){
    loglevel = value;
    logThese = signalSet(loglevel);
    initLogbox(logThese);
}

var logbox;
function initLogbox(names){
    logbox=document.getElementById('logstream');
    if(logbox==null)return;

    names=names.map(function(x){return x.replace(/^-/,'')});
    logStream = [];
    logStream.push("<td class=header>" + names.join("</td><td class=header>") + "</td>");
    logbox.innerHTML = "<tr>"+logStream.join("</tr><tr>")+"</tr>";
}

var logboxAppend=true;

// can append or prepend new states to the log table
// when we reverse direction we need to reorder the log stream
function updateLogDirection(){
    var loglines=[];

    logboxAppend=!logboxAppend;

    if(logboxAppend)
        document.getElementById('LogUpDown').value='Log Up';
    else
        document.getElementById('LogUpDown').value='Log Down';

    // the first element is the header so we can't reverse()
    for (var i=1;i<logStream.length;i++) {
        loglines.unshift(logStream[i]);
    }
    loglines.unshift(logStream[0]);
    logStream=loglines;
    logbox.innerHTML = "<tr>"+logStream.join("</tr><tr>")+"</tr>";
}

// update the table of signal values, by prepending or appending
function updateLogbox(names){
    var signals=[];
    var odd=true;
    var bg;
    var row;

    for(var i in names){
        if(cycle % 4 < 2){
            bg = odd ? " class=oddcol":"";
        } else {
            bg = odd ? " class=oddrow":" class=oddrowcol";
        }
        signals.push("<td" + bg + ">" + busToString(names[i]) + "</td>");
        odd =! odd;
    }
    row = "<tr style='font-family:monospace'>" + signals.join("") + "</tr>";

    if(logboxAppend)
        logStream.push(row);
    else
        logStream.splice(1,0,row);

    logbox.innerHTML = logStream.join("");
}

function nodenumber(x){
    // not efficient, but we run it rarely
    // an assumption here about nodedefs being a partner to nodenames
    for(var i=0;i<nodedefs.length;i++){
        if(nodenames[i] == x){
            return i;
        }
    }
    return undefined;
}

function busToString(busname){
    // takes a signal name or prefix
    // returns an appropriate string representation
    // some 'signal names' are CPU-specific aliases to user-friendly string output
    if(busname=='cycle')
        return cycle>>1;
    if(busname in regDisplayMap)
        return readRegHex(busname);
    if(busname=='psr')
        return StatusByteAsString();
    if(busname=='a_bus')
        return busToString('-na');
    if(busname=='b_bus')
        return busToString('-nb');
    if(typeof nodenumber(busname+'_pad') != 'undefined'){
        return isPadHigh(busname)?1:0;
    }
    if(busname[0]=="-"){
        // invert the value of the bus for display
        var value=busToString(busname.slice(1))
        if(typeof value == "undefined") return undefined;
        return hex(~('0x'+value))
    }
    return busToHex(busname);
}

function busToHex(busname){
    // may be passed a bus or a signal: could be a pinname, nodename, nodenumber or a displayname
    // or even a bus of pads, which we must specialcase
    if(busname=='a' || busname=='address' || busname=='addressbus'){
        return hex(readAddressBus());
    }
    if(busname=='d' || busname=='data' || busname=='databus'){
        return hex(readDataBus());
    }
    if(typeof internalBusses[busname] != 'undefined'){
        return hex(readBus(busname));
    }
    if(typeof internalBusses[busname+'_bus'] != 'undefined'){
        return hex(readBus(busname+'_bus'));
    }

}

function teardown(){
    if(ChipWindow != null) {
        popinChip();
        ChipWindow.close();
        ChipWindow = null;
        window.onresize = function(e){handleResize(e);} 
        handleResize();
        window.focus();
    }
    if(typeof(FrontPanelWindow) != "undefined") FrontPanelWindow.close();
}

function uploadMemory(evt) {
    var files = evt.target.files;
    var file = files[0];

    var reader = new FileReader();
    reader.onloadend = function(evt) {
        if (evt.target.readyState == FileReader.DONE) {
            console.log("read result:", evt.target.result);
            var data = new Uint32Array(evt.target.result);

            for(var i = 0; i < data.length; i++) {
                console.log(i, hex(data[i]));
                memory[i] = data[i];
            }

            // ensure all the displayed memory cells are initialised
            for(var i = data.length; i < memorySize; i++) {
                memory[i] = 0;
            }

            updateMemoryTable();
        }
    };

    reader.readAsArrayBuffer(file);
}

var userCode = [];

var memory = Array(memorySize);

// ensure all the displayed memory cells are initialised
for(var i = 0; i < memorySize; i++) {
    memory[i] = 0;
}

var framebuffer = Array(frameSize);

// ensure all the displayed memory cells are initialised
for(var i = 0; i < frameSize; i++) {
    framebuffer[i] = 0;
}
